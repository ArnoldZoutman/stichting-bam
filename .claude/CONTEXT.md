# Projectcontext — Stichting BAM headless frontend

Gebouwd tussen **9 en 11 september 2026**. Dit document bevat wat je niet uit de
code of de commitgeschiedenis kunt aflezen: waaróm dingen zijn zoals ze zijn.

Zie ook:
- `README.md` — draaien, architectuur, Apache, faal-check
- `MIGRATIE.md` — welke content wel/niet via de API komt, en wat een volledige
  overstap blokkeert
- `.claude/VALKUILEN.md` — de valkuilen die we al geraakt hebben, met hoe je ze
  aantoont

---

## Wat dit is

Een Nuxt 3-frontend die de content van `https://www.stichting-bam.nl` ophaalt
via de WordPress REST API en er een **volledig statische site** van bakt.

De opzet is onderdeel van een migratie: WordPress blijft draaien als CMS
**inclusief het huidige thema**, en daarnaast komt deze losse frontend die
alleen de content gebruikt, niet de theming. De live WordPress-site verandert
niet.

De hosting is een **Vimexx basic-pakket: Apache met PHP, geen Node.js**. Er
draait dus niets server-side van dit project; alles wordt bij de build
gerenderd.

## De vier dingen die je echt moet weten

### 1. Dit is géén Gutenberg-site

De opdracht ging uit van Gutenberg-blokken. Die zijn er niet — geen enkele
`wp-block-*`-klasse in alle 9 pagina's en 7 berichten. De site draait op
**WPBakery Page Builder** met het Onioneye "qoon"-thema, en `content.rendered`
bevat daardoor **onverwerkte `[vc_row]`-shortcodes**: WPBakery voert die alleen
in de thema-frontend uit, niet in REST.

`server/utils/wp-content.ts` pakt die shortcodes uit en herstelt de kapotte HTML
die `wpautop` ervan maakt. **Dat is geen tijdelijke opruimlaag maar een
permanent onderdeel** — zolang de redactie in WPBakery werkt, blijft die output
zo. Vervangt WPBakery ooit door de blok-editor, dan verandert de content-shape
volledig en moet die laag opnieuw.

### 2. De WordPress-host throttelt

WordPress staat zelf ook op shared hosting en antwoordt met **`508 Loop
Detected`** zodra je er parallel op los gaat. Dat heeft één keer een build
opgeleverd die **slaagde met een lege homepage**.

Daarom staat de prerender bewust op `concurrency: 2, interval: 300`. Ga daar
niet aan zitten zonder te meten. Calls die pas na een nieuwe poging slaagden
worden gemeld door de faal-check — dat is je vroegsignaal dat je weer tegen de
limiet aan zit.

### 3. Deploy vanuit `dist/`, nooit uit `.output/public`

`nuxt generate` leegt `.output` vóórdat het begint te bouwen. Een mislukte build
laat daar dus een **lege map** achter. Een deployscript dat onvoorwaardelijk
synchroniseert wist daarmee de live site.

`yarn release` = generate → verify → pas bij succes kopiëren naar `dist/`.
`dist/` bevat dus altijd de laatste build die is goedgekeurd. Dit is
geverifieerd met drie faaltests; zie `.claude/VALKUILEN.md`.

### 4. Voorstellingen komen via een eigen mu-plugin

De uitvoeringen zijn het custom post type `event` van Events Manager. Dat
stond zonder `show_in_rest`; `wordpress/bam-events-rest.php` (mu-plugin op
cms.stichting-bam.nl) zet het aan als `/wp/v2/events` en voegt datum, tijd en
locatienaam toe. **Meer levert de API niet**: geen speeldata per voorstelling,
status, kaartlink, prijs, duur, cast of galerij — en `event_location_name` is
op dit moment bij alle events leeg. Het ontwerp toont die blokken daarom niet.

De Revolution Slider op de homepage (en de "impressie" bij Karavaan) blijft
onbereikbaar. Zie `MIGRATIE.md`.

---

## Beslissingen en waarom

