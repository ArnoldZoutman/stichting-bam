# Stichting BAM — Nuxt 3 frontend op de WordPress REST API

Server-side gerenderde Nuxt 3-frontend die de content van
[stichting-bam.nl](https://www.stichting-bam.nl) ophaalt via de publieke
WP REST API. Alleen leesoperaties: geen authenticatie, geen credentials,
geen schrijfacties richting WordPress.

## Draaien

Dit project gebruikt **Yarn 4**. De versie staat vastgepind in het
`packageManager`-veld van `package.json`, dus je hoeft yarn niet zelf te
installeren: corepack (meegeleverd met Node) haalt de juiste versie op.

```bash
corepack enable        # eenmalig, maakt `yarn` beschikbaar
yarn install
yarn dev               # http://localhost:3000 — ontwikkelen
```

### Een publiceerbare build maken

```bash
yarn release
```

Dat is de **enige** opdracht die een deploy-artefact oplevert. Hij doet drie
dingen, en stopt zodra er één faalt:

1. `nuxt generate` — rendert alle routes tot platte HTML in `.output/public`
2. `node scripts/verify-build.mjs` — keurt die output (zie "De faal-check")
3. `node scripts/stage-release.mjs` — kopieert de goedgekeurde build naar `dist/`

Upload daarna de **inhoud van `dist/`** naar `public_html/`, inclusief het
verborgen `.htaccess`.

> **Deploy nooit vanuit `.output/public`.** `nuxt generate` leegt die map
> vóórdat het begint te bouwen, dus een mislukte build laat daar een lege map
> achter. Een deployscript dat onvoorwaardelijk synchroniseert zou de live site
> wissen. `dist/` wordt alleen vervangen door een build die de faal-check heeft
> doorstaan en bevat dus altijd de laatste goede versie.

Losse opdrachten:

```bash
yarn generate          # alleen bouwen
yarn verify            # alleen de faal-check (voor CI, of op een bestaande output)
yarn preview           # npx serve op .output/public
yarn typecheck         # vue-tsc
```

Vereist Node `^20.19.0 || >=22.12.0` (eis van Nuxt 3.21).

> **`.yarnrc.yml` is niet optioneel.** Nuxt werkt niet onder Yarn's standaard
> Plug'n'Play-linker: de Nuxt CLI kan dan zijn eigen `@nuxt/kit` niet resolven
> en `nuxt prepare` faalt tijdens het installeren. De `nodeLinker: node-modules`
> in `.yarnrc.yml` voorkomt dat en hoort dus mee de repo in.

> Yarn 4 draait standaard geen build-scripts van dependencies. Voor dit project
> maakt dat niets uit — esbuild gebruikt platform-specifieke optional
> dependencies en werkt gewoon; build en typecheck zijn hiermee geverifieerd.

> Bij het koud opstarten logt Vite een paar keer
> `Failed to resolve import "#app-manifest"`. Dat is een koude-startartefact van
> Nuxt zelf, verdwijnt zodra de server warm is en bereikt de browserconsole
> niet.

### Liever npm?

Kan, maar dan heb je **npm 11 of hoger** nodig. npm 10.9.x (de versie die met
Node 22 meekomt) klapt eruit op de peer-dependencies van Nuxt met
`Cannot read properties of null (reading 'edgesOut')` — een bug in npm's
arborist, niet in dit project.

## Statische build voor shared hosting

De hosting is een Vimexx basic-pakket: **Apache met PHP, geen Node.js**.
Server-side rendering op verzoek is daar onmogelijk. Het project levert daarom
een volledig statische site op: `nitro.static: true` plus prerendering van alle
routes. In `.output/public` staat **geen serverbundel** — alleen platte
bestanden.

De `server/`-map bestaat nog wel, maar draait uitsluitend tijdens de build.

**Geen ISR, SWR, `routeRules`-caching, `cachedFunction` of purge-endpoint.**
Die vereisen allemaal een draaiende server en zouden hier dode configuratie
zijn. De enige caching is in-memory memoization tijdens de build
(`server/utils/wp-client.ts` en `wp-content.ts`), die dubbele API-calls binnen
één build voorkomt.

### Welke routes worden gegenereerd

`crawlLinks: true` alleen is niet genoeg: een pagina waar nergens naartoe
gelinkt wordt zou stil wegvallen. Daarom haalt de hook `prerender:routes` in
`nuxt.config.ts` de slugs expliciet uit de API op:

- de 9 pagina's op hun eigen slug (`home` wordt `/`)
- `/nieuws` plus `/nieuws/pagina/<n>` voor elke vervolgpagina, op basis van
  `X-WP-TotalPages`
- de detailpagina van elk bericht
- `/robots.txt`, `/sitemap.xml` en `/404.html`

Faalt die API-call, dan gooit de hook en mislukt de build meteen — een build met
een halve routelijst is precies wat we willen voorkomen.

### De prerender gaat bewust langzaam

`concurrency: 2` en `interval: 300`. WordPress staat zelf ook op shared hosting
en antwoordt met **`508 Loop Detected`** zodra je er parallel op los gaat. Met
de standaardinstellingen (8 routes tegelijk, geen pauze) liep de build daar
tegenaan: `/api/page/home` faalde, de homepage viel terug op zijn `default` en
**de build slaagde met een lege homepage**. Rustig aan doen is hier geen luxe
maar voorwaarde voor een betrouwbare build.

## De faal-check

`scripts/verify-build.mjs`, ook los te draaien met `yarn verify`.

Het risico bij een statische site is niet dat de build faalt — dat merk je. Het
risico is dat de build **slaagt met een lege of halve site**, omdat WordPress
tijdens de build even niet antwoordde. Die output overschrijft dan een goede
versie.

Het script eindigt met **exit-code 1** zodra één van deze dingen niet klopt:

| Controle | Faalt bij |
|---|---|
| Mislukte API-calls tijdens de build | één of meer regels met `severity: failed` in `.build-report/api-failures.jsonl` |
| Aantal pagina's uit de API | minder dan 9 |
| **Elke bekende paginaslug bij naam** | een van de 9 slugs in `KNOWN_PAGE_SLUGS` ontbreekt in de API — vangt een verwisseling/hernoeming die het totaal ongemoeid laat |
| Aantal berichten uit de API | minder dan 7 |
| Homepage-content in de API | `content.rendered` van `home` is leeg of de pagina bestaat niet |
| Verwachte HTML-bestanden | een route uit de API heeft geen `index.html` in de output |
| Inhoud per pagina | minder dan 120 tekens tekst in de `<body>`, of geen `<h1>` |
| Server-side gerenderd | de titel van het nieuwste bericht staat niet in `index.html` |
| 404-pagina | `404.html` mist een `<h1>`, te weinig tekst, of niet de tekst "Pagina niet gevonden" — vangt een teruggevallen SPA-shell |
| Losse bestanden | `robots.txt`, `sitemap.xml` of `.htaccess` ontbreekt |

Het verwachte aantal bestanden wordt **uit de API afgeleid**, niet hardcoded:
anders zou de build gaan falen om de verkeerde reden zodra er een achtste
bericht bij komt. De 9 paginaslugs zelf staan wél hardcoded in
`scripts/verify-build.mjs` (`KNOWN_PAGE_SLUGS`) — bewust een eigen lijst, niet
geïmporteerd uit `config/navigation.ts`. Dit script controleert de app; het
mag niet op een constante van diezelfde app vertrouwen, anders ziet een
verkeerde wijziging daar de faal-check niet. Verander je een paginaslug in
WordPress, werk dan **beide plekken** bij.

`api()` in `verify-build.mjs` doet zelf 2–3 pogingen met backoff bij een
tijdelijke 5xx — dezelfde reden als `nitro.prerender.concurrency`: WordPress
staat op dezelfde shared host en `508 Loop Detected` blijft mogelijk. Een
echte clientfout (4xx) of een 5xx die aanhoudt, faalt nog steeds direct.

### Route-inventaris

`yarn verify` sluit af met een lijst van elke categorie gegenereerde routes:
hoeveel er zijn, hoeveel daarvan inhoudelijk getest worden (`checkHtml`, dus
`<h1>` + minimale tekst), en waarom. Kort samengevat:

| Categorie | Getest? | Waarom (niet) |
|---|---|---|
| 9 pagina's, nieuwsoverzicht + paginering, berichtdetails, `404.html` | ja | `checkHtml` per bestand |
| `robots.txt`, `sitemap.xml`, `.htaccess` | nee | geen HTML-pagina's; alleen bestaan gecontroleerd |
| `200.html` | nee | Nitro's automatische SPA-fallback voor statische hosts; niet aangeroepen door `.htaccess`, dus inert op Apache |
| `_payload.json` per route | nee | hoort bij een al inhoudelijk geteste HTML-pagina en deelt dezelfde databron |
| `_nuxt/**` (JS/CSS-bundels) | nee | build-assets, geen routes; werking wordt met headless Chrome getest (zie `.claude/VALKUILEN.md`), niet met een tekstcheck |

Twee dingen om te weten:

- De controle op de homepage kijkt naar de **ruwe `content.rendered`** uit
  WordPress, niet naar de gerenderde uitvoer. De pagina `home` bestaat namelijk
  alleen uit een sliderplugin-shortcode die bij ons geen zichtbare content
  oplevert (zie "Wat niet werkt"). Leeg raken van dat veld betekent dus dat
  WordPress zelf niets meer teruggeeft.
- Calls die pas na een nieuwe poging slaagden (`severity: recovered`) keuren de
  build **niet** af, maar worden wel gemeld. Dat is het signaal dat WordPress
  tegen zijn limiet aan zat: zonder die melding ziet een build waarin elke call
  twee pogingen nodig had er precies zo uit als een build waarin niets misging.
  Komt dat terug, verlaag dan `nitro.prerender.concurrency` of verhoog
  `interval`.
- Niet-2xx antwoorden worden tijdens de build weggeschreven door
  `server/utils/build-report.ts`. Een deel van de API-fouten wordt namelijk
  bewust opgevangen (media-index, sitenaam, `default:` op `useFetch`) om de site
  overeind te houden; zonder dit logbestand zou zo'n fout ongemerkt een halve
  pagina opleveren. `scripts/reset-report.mjs` maakt het log leeg aan het begin
  van elke build.

## Apache-configuratie

`public/.htaccess` komt ongewijzigd mee in de output.

**Canonieke URL-vorm: `https://www.stichting-bam.nl/over-ons`** — met `www`,
**zonder** trailing slash. Die keuze komt overeen met de `NuxtLink`s in de app
en met de URL's in `sitemap.xml`, zodat een interne navigatie nooit een extra
redirect oplevert.

Wat er in staat:

- `ErrorDocument 404 /404.html` — door Nuxt gegenereerd via
  `nitro.prerender.routes`, ná `finalize-404.mjs` een echte geprerenderde
  pagina (zie "Wat niet werkt")
- HTTPS en de `www`-variant geforceerd met een 301
- `/over-ons/` → 301 naar `/over-ons`
- `DirectorySlash Off` plus een rewrite die `/over-ons` rechtstreeks uit
  `over-ons/index.html` serveert, zónder redirect
- `mod_deflate` voor HTML, CSS, JS, SVG, JSON en XML
- `/_nuxt/**` krijgt `max-age=31536000, immutable` (die bestandsnamen hebben een
  content-hash); HTML en `_payload.json` krijgen `max-age=0, must-revalidate`,
  anders zien bezoekers na een deploy de oude pagina
- `Options -Indexes`, en `.htaccess` zelf is niet opvraagbaar

De HTTPS- en `www`-redirects matchen **expliciet op onze eigen hostnamen**
(`^(www\.)?stichting-bam\.nl$` / `^stichting-bam\.nl$`), niet op een negatieve
vorm als "geen www" of "geen localhost". Reden: `public_html/cms/` — de
WordPress-installatie op `cms.stichting-bam.nl` — is een **submap** van
`public_html/`, en Apache voegt `.htaccess` van bovenliggende mappen samen met
submappen. Een conditie als `RewriteCond %{HTTP_HOST} !^www\.` matcht dus ook
`cms.stichting-bam.nl` en zou WordPress naar het hoofddomein doorsturen zodra
die regel daar zou gelden. mod_rewrite-regels erven weliswaar niet over zodra
WordPress zijn eigen `RewriteEngine On` heeft (elke `RewriteEngine On` in een
submap begint een nieuwe keten), maar daar wordt bewust niet op geleund als
enige vangrail — vandaar de expliciete allowlist. `ErrorDocument`, `Options`,
`Header` en `mod_expires` erven wél gewoon over naar `public_html/cms/`; zie
de comment boven het rewrite-blok in `public/.htaccess`.

Met een expliciete allowlist op de hostnaam werkt lokaal testen op `localhost`
vanzelf (die host matcht geen van beide condities), zonder aparte
uitzondering — dat scheelde eerder een tweede variant van dit bestand.

**Bij controle bleek er een verboden vorm te staan.** Vóór deze wijziging was
regel 2 `RewriteCond %{HTTP_HOST} !^www\.` (met alleen een localhost-
uitzondering) — precies het geval hierboven. Vervangen door de expliciete
apex-match. `Options -Indexes` en `DirectorySlash Off` stonden al goed en zijn
ongewijzigd; die combinatie kan zonder `-Indexes` een directory listing
blootleggen, dus dat is bevestigd, niet toegevoegd.

> **De 404-pagina heeft geen JavaScript meer nodig voor zijn inhoud.** Nitro
> rendert een route met de exacte naam `404.html` altijd als een client-only
> SPA-shell, ongeacht `ssr`-instellingen — dat leverde een lege
> `<div id="__nuxt"></div>` op die pas na hydratie tekst toonde. Opgelost door
> `pages/404.vue` (een gewone, wél server-side gerenderde pagina op `/404`) en
> `scripts/finalize-404.mjs`, dat na `nuxt generate` de gerenderde inhoud van
> `/404/index.html` over de lege `404.html` heen kopieert en de tussenmap
> opruimt. Draait automatisch mee in `yarn generate`/`yarn build`/`yarn release`.
>
> `finalize-404.mjs` verwijdert daarna ook alle `<script>`- en
> `modulepreload`-tags uit die gekopieerde HTML: zonder JavaScript valt er
> voor dit ene bestand toch niets te hydrateren (Apache serveert het voor een
> willekeurig pad, niet voor `/404` waar het voor gebouwd is), en zo is
> "zonder JavaScript-afhankelijkheid" ook letterlijk waar in plaats van
> alleen in de praktijk. De inline `<style>`-tags (kritieke CSS) blijven
> staan, dus de pagina oogt hetzelfde.
>
> Geverifieerd met een lokale Apache (zie `.claude/VALKUILEN.md`) en headless
> Chrome: een onbekende URL geeft status 404, de echte tekst staat er
> meteen, `location.href` blijft het opgevraagde (niet-bestaande) pad — geen
> `<script>`-element in de respons, dus ook geen hydratie en geen
> console-warnings.

## Automatische deploy (GitHub Actions)

`.github/workflows/build-deploy.yml` bouwt en deployt automatisch. Vier
manieren om hem te starten:

| Trigger | Waarom |
|---|---|
| `push` naar `main` | de gewone weg na een codewijziging |
| `repository_dispatch` (`wp-publish`) | afgevuurd door de mu-plugin op de WordPress-server bij publiceren (hoort bij prompt 2a) |
| `schedule` (`0 2 * * *`) | vangnet: een webhook die stilvalt merkt niemand, zo is het ergste geval "morgen live" in plaats van "nooit" |
| `workflow_dispatch` | handmatig starten, met een `dry_run`-optie om te zien wat er zou gebeuren zonder te uploaden |

De job: checkout → Node LTS → `yarn install --immutable` → `yarn release` →
**alleen bij succes** een artefact van `dist/` bewaren en FTP-deployen. Omdat
elke stap in GitHub Actions standaard pas draait na een geslaagde vorige stap,
is er geen aparte voorwaarde nodig om te garanderen dat er nooit geüpload
wordt na een mislukte build — een falende `yarn release` (exit-code 1) stopt
de job vanzelf vóór de deploy-stap.

### Secrets

Geen van deze staat in de repository, ook niet als voorbeeldwaarde:

| Secret | Gebruikt voor |
|---|---|
| `FTP_HOST` | `web0087.zxcs.nl` |
| `FTP_USER` | `arnold@stichting-bam.nl` |
| `FTP_PASSWORD` | — |
| `WP_API_BASE` | `NUXT_WP_BASE` tijdens de build (zie "API-base wijzigen"); in productie `https://cms.stichting-bam.nl/wp-json` |

Lokaal draaien gebruikt `.env` (zie `.env.example`), niet deze secrets.

### Deploy-doel en wat nooit wordt geraakt

Deploy-artefact is `dist/`, doel is `public_html/` op hetzelfde pakket als
`public_html/cms/` — de document root van de WordPress-installatie op
`cms.stichting-bam.nl`. Dat is een **aparte site**. De FTP-stap sluit hem
expres uit (`exclude: ['cms/**', 'cms']`) en synchroniseert nooit destructief
(`dangerous-clean-slate: false`): alleen bestanden die in `dist/` staan worden
geüpload of overschreven, er wordt nooit iets buiten die lijst verwijderd.

Ná elke niet-dry-run deploy controleert de workflow dat
`https://cms.stichting-bam.nl/wp-json/wp/v2/pages` nog precies 9 items geeft.
Slaat dat om, dan heeft de deploy WordPress geraakt en faalt de workflow
zodat dat meteen zichtbaar is. Het aantal (9) staat letterlijk in de workflow
(`EXPECTED_PAGE_COUNT`); komt er legitiem een 10e pagina bij, werk dat dan
bij — een `>=` in plaats van een exacte match zou een verwisseling dan
missen, precies het probleem dat deze controle moet vangen.

> **Bij de allereerste deploy staat er op `public_html/` nog een tijdelijke
> `.htaccess` met een 302 naar het subdomein.** Die moet **handmatig**
> verwijderd worden vóórdat de eerste automatische deploy iets oplevert —
> anders wint die 302 het van de `.htaccess` die deze workflow aanlevert.
> Buiten scope van deze workflow om te bouwen; alleen om nu voor te
> waarschuwen.

### Terugvallen op een vorige versie

Een oudere workflow-run **opnieuw draaien bouwt een nieuwe build vanuit de
HUIDIGE WordPress-content** — dat rolt de code terug, niet de content. Voor
een echte terugval naar een eerdere PUBLICATIE:

1. Elke geslaagde run bewaart zijn `dist/` als artefact
   (`static-build-<run-nummer>`, 30 dagen bewaard, mét dotfiles —
   `include-hidden-files: true`, anders zou `dist/.htaccess` ontbreken en zou
   dit artefact juist het bestand missen dat de site laat werken). Zoek in de
   Actions-tab de laatst bekende goede run op.
2. Download dat artefact (zip van de inhoud van `dist/`).
3. Upload die inhoud handmatig naar `public_html/` (dezelfde FTPS-gegevens als
   de workflow gebruikt) — dit gaat buiten de workflow om, bewust: een
   automatische "deploy dit oude artefact opnieuw"-knop zou zelf weer een
   destructieve actie zijn die evengoed fout kan gaan.

Een deploy zonder terugweg is geen deploy; vandaar dat elke run zijn eigen
artefact achterlaat, ook als er geen probleem is.

### Dry-run

`workflow_dispatch` met `dry_run: true` laat de FTP-actie zien wat er zou
gebeuren (`dry-run` staat aan bij `SamKirkland/FTP-Deploy-Action`) zonder iets
te uploaden. De WordPress-controle hierboven slaat dan ook over — er is dan
niets gedeployed om te controleren. Gebruik dit bij de eerste keer draaien.

> **Controleer bij die eerste (dry-run) run expliciet of `.htaccess` in de
> bestandslijst van de FTP-actie staat.** Dat bestand regelt ErrorDocument, de
> canonieke redirects en de cache-headers — zonder is de site kapot, ook al
> lijkt de deploy geslaagd. Er zijn bekende meldingen dat deze actie
> dotfiles soms overslaat (afhankelijk van de FTP-server); dat is dan ook de
> reden dat de tijdelijke 302 hierboven pas handmatig weg moet ná die
> controle, niet automatisch bij "de eerste run is groen".

### GitHub schakelt stille schedules uit

GitHub deactiveert een `schedule`-trigger automatisch als de repository **60
dagen** geen enkele commit heeft gehad — en dat gebeurt zonder melding.
Content komt hier vooral binnen via `repository_dispatch`, dus deze repo kan
maanden zonder commit zitten. Het vangnet dat hierboven bedoeld is voor "de
webhook viel stil" kan zo zelf stilvallen, op precies dezelfde manier. Check
in de Actions-tab (Settings → Actions → zie de laatste schedule-run) of de
schedule nog actief is als er lang niets is gecommit.

### Zelf getest, lokaal

- **Onbereikbare `WP_API_BASE` faalt vóór de upload.**
  `NUXT_WP_BASE=https://onbereikbaar.invalid/wp-json yarn release` breekt af
  in de `prerender:routes`-hook in `nuxt.config.ts` (`getaddrinfo ENOTFOUND`),
  exit-code 1, `dist/` blijft ongewijzigd. Omdat de FTP-stap in de workflow ná
  `yarn release` komt, kan die dan niet draaien.
- **Een ontbrekend HTML-bestand faalt de faal-check.** `over-ons/` tijdelijk
  aan de kant zetten in `.output/public` en `yarn verify` draaien geeft
  exit-code 1 met `ontbreekt: over-ons/index.html`. Verdwijnt een pagina uit
  de API zélf (in plaats van alleen de output), dan vangt de aparte
  `KNOWN_PAGE_SLUGS`-check dat met "bekende pagina … ontbreekt in de API" —
  dat is precies het verschil tussen deze twee checks (zie "De faal-check").

## API-base wijzigen

De basis-URL van de WordPress REST API staat in `runtimeConfig.wpBase` en
nergens anders in de code. Standaard:

```
https://www.stichting-bam.nl/wp-json
```

Overschrijven met een env-variabele, zonder codewijziging — nodig zodra
WordPress naar een ander adres verhuist:

```bash
NUXT_WP_BASE=https://acceptatie.example.nl/wp-json yarn release
```

`wpBase` staat bewust **niet** onder `runtimeConfig.public`: niets in de client
leest hem, en zo belandt de WP-URL niet in elke payload.

Zet daarnaast `NUXT_PUBLIC_SITE_URL` naar de publieke URL van déze frontend.
Die waarde wordt gebruikt voor canonical-tags, Open Graph-URL's, `robots.txt`
en `sitemap.xml`. Standaard `http://localhost:3000`.

```bash
NUXT_PUBLIC_SITE_URL=https://www.stichting-bam.nl yarn release
```

Zie `.env.example` voor beide variabelen. Er zijn **geen secrets**: alle calls
richting WordPress zijn anonieme GET-requests op publieke content.

## Architectuur

| Onderdeel | Locatie |
|---|---|
| Types op de echte response-shape | `server/utils/wp-types.ts` |
| API-client (`_fields`, `_embed`, media-cache, srcset) | `server/utils/wp-client.ts` |
| Content-transformatie (shortcodes, HTML-normalisatie) | `server/utils/wp-content.ts` |
| Documentopbouw + meta description | `server/utils/wp-documents.ts` |
| Interne API-routes (build-time) | `server/api/` |
| Registratie van mislukte API-calls | `server/utils/build-report.ts` |
| `robots.txt` en `sitemap.xml` | `server/routes/` |
| Hoofdmenu (handmatig) | `config/navigation.ts` |
| Content-styling | `assets/css/wp-content.css` |
| Faal-check op de build | `scripts/verify-build.mjs` |
| Deploy-artefact klaarzetten | `scripts/stage-release.mjs` |

Alle transformatie gebeurt in de Nitro-laag, en die draait **uitsluitend
tijdens de build**. De pagina's halen hun data op via `useFetch('/api/…')`;
tijdens het prerenderen worden die routes in-process uitgevoerd en het resultaat
belandt in de gerenderde HTML plus een `_payload.json` per route. In de
uitgeleverde site bestaat `/api/**` niet meer.

Dat is bewust geverifieerd: bij client-side navigatie haalt de app uitsluitend
`_payload.json` op en doet géén enkele `/api/**`-request. De `/api`-laag kon
daardoor blijven zoals hij was; hij verdwijnt simpelweg uit de output.

### Routes

- `/` — startpagina
- `/<slug>` — catch-all naar `/wp/v2/pages?slug=<slug>`; onbekende slug ⇒ echte 404
- `/nieuws` — berichtenoverzicht, pagina 1
- `/nieuws/pagina/<n>` — pagina 2 en verder; aantal pagina's uit `X-WP-TotalPages`
- `/nieuws/<slug>` — losse berichten
- `/robots.txt`, `/sitemap.xml` — opgebouwd uit de API

URL's met een slotslash (`/over-ons/`, zoals WordPress ze zelf gebruikt in
`link`) geven een 301 naar de variant zonder slash. Zie "Apache-configuratie"
voor de canonieke vorm.

