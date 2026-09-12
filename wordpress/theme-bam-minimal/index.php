<?php
/**
 * BAM Minimal — index.php
 *
 * Fallback-template voor alles wat geen page.php krijgt (berichten,
 * archieven, zoekresultaten, 404). De schil komt net als in page.php uit
 * bam_shell_open()/bam_shell_close() in functions.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

bam_shell_open();
?>
<div class="container">
	<?php
	if ( have_posts() ) :
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
	else :
		?>
	<p>Geen inhoud gevonden.</p>
		<?php
	endif;
	?>
</div>
<?php
bam_shell_close();
