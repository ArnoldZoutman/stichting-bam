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

---

# Contactformulier (Contact Form 7)

Het formulier op `www.stichting-bam.nl/contact` verstuurt naar Contact Form 7
(CF7, op cms.stichting-bam.nl geïnstalleerd, versie 6.1.7 op 2 okt 2026). De
frontend gebruikt alleen het publieke REST-endpoint
`/wp-json/contact-form-7/v1/contact-forms/<ID>/feedback`; er is geen plugin of
code op de WordPress-kant nodig. CORS staat al goed: WordPress stuurt
`Access-Control-Allow-Origin: https://www.stichting-bam.nl` mee.

## 1. Formulier aanmaken in wp-admin

**Contact → Nieuwe toevoegen**, titel bijvoorbeeld "Contact (website)". De
veldnamen moeten EXACT zo heten (ze staan in `utils/cf7.ts`):

```
<label> Naam
    [text* your-name autocomplete:name] </label>

<label> E-mailadres
    [email* your-email autocomplete:email] </label>

<label> Onderwerp
    [select your-subject "Vraag over een voorstelling" "Meespelen of meehelpen" "Sponsoring en samenwerking" "Iets anders"] </label>

<label> Bericht
    [textarea* your-message] </label>

[submit "Versturen"]
```

De opmaak hierboven gebruikt alleen CF7 zelf (voor validatie); de bezoeker
ziet het formulier van de Nuxt-site.

## 2. Tabblad "E-mail"

- **Aan:** het adres waar berichten heen moeten (nu `welkom@stichting-bam.nl`)
- **Van:** een adres op het eigen domein, bijv. `Website <wordpress@cms.stichting-bam.nl>`
  — niet het adres van de bezoeker, anders belandt het in spam
- **Onderwerp:** `[your-subject] — [your-name]`
- **Extra headers:** `Reply-To: [your-email]`
- **Berichttekst:** `Van: [your-name] <[your-email]>` + `Onderwerp: [your-subject]` + `[your-message]`

Aanbevolen: een SMTP-plugin of -instelling bij Vimexx, zodat mail niet via
PHP `mail()` gaat (slechtere aflevering).

## 3. Spamwering

Het endpoint is publiek; zonder spamwering komt er spam binnen. CF7 heeft
eigen integraties (Akismet, reCAPTCHA en — te controleren in deze versie —
Cloudflare Turnstile) onder **Contact → Integratie**. Let op: reCAPTCHA en
Turnstile vragen óók een token vanuit het formulier op de Nuxt-site; dat is
nog niet gebouwd. Akismet werkt zonder aanpassing aan de frontend.

## 4. ID doorgeven aan de frontend

Het ID staat in de shortcode die CF7 toont (`[contact-form-7 id="…"]`; bij
CF7 6 soms een hash — het numerieke ID staat dan in de URL van het
bewerkscherm, `post=<ID>`). Zet het in `app.config.ts`:

```ts
contactForm: {
  cf7Base: 'https://cms.stichting-bam.nl/wp-json/contact-form-7/v1',
  cf7FormId: 123,   // ← hier
},
```

Commit + merge naar `main`: de deploy bouwt de site opnieuw. Pas dan
verschijnt het formulier op `/contact`; zolang `cf7FormId` `null` is, toont
die pagina alleen de contactgegevens.

## 5. Eerste keer testen

Stuur één echt bericht vanaf `www.stichting-bam.nl/contact` en controleer dat
de mail aankomt. Lokaal getest is alleen tegen een nagebootste CF7-server
(validatiefout, mail_failed, mail_sent, onbereikbaar); het echte endpoint
is bewust niet aangeroepen omdat dat mail verstuurt. Te controleren bij die
eerste test: of CF7 6.1.7 de unit tag `wpcf7-f<ID>-o1` accepteert.

## AVG

CF7 bewaart berichten standaard niet in de database; ze gaan alleen per mail
weg. Vermeld het contactformulier (doel: beantwoorden van je vraag; gegevens:
naam, e-mail, bericht) in de privacyverklaring.