Paginering loopt bewust via het **pad** en niet via een querystring
(`/nieuws?pagina=2`). Geprerenderde routes worden als statisch bestand
geserveerd op basis van het pad alleen; met een querystring krijg je dan de
HTML van pagina 1 terug en klopt de gerenderde uitvoer niet. Bij een statische
site op Apache geldt dat des te sterker: daar is geen enkele server die een
querystring kan interpreteren.

## Belangrijk: dit is géén Gutenberg-site

De opdracht ging uit van Gutenberg-blokken (`wp-block-image`, `wp-block-quote`,
`alignwide`, …). **Die komen op deze site niet voor — geen enkele
`wp-block-*`-klasse, in geen van de 9 pagina's of 7 berichten.**

De site draait op **WPBakery Page Builder** (Visual Composer) met het Onioneye
"qoon"-thema. `content.rendered` bevat daardoor **onverwerkte shortcodes**,
omdat WPBakery zijn shortcodes alleen in de thema-frontend uitvoert en niet in
de REST API.

De block-rendering is daarom gebouwd op wat er wél in de responses zit.

### Aangetroffen shortcodes en hoe ze worden behandeld

| Shortcode | Aantal | Behandeling |
|---|---|---|
| `[vc_row]`, `[vc_column]` | 62 / 96 | container uitgepakt, inhoud behouden |
| `[vc_column_text]` | 38 | container uitgepakt, inhoud behouden |
| `[vc_single_image image="ID"]` | 12 | **opgelost** naar een echte `<img>` met `srcset`, via `/wp/v2/media` |
| `[vc_video link="…"]` | 2 | responsive YouTube-/Vimeo-embed |
| `[vc_empty_space]` | 1 | verwijderd |
| `[rev_slider_vc alias="…"]` | 1 | verwijderd — zie "Wat niet werkt" |

