<?php
/**
 * BAM Minimal — page.php
 *
 * De schil (head/header/nav/footer) komt uit bam_shell_open()/bam_shell_close()
 * in functions.php. the_content() laat WordPress shortcodes gewoon zelf
 * verwerken — de ticketing-plugin hangt daar zijn eigen markup, scripts en
 * nonces aan.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

bam_shell_open();
?>
<div class="container">
	<?php
	while ( have_posts() ) :
		the_post();
		?>
	<article <?php post_class(); ?>>
		<header class="page-header">
			<h1><?php the_title(); ?></h1>
		</header>
		<?php the_content(); ?>
	</article>
		<?php
	endwhile;
	?>
</div>
<?php
bam_shell_close();
