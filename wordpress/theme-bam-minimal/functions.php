<?php
/**
 * BAM Minimal — functions.php
 *
 * Minimaal thema, alleen bedoeld om de ticketing-plugin op
 * cms.stichting-bam.nl in de huisstijl van www.stichting-bam.nl te tonen.
 * Geen widgets, geen sidebars, geen customizer, geen editor-styles.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Paginaslugs die WEL geïndexeerd mogen worden: de pagina's van de
 * ticketing-plugin, waar bezoekers vanaf de statische site juist naartoe
 * worden gestuurd. Alle andere frontendpagina's krijgen noindex, omdat hun
 * content ook (of beter) op www.stichting-bam.nl staat en de twee anders om
 * dezelfde zoekresultaten concurreren.
 *
 * Deze lijst moet gelijk lopen met de redirects in public/.htaccess van de
 * statische site (repo stichting-bam, public/.htaccess).
 */
const BAM_INDEXABLE_SLUGS = array(
	'uitvoeringen',
	'mijn-reserveringen',
	'locaties',
	'categorieen',
	'tags',
	'uitvoeringen-urinetown-de-musical-bedankt',
);

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
	}
);

add_action(
	'wp_enqueue_scripts',
	function () {
		$stylesheet_path = get_stylesheet_directory() . '/style.css';
		wp_enqueue_style(
			'bam-minimal',
			get_stylesheet_uri(),
			array(),
			file_exists( $stylesheet_path ) ? filemtime( $stylesheet_path ) : null
		);
	}
);

// Reacties komen nergens in dit thema aan bod; ook niet toestaan of tonen.
add_filter( 'comments_open', '__return_false' );
add_filter( 'pings_open', '__return_false' );
add_filter( 'comments_array', '__return_empty_array' );

add_filter(
	'wp_robots',
	function ( array $robots ): array {
		if ( ! is_page( BAM_INDEXABLE_SLUGS ) ) {
			$robots['noindex'] = true;
			$robots['follow']  = true;
		}
		return $robots;
	}
);

/**
 * Handmatige navigatie i.p.v. wp_nav_menu(): de statische site
 * (www.stichting-bam.nl) heeft zijn eigen navigatie in config/navigation.ts
 * en gebruikt geen WordPress-menu's. Deze lijst is de kopie daarvan voor de
 * cms-header; wijzigt de navigatie daar, werk dan deze lijst met de hand bij.
 * URL's zijn bewust absoluut naar het hoofddomein, zodat een bezoeker vanaf
 * cms.stichting-bam.nl altijd terug kan.
 */
function bam_nav_items(): array {
	return array(
		array(
			'label' => 'Home',
			'url'   => 'https://www.stichting-bam.nl/',
		),
		array(
			'label' => 'Over ons',
			'url'   => 'https://www.stichting-bam.nl/over-ons',
		),
		array(
			'label' => 'Uitvoeringen',
			'url'   => 'https://www.stichting-bam.nl/uitvoeringen',
		),
		array(
			'label' => 'Hart voor BAM',
			'url'   => 'https://www.stichting-bam.nl/hart-voor-bam',
		),
		array(
			'label' => 'Nieuws',
			'url'   => 'https://www.stichting-bam.nl/nieuws',
		),
	);
}

/**
 * De volledige paginaschil (head, header, nav, opening van <main>) staat
 * hier — samen met bam_shell_close() — als enige plek die deze markup
 * uitvoert. index.php en page.php roepen alleen deze twee functies aan en
 * vullen zelf enkel de inhoud tussen <main> en </main>. Zo kan er nooit een
 * dubbele header/main/footer ontstaan doordat twee templates elk hun eigen
 * kopie van de schil zouden uitvoeren.
 */
function bam_shell_open(): void {
	?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="skip-link" href="#hoofdinhoud">Naar de inhoud</a>
<header class="site-header">
	<div class="container site-header__inner">
		<a class="site-header__logo" href="https://www.stichting-bam.nl/"><?php bloginfo( 'name' ); ?></a>
		<nav class="site-nav" aria-label="Hoofdnavigatie">
			<ul>
				<?php foreach ( bam_nav_items() as $item ) : ?>
				<li><a href="<?php echo esc_url( $item['url'] ); ?>"><?php echo esc_html( $item['label'] ); ?></a></li>
				<?php endforeach; ?>
			</ul>
		</nav>
	</div>
</header>
<main id="hoofdinhoud">
	<?php
}

function bam_shell_close(): void {
	?>
</main>
<footer class="site-footer">
	<div class="container site-footer__inner">
		<p>&copy; <?php echo date_i18n( 'Y' ); ?> <?php bloginfo( 'name' ); ?></p>
		<p><a href="https://www.stichting-bam.nl/">Terug naar www.stichting-bam.nl</a></p>
	</div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
	<?php
}