De `css=".vc_custom_…{…}"`-payloads worden weggegooid; dat is per-pagina CSS
die het thema injecteert en die hier geen betekenis heeft.

### Gestylede klassen

Gestyled in `assets/css/wp-content.css`, na inventarisatie van alle pagina's en
berichten. Dit is bewust **niet** `wp-block-library.css`.

| Klasse | Voorkomens | Wat het is |
|---|---|---|
| `oi_border_position_bottom` | 70 | sierlijn onder een kop |
| `oi_ff_img_holder` | 49 | wrapper rond inline afbeeldingen |
| `img-responsive` | 49 | Bootstrap-restant uit het thema |
| `oi_custom_heading_holder` | 36 | kopblok |
| `oi_vc_heading` | 36 | kop binnen dat blok |
| `oi_icon_titile` | 36 | koptekst (**typefout zit in de bron**, overgenomen) |
| `oi_icon_sub_titile` | 36 | subkop |
| `oi_heading_icon` / `oi_heading_icon_center` | 35 / 35 | uitlijning van het kopblok |
| `oi_heading_border` | 35 | sierlijn-element |
| `oi_vc_button` | 9 | call-to-action-knop |
| `oi_vc_text` / `oi_vc_text_span` | 6 / 6 | tekstblok met eigen achtergrondkleur |
| `item_height_x1` / `item_height_x2` | 3 / 3 | minimale blokhoogte |
| `oi_border_position_none` | 1 | expliciet géén sierlijn |