| Keuze | Reden |
|---|---|
| Statisch (`nitro.static`) | Geen Node op de hosting |
| `/api`-laag behouden | Gemeten: client-side navigatie gebruikt alleen `_payload.json`, nul `/api`-requests. Slopen was onnodig risico |
| Paginering via pad (`/nieuws/pagina/2`) | Een geprerenderde route wordt op pad geserveerd; met `?pagina=2` krijg je de HTML van pagina 1 |
| Canoniek zonder trailing slash | Sluit aan op de bestaande `NuxtLink`s en de sitemap, dus geen extra redirect bij interne navigatie |
| `wpBase` buiten `runtimeConfig.public` | Niets in de client leest hem; zo belandt de WP-URL niet in elke payload. Levert meteen de gevraagde naam `NUXT_WP_BASE` op |
| Menu handmatig in `config/navigation.ts` | `/wp/v2/menu-items` geeft 401 en auth valt buiten scope |
| Links alleen intern maken als we het pad serveren | Anders worden de plugin-pagina's herschreven naar interne 404's |
| Yarn 4 met `nodeLinker: node-modules` | npm 10.9.x klapt eruit op Nuxt's peer-deps; Yarn PnP breekt Nuxt (`@nuxt/kit` niet resolvebaar) |
| Geen ISR/SWR/routeRules/purge | Vereist een draaiende server; zou dode configuratie zijn |
| Redesign (okt 2026): plain CSS met tokens in `assets/css/tokens.css`, geen UI-library | Ontwerp in `design-reference/`; componenten zijn dunne SFC's met scoped CSS |
| Fonts lokaal in `public/fonts/`, geen `@nuxt/fonts` | Geen call naar Google, ook niet tijdens de build; geen extra dependency |
| Geen `@nuxt/image` | Bij een statische build haalt het elke WP-afbeelding op en bewerkt die: precies de belasting waar de host 508 op geeft. `srcset` uit WP + juiste `sizes` |
| Productienummers (I–VI) afgeleid, chronologisch | Events Manager kent geen productienummer (`composables/useProductions.ts`) |
| Contactgegevens geparsed uit de tekst van "Over ons" | Geen veld of endpoint; parser is tolerant en laat velden weg als de opmaak verandert (`getContactDetails`) |
| Nieuwsbrief achter `features.newsletter` in `app.config.ts` (uit) | Nog geen nieuwsbrief bevestigd |
| Contactformulier → Contact Form 7 (REST) op cms, aan zodra `contactForm.cf7FormId` in `app.config.ts` gevuld is | Geen eigen backend; CF7 stond er al, CORS werkt via WordPress zelf. Inrichting: `wordpress/PLAATSING.md` |
| GA4 aan/uit via een eigen `GA_MEASUREMENT_ID`, alleen gezet in de deploy-workflow | Alleen de gepubliceerde site mag meten. Bewust NIET afgeleid van `NUXT_PUBLIC_SITE_URL`: die zet je lokaal juist ook op de productie-URL om canonicals/OG/sitemap te controleren, en dan zou die controlebuild echte pageviews sturen |

## Wat bewust NIET is gedaan

- Reserveringen, ticketing, bestelflow, betalingen
- Contactformulieren (`contact-form-7/v1` is met rust gelaten)
- Schrijven naar WordPress, authenticatie, application passwords
- Een WordPress-plugin of mu-plugin (ook niet om `show_in_rest` aan te zetten —
  dat is een besluit, geen implementatiedetail)
- De live WordPress-site of het thema aanraken
- Cookiebanner / consent-gating voor de GA4-tag: die laadt bij iedere bezoeker.
  Een keuze om bewust te maken, geen vergeten detail (zie README, "Statistieken")

## Wat nog openstaat

Technisch af, maar deze punten bepalen of het toonbaar is (stand 2 okt 2026):

1. **Contactformulier: CF7-formulier nog aanmaken.** De frontend verstuurt
   naar Contact Form 7, maar het formulier moet in wp-admin worden aangemaakt
   en het ID in `app.config.ts` (`contactForm.cf7FormId`). Tot dan verwijst
   het formulier naar het e-mailadres. Stappen, mailinstellingen en
   spamwering: `wordpress/PLAATSING.md`. Het echte endpoint is nog niet
   aangeroepen (zou mail versturen).
2. **Redactioneel in Events Manager/WordPress:** locaties invullen (nu leeg),
   echte nieuwscategorieën aanmaken (nu alleen "Geen categorie" in gebruik),
   lichtere affiches uploaden (Tegen Tijd: 859 KB, geen formaat tussen 200 en
   683 px), de zin over de "impressie" bij Karavaan verwijst naar een slider
   die niet via de API komt.
3. **Kaarten:** er is geen kaartlink per voorstelling in de API; de knop
   "Kaarten" wijst naar `/uitvoeringen`. Hart voor BAM linkt wel naar
   `stichting-bam.weticket.io` — een kandidaat-bron.
4. **`NUXT_PUBLIC_SITE_URL` staat standaard op `http://localhost:3000`.** Zonder
   die variabele wijzen canonicals, OG-URL's, `robots.txt` en `sitemap.xml` naar
   localhost. De deploy-workflow zet hem.
