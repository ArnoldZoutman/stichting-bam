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

### 4. Het `event`-posttype is niet bereikbaar

De zes uitvoeringen (`/uitvoeringen/tegen-tijd/` enz.) bestaan in WordPress als
custom post type `event`, maar zijn geregistreerd zonder `show_in_rest` en
komen in géén enkel REST-endpoint voor. Deze frontend kan ze principieel niet
tonen; links ernaartoe wijzen daarom bewust naar de WordPress-site.

Dit en de Revolution Slider op de homepage zijn de twee blokkades voor een
volledige overstap. Zie `MIGRATIE.md`.

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

## Wat bewust NIET is gedaan

- Reserveringen, ticketing, bestelflow, betalingen
- Contactformulieren (`contact-form-7/v1` is met rust gelaten)
- Schrijven naar WordPress, authenticatie, application passwords
- Een WordPress-plugin of mu-plugin (ook niet om `show_in_rest` aan te zetten —
  dat is een besluit, geen implementatiedetail)
- De live WordPress-site of het thema aanraken

## Wat nog openstaat

Technisch af, maar deze punten bepalen of het toonbaar is:

1. **De hero op `/over-ons` klopt inhoudelijk niet.** `featured_media` is daar
   een 2000×2000 witte muurtextuur die het thema als sectie-achtergrond
   gebruikte, niet als hero. De pagina opent nu met een bijna leeg vlak.
2. **`/tags`, `/categorieen`, `/locaties`, `/mijn-reserveringen` tonen letterlijk
   het woord "CONTENTS".** Dat staat zo in het CMS; de ticketingplugin vervangt
   het op de live site. Ze staan ook in de sitemap. Voor `tags` en `categorieen`
   is dat op te lossen zonder WordPress aan te raken — die taxonomieën zitten
   wél in de API (5 categorieën, 5 tags).
3. **De 7 berichten zijn lorem ipsum** uit de thema-demo-import, net als de
   categorieën ("Innovations", "Lifestyle") en tags ("PHP", "Wordpress").
4. **Er is nog geen git-repo.** `git init` voordat dit ergens heen gaat.
5. **`NUXT_PUBLIC_SITE_URL` staat standaard op `http://localhost:3000`.** Zonder
   die variabele wijzen canonicals, OG-URL's, `robots.txt` en `sitemap.xml` naar
   localhost.
6. **Rebuild na publicatie is handwerk.** De site is statisch; nieuwe content in
   WordPress verschijnt pas na een nieuwe `yarn release`.