Daarnaast de semantische tags die in de content voorkomen: `p`, `h2`–`h4`,
`ul`/`li`, `blockquote`, `hr`, `img`, `iframe`, `strong`/`em`.

**Niet gestyled, bewust:**

- `fa`, `fa-picture-o`, `fa-youtube`, `fa-vimeo-square` (35×) — FontAwesome-iconen.
  We laden FontAwesome niet; de lege `<i>`-elementen worden verwijderd in plaats
  van als leeg vierkantje te tonen.
- `p1`, `s2`, `Apple-converted-space` — resten van tekst die vanuit Word/Pages is
  geplakt. Er valt niets zinnigs te stylen; ze worden geneutraliseerd.

### Kapotte HTML uit WordPress

`wpautop` heeft de shortcodes in `<p>`-tags gewikkeld en daarmee de nesting
gesloopt, bijvoorbeeld:

```html
<div class="oi_vc_text_span"></p>
```

— een `</p>` zonder open `<p>`, met een `<div>` die nooit gesloten wordt.

Zulke HTML rauw in `v-html` zetten geeft **hydration-mismatch-warnings**: de
browser normaliseert de HTML bij het parsen, waardoor de DOM afwijkt van de
string die de server heeft gestuurd. Daarom wordt de content server-side
geparsed en opnieuw geserialiseerd met **cheerio** (dat parse5 gebruikt, de
echte HTML5-parser). De uitvoer is dan al genormaliseerd en identiek aan wat de
browser ervan maakt. Geverifieerd: de uitvoer is idempotent, en headless Chrome
laat op alle pagina's nul hydration-warnings zien.

