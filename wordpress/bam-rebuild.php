<?php
/**
 * Plugin Name: BAM Static Rebuild Trigger
 * Description: Stuurt bij het publiceren, bijwerken of depubliceren van
 *              content een repository_dispatch naar
 *              ArnoldZoutman/stichting-bam, zodat de GitHub Actions build
 *              van de statische site start.
 * Plaatsing:   wp-content/mu-plugins/bam-rebuild.php
 *
 * Vereist in wp-config.php (NIET in dit bestand, NIET in de repo):
 *   define( 'BAM_GH_DISPATCH_TOKEN', '<fine-grained token>' );
 *
 * Het token is een fine-grained personal access token, scoped op uitsluitend
 * de repo ArnoldZoutman/stichting-bam, met alleen de repository-permissie
 * "Contents: Read and write". Geen andere permissies aanvinken.
 *
 * Omrollen: genereer op https://github.com/settings/personal-access-tokens
 * een nieuw token met dezelfde scope, zet de nieuwe waarde in wp-config.php,
 * verifieer met een test-publish dat de Actions-run start, en revoke daarna
 * pas het oude token.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Alleen contenttypes die daadwerkelijk op de statische site staan.
 * Zonder deze filter zou elk record van de ticketing-plugin dat als
 * gepubliceerd wordt weggeschreven — een reservering bijvoorbeeld — een
 * volledige rebuild starten.
 */
function bam_rebuild_post_types() {
    return ['post', 'page'];
}

add_action('transition_post_status', 'bam_rebuild_on_status_change', 10, 3);

function bam_rebuild_on_status_change($new_status, $old_status, $post) {
    // Publiceren, bijwerken van iets gepubliceerds, én depubliceren of
    // weggooien. Dat laatste is nodig omdat een verwijderde pagina anders
    // op de statische site blijft staan.
    if ($new_status !== 'publish' && $old_status !== 'publish') {
        return;
    }
    if ($new_status === $old_status && $new_status !== 'publish') {
        return;
    }
    if (wp_is_post_revision($post) || wp_is_post_autosave($post)) {
        return;
    }
    if (!in_array($post->post_type, bam_rebuild_post_types(), true)) {
        return;
    }

    // Throttle: bij het achter elkaar bewerken van meerdere pagina's mag er
    // niet per pagina een build starten. De transient wordt VOOR de request
    // gezet, om een race tussen twee vrijwel gelijktijdige publicaties te
    // voorkomen.
    if (get_transient('bam_rebuild_throttle')) {
        // Maar de laatste bewerking mag niet verloren gaan: plan één
        // afsluitende build na afloop van het throttle-venster.
        if (!wp_next_scheduled('bam_rebuild_deferred')) {
            wp_schedule_single_event(time() + (3 * MINUTE_IN_SECONDS) + 30, 'bam_rebuild_deferred');
        }
        return;
    }
    set_transient('bam_rebuild_throttle', 1, 3 * MINUTE_IN_SECONDS);

    bam_rebuild_dispatch();
}

add_action('bam_rebuild_deferred', 'bam_rebuild_dispatch');

function bam_rebuild_dispatch() {
    if (!defined('BAM_GH_DISPATCH_TOKEN') || BAM_GH_DISPATCH_TOKEN === '') {
        error_log('bam-rebuild: BAM_GH_DISPATCH_TOKEN ontbreekt in wp-config.php, geen dispatch verstuurd.');
        return;
    }

    // Non-blocking: de redacteur mag niet op GitHub hoeven wachten. De
    // timeout geldt wel voor het opzetten van de verbinding inclusief
    // TLS-handshake — een halve seconde is daarvoor op shared hosting te
    // krap, en een mislukte verbinding verdwijnt hier geruisloos.
    wp_remote_post('https://api.github.com/repos/ArnoldZoutman/stichting-bam/dispatches', [
        'blocking' => false,
        'timeout'  => 3,
        'headers'  => [
            'Authorization' => 'Bearer ' . BAM_GH_DISPATCH_TOKEN,
            'Accept'        => 'application/vnd.github+json',
            'Content-Type'  => 'application/json',
            'User-Agent'    => 'bam-rebuild-mu-plugin',
        ],
        'body' => wp_json_encode([
            'event_type' => 'wp-publish',
        ]),
    ]);
}