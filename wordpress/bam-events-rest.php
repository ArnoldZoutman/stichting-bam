<?php
/**
 * Plugin Name: BAM Events REST Exposure
 * Description: Zet het `event`-posttype van Events Manager in de WP REST API
 *              en voegt er de datum-, tijd- en locatiegegevens van Events
 *              Manager aan toe, zodat de statische Nuxt-frontend
 *              (www.stichting-bam.nl) de voorstellingen kan tonen zonder naar
 *              cms.stichting-bam.nl door te hoeven linken.
 * Plaatsing:   wp-content/mu-plugins/bam-events-rest.php
 *
 * ============================================================================
 * BEWUST PUBLIEK, BEWUST BEPERKT — LEES DIT VOORDAT JE EEN VELD TOEVOEGT
 * ============================================================================
 * De evenementpagina's op cms.stichting-bam.nl zijn al publiek: iedereen kan
 * ze zonder in te loggen bezoeken. Dit endpoint (`wp/v2/events`) ontsluit dus
 * geen data die niet al openbaar was — het geeft precies wat er ook op de
 * pagina zelf staat: titel, tekst, afbeelding (automatisch via de gewone
 * post-velden zodra `show_in_rest` aan staat) plus datum, tijd en locatienaam
 * (hieronder expliciet toegevoegd).
 *
 * Er hoort HIER NOOIT iets bij te komen over boekingen, deelnemers,
 * e-mailadressen, telefoonnummers of prijzen. Die gegevens leven in Events
 * Manager's eigen tabellen en zijn met opzet afgeschermd achter de eigen
 * REST-namespace van de plugin (`events-manager/v1`, geeft anoniem terecht
 * een 401) en achter wp-admin. Voeg zulke velden hier NIET toe, ook niet
 * "even voor intern gebruik" — dit endpoint is publiek, anoniem en cachebaar;
 * ga ervan uit dat alles wat je hier registreert voor iedereen zichtbaar is.
 *
 * Alleen lezen: er is geen `update_callback` op de onderstaande velden en dat
 * moet zo blijven. Dit bestand schrijft nooit naar Events Manager.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * `event` staat elders geregistreerd met `show_in_rest => false`. We zetten
 * dat hier aan via de filter in plaats van de registratie zelf te wijzigen:
 * zo blijft dit een aanvulling die losstaat van hoe/waar `event` origineel
 * geregistreerd wordt, en overleeft het een thema- of pluginupdate die de
 * registratie opnieuw uitvoert. Er wordt verder NIETS aan de registratie
 * gewijzigd.
 */
add_filter('register_post_type_args', 'bam_events_show_in_rest', 10, 2);

function bam_events_show_in_rest($args, $post_type) {
    if ($post_type !== 'event') {
        return $args;
    }
    $args['show_in_rest'] = true;
    $args['rest_base'] = 'events';
    return $args;
}

add_action('rest_api_init', 'bam_events_register_fields');

/**
 * De enige velden die Events Manager kent en de CPT zelf niet: datum, tijd en
 * locatienaam. Bewust geen prijs-, boekings- of contactvelden — zie de
 * comment bovenaan dit bestand.
 */
function bam_events_register_fields() {
    $fields = [
        'event_start_date'    => 'bam_events_field_start_date',
        'event_end_date'      => 'bam_events_field_end_date',
        'event_start_time'    => 'bam_events_field_start_time',
        'event_end_time'      => 'bam_events_field_end_time',
        'event_all_day'       => 'bam_events_field_all_day',
        'event_location_name' => 'bam_events_field_location_name',
    ];

    foreach ($fields as $field_name => $callback) {
        register_rest_field('event', $field_name, [
            'get_callback' => $callback,
            // Geen update_callback: alleen lezen, zie de comment bovenaan.
            'schema' => [
                'context'     => ['view'],
                'readonly'    => true,
            ],
        ]);
    }
}

/**
 * Haalt het EM_Event-object op voor een post uit de REST-response.
 *
 * Defensief: geeft null zodra Events Manager niet actief is, het event niet
 * (meer) bestaat, of er iets onverwachts misgaat — nooit een fatal error. Een
 * kapot of ontbrekend veld in de REST-respons is geen reden om de hele
 * evenementenlijst (of de build die erop leunt) te laten breken.
 *
 * Gebruikt de PHP-API van de plugin (`em_get_event()` / het `EM_Event`-
 * object), bewust geen eigen SQL op de tabellen van Events Manager: zo blijft
 * dit werken als de plugin haar eigen tabellen ooit wijzigt.
 */
function bam_events_get_em_event($post_array) {
    if (!function_exists('em_get_event')) {
        return null;
    }

    $post_id = is_array($post_array) ? ($post_array['id'] ?? null) : null;
    if (!$post_id) {
        return null;
    }

    try {
        $event = em_get_event($post_id, 'post_id');
        if (!$event || !is_object($event) || empty($event->event_id)) {
            return null;
        }
        return $event;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * `$event->start_date` / `end_date` zijn in Events Manager's eigen datamodel
 * al 'Y-m-d' (ISO-datumnotatie) — dat is een ander veld dan de weergave-
 * methodes van de plugin (zoals `output_date()`), die de Nederlandse
 * weergavenotatie ("03/07/2026") toepassen. We geven hier bewust het RUWE
 * veld door, niet de weergavevariant: opmaak hoort in de frontend thuis.
 */
function bam_events_field_start_date($post) {
    $event = bam_events_get_em_event($post);
    return ($event && !empty($event->start_date)) ? $event->start_date : null;
}

function bam_events_field_end_date($post) {
    $event = bam_events_get_em_event($post);
    return ($event && !empty($event->end_date)) ? $event->end_date : null;
}

/** `$event->start_time` / `end_time` zijn 'H:i:s', ook al ISO. Null bij een hele dag. */
function bam_events_field_start_time($post) {
    $event = bam_events_get_em_event($post);
    if (!$event || !empty($event->event_all_day) || empty($event->start_time)) {
        return null;
    }
    return $event->start_time;
}

function bam_events_field_end_time($post) {
    $event = bam_events_get_em_event($post);
    if (!$event || !empty($event->event_all_day) || empty($event->end_time)) {
        return null;
    }
    return $event->end_time;
}

function bam_events_field_all_day($post) {
    $event = bam_events_get_em_event($post);
    return $event ? (bool) $event->event_all_day : null;
}

/**
 * Locatienaam via `EM_Event::get_location()` (het `EM_Location`-object),
 * niet via een eigen join op de locatietabel. Meerdere fallbacks omdat dit
 * één van de plekken is waar de exacte property-naam tussen EM-versies kan
 * verschillen; faalt alles, dan null — nooit een fatal error.
 */
function bam_events_field_location_name($post) {
    $event = bam_events_get_em_event($post);
    if (!$event) {
        return null;
    }

    try {
        if (method_exists($event, 'get_location')) {
            $location = $event->get_location();
            if ($location && !empty($location->location_name)) {
                return $location->location_name;
            }
        }
        if (!empty($event->location) && is_object($event->location) && !empty($event->location->location_name)) {
            return $event->location->location_name;
        }
    } catch (Throwable $e) {
        return null;
    }

    return null;
}