## Media

`media_details.sizes` wordt gebruikt om een `srcset` op te bouwen — zowel voor
featured images als voor de 49 inline `<img>`-tags in de content, die in
WordPress allemaal naar het origineel op volle grootte wijzen (tot 2000px).

Twee formaten worden **uitgesloten** uit de `srcset`: `qoon_blog-wide`
(1240×400) en `thumbnail` (150×150). Dat zijn crops met een andere
beeldverhouding dan het origineel, geen schalingen; die in een width-based
`srcset` mengen laat de browser een verkeerd uitgesneden bestand kiezen. De
filtering gebeurt op beeldverhouding, niet op naam alleen.

Alle afbeeldingen in de content krijgen `loading="lazy"` en `decoding="async"`.

## Migratie naar headless

`MIGRATIE.md` beschrijft welke content wél en niet via de REST API beschikbaar
is, wat er per onderdeel nodig is om dat te veranderen, en welke twee punten een
volledige overstap blokkeren (het `event`-posttype en de homepage-slider).

## Wat niet werkt of handmatig is

**Het hoofdmenu is handmatig.** `/wp/v2/menu-items`, `/wp/v2/templates` en
`/wp/v2/template-parts` geven een **401** voor anonieme requests, en
`/wp/v2/navigation` is leeg. Het WP-menu is dus niet leesbaar zonder
authenticatie, en authenticatie valt buiten scope. Het menu staat daarom als
statische lijst in **`config/navigation.ts`** en moet met de hand worden
bijgewerkt als het menu in WordPress verandert.

