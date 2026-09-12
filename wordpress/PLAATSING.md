# Plaatsing van theme-bam-minimal

## Waar het heen moet

`cms.stichting-bam.nl` draait op een aparte WordPress-installatie met
document root `public_html/cms/`. **De automatische deploy
(`.github/workflows/build-deploy.yml`) sluit `cms/**` expliciet uit** van de
FTP-upload (zie de `exclude:`-regel bij de `FTP-Deploy-Action`-stap) — een
`git push` naar `main` zet dit thema dus nooit vanzelf op de server. Plaatsing
is en blijft handwerk:

1. Zip `wordpress/theme-bam-minimal/` (zie hieronder — de zip staat al klaar
   als `wordpress/theme-bam-minimal.zip`).
2. Log in op de Vimexx File Manager (of SFTP) voor `cms.stichting-bam.nl`.
3. Upload de zip naar `public_html/cms/wp-content/themes/`.
4. Pak de zip daar uit. Dat levert `wp-content/themes/theme-bam-minimal/` op
   (de zip bevat de map zelf, geen losse bestanden).
5. Verwijder de zip van de server na het uitpakken.

## Activeren

1. Log in op `cms.stichting-bam.nl/wp-admin`.
2. Ga naar **Weergave → Thema's**.
3. Activeer **BAM Minimal**.
4. Controleer dat het oude thema (`qoon-creative-wordpress-portfolio-theme`)
   daarna niet meer actief is.

## Wat te controleren na activeren

- **Geen dubbele structuur.** Bekijk de paginabron (`view-source:`) van een
  gewone pagina: precies één `<a class="skip-link">`, één
  `<header class="site-header">`, één `id="hoofdinhoud"`, één
  `<footer class="site-footer">`.
- **Huisstijl.** Het koptekstblok, de kleuren en de typografie moeten er
  hetzelfde uitzien als op `www.stichting-bam.nl`.
- **Ticketing werkt nog.** Open een pagina van de ticketing-plugin (bijv.
  `/uitvoeringen`) en doorloop minstens één stap van de reserveringsflow. Dat
  bewijst dat de plugin zijn scripts, styles en nonces via `wp_head()` /
  `wp_footer()` nog goed kan registreren.
- **Noindex staat op de juiste plekken.** Bekijk de paginabron van een gewone
  pagina (bijv. `/over-ons`): daar hoort
  `<meta name="robots" content="noindex, follow">` te staan. Op de
  ticketing-pagina's (`uitvoeringen`, `mijn-reserveringen`, `locaties`,
  `categorieen`, `tags`,
  `uitvoeringen-urinetown-de-musical-bedankt`) hoort die regel juist te
  ontbreken.
- **Navigatie klopt.** De vijf menu-items linken naar
  `https://www.stichting-bam.nl/...` en komen overeen met
  `config/navigation.ts` in de hoofdrepo.

## Let op: repo en server lopen niet vanzelf gelijk

Een wijziging aan `wordpress/theme-bam-minimal/` in deze repo staat pas op
`cms.stichting-bam.nl` nadat iemand de bovenstaande stappen met de hand
herhaalt. Er is geen build- of deploy-stap die dit automatiseert (zie
hierboven). Vergeet na een thema-wijziging niet ook de zip opnieuw te maken.