**De startpagina heeft geen content in de API.** De WP-pagina `home` bestaat
volledig uit `[rev_slider_vc alias="tegen-tijd"]`. Revolution Slider publiceert
zijn slides niet via de REST API, dus die content is langs deze weg niet op te
halen. Er is geen vervangende tekst verzonnen: `/` wordt opgebouwd uit wél
beschikbare API-data (sitenaam uit `/wp-json/` en de laatste berichten). Krijgt
`home` in WordPress ooit echte content, dan verschijnt die automatisch.

**Pagina's met alleen een plugin-onderdeel.** `locaties`, `categorieen`, `tags`
en `mijn-reserveringen` bevatten in het CMS letterlijk alleen `<p>CONTENTS</p>`;
de ticketing-plugin vult ze in de originele frontend. Ze worden getoond met de
content die er is. Pagina's die na transformatie helemaal leeg zijn, tonen een
korte melding in plaats van een blanco pagina. Dit is verwacht gedrag, geen bug.

**De 7 berichten zijn demo-content.** Alle zeven bevatten identieke lorem
ipsum uit de thema-demo-import (14.330 tekens per stuk). Ze renderen correct,
maar de meta descriptions zijn daardoor onderling vrijwel gelijk. Dat is een
contentkwestie in WordPress, niet in deze frontend.

**Links naar uitvoeringspagina's blijven extern.** De pagina `uitvoeringen`
linkt naar zes onderliggende pagina's
(`/uitvoeringen/tegen-tijd/`, `/uitvoeringen/karavaan/`, …). Die geven op de
live site een 200, maar komen in **geen enkel REST-endpoint** voor: ze worden
door de ticketingplugin gegenereerd en zijn niet als post type geregistreerd
(`/wp/v2/types` kent alleen `post`, `page` en `attachment`). Ze zijn dus niet
op te halen, en ticketing valt buiten scope. Deze links worden daarom **niet**
naar een intern pad herschreven — dat zou een 404 opleveren — maar blijven naar
de WordPress-site wijzen, waar ze wel werken. Alleen links naar paden die deze
frontend echt serveert worden intern gemaakt.

**De startpagina heeft geen eigen meta description.** De sitebeschrijving in
WordPress is leeg en `home` heeft geen tekst. In plaats van een omschrijving te
verzinnen gebruikt `/` de intro van "Over ons" — echte CMS-tekst. Is die er ook
niet, dan krijgt de startpagina géén description in plaats van een bedachte.

**Caches leven zolang het proces leeft.** De media-index, de lijst met
serveerbare paden en de losse media-lookups worden per serverproces één keer
opgebouwd en daarna hergebruikt. Nieuwe uploads of nieuwe pagina's in WordPress
verschijnen dus pas na een herstart van de server (of een nieuwe build). Voor
een site die zelden wijzigt is dat prima; wie vaker publiceert, kan er een TTL
op zetten of het proces periodiek herstarten.

**De paginering van /nieuws wordt bij de build vastgelegd.** Het aantal
pagina's komt uit `X-WP-TotalPages`, maar `crawlLinks` bepaalt tijdens de build
welke `/nieuws/pagina/<n>`-routes statisch worden gegenereerd. Komt er een
achtste bericht bij, dan blijft de geprerenderde pagina 2 de oude inhoud tonen
tot er opnieuw gebouwd wordt; een eventuele pagina 3 wordt wel gewoon
server-side gerenderd. Na publiceren dus opnieuw builden.

**Lightbox.** De content bevat `data-rel="lightcase:…"`-attributen van een
lightbox-plugin die hier niet draait. Die attributen worden verwijderd; de
links naar de afbeelding op volle grootte blijven werken als gewone links.

**Alternatief dat níét is gekozen.** De WPBakery-shortcodes worden wél verwerkt
in de gewone HTML van `https://www.stichting-bam.nl/<slug>/`. Die pagina's
scrapen zou pixel-identieke opmaak geven, maar is een andere architectuur dan
gevraagd en trekt de volledige thema-CSS mee. Als pixel-gelijkheid met de
huidige site een eis wordt, is dat de route om te overwegen.

## Buiten scope

Reserveringen, ticketing, bestelflow en betalingen; contactformulieren
(`contact-form-7/v1` is met rust gelaten); schrijven naar WordPress;
authenticatie en application passwords; migratie of vervanging van WordPress.
WordPress blijft de bron.

## Geen credentials

Het project bevat geen `.env`, geen tokens en geen API-keys. Alle requests naar
WordPress zijn anonieme GET-requests. `.env` staat in `.gitignore`.
