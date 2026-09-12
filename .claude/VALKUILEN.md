# Valkuilen en hoe je ze aantoont

Elk punt hieronder is in dit project daadwerkelijk misgegaan en daarna
opgelost. Ze staan er niet als theorie maar als waarschuwing: dit zijn de
plekken waar het opnieuw stuk kan.

Onderaan staan de testrecepten die de fouten boven water haalden. Die zijn het
herbruikbare deel — ze zijn niet triviaal om opnieuw te bedenken.

---

## 1. Een build die slaagt met een lege pagina

**Symptoom.** `nuxt generate` eindigt met exit 0 en "Prerendered 40 routes",
maar de homepage bevat alleen kop en footer.

**Oorzaak.** WordPress gaf `508 Loop Detected` op `/api/page/home`. Omdat
`pages/index.vue` een `default:` op zijn `useFetch` heeft, viel de pagina stil
terug op lege data en rapporteerde de prerender geen fout.

**Waarom dit het gevaarlijkste geval is.** Een build die crasht merk je. Een
build die slaagt met een halve site wordt gepubliceerd en overschrijft een goede
versie.

**Opgelost met.** `nitro.prerender.concurrency: 2` en `interval: 300`, plus
`scripts/verify-build.mjs` die de output tegen de API legt.

**Let op.** Dit is verminderd, niet weg. Blijft de faal-check "API-call(s)
slaagden pas na een nieuwe poging" melden, dan zit je weer tegen de limiet aan.

## 2. Een guard die stilletjes alles uitzet

**Symptoom.** Het logbestand met API-fouten bleef leeg terwijl er aantoonbaar
een 508 was geweest. De controle op niet-2xx was dus in de praktijk niet
geïmplementeerd.

**Oorzaak.** De guard was `(import.meta as unknown as { prerender?: boolean }).prerender`.
Door die cast verving Nitro `import.meta.prerender` niet compile-time, maar
compileerde het naar `globalThis._importMeta_.prerender` — altijd `undefined`.

**Hoe je dit vindt.** Kijk naar de gecompileerde output, niet naar de bron:

```bash
grep -n -A4 "function isPrerendering" .nuxt/prerender/chunks/_/*.mjs
```

**Opgelost met.** Guard eruit; `server/utils/build-report.ts` registreert altijd
en `scripts/reset-report.mjs` maakt het log leeg aan het begin van elke build.

**Les.** Een guard die te streng is faalt stil. Test dat je faal-check echt
aanslaat, niet alleen dat hij bestaat.

## 3. `nuxt generate` leegt de outputmap vóór het bouwt

**Symptoom.** Na een mislukte build staat er 0 HTML in `.output/public`.

**Gevolg.** Een deployscript dat onvoorwaardelijk synchroniseert wist de live
site — precies wat de faal-check moest voorkomen.

**Opgelost met.** `dist/` als deploy-artefact, gevuld door
`scripts/stage-release.mjs` en alleen na een geslaagde verify.

## 4. Querystrings bestaan niet op statische hosting

**Symptoom.** `/nieuws?pagina=2` gaf de HTML van pagina 1, en `?pagina=99` gaf
200 in plaats van 404.

**Oorzaak.** Een geprerenderde route is een bestand; de querystring wordt
genegeerd. Dit gold al bij `nuxt build` met prerendering en geldt op Apache des
te sterker.

**Opgelost met.** Paginering via het pad: `/nieuws/pagina/2`.

## 5. Excerpts bevatten óók shortcodes

**Symptoom.** De nieuwskaartjes op de homepage toonden
`[vc_row][vc_column][vc_column_text]Dipiscing lorem...`.

**Oorzaak.** WordPress genereert de auto-excerpt uit de **ruwe** content,
inclusief shortcodes met hun `css=".vc_custom_…{…}"`-payload. Ik had
`stripShortcodes` wel op de meta descriptions toegepast, maar niet op de
lijstsamenvattingen.

**Waarom het lang onopgemerkt bleef.** Mijn shortcode-check greep alleen
`/over-ons` af — precies de pagina waar het niet zat. Het kwam pas boven water
door naar een screenshot te kijken.

**Opgelost met.** Eén gedeelde `excerptToText()` in `wp-documents.ts` waar beide
aanroepers doorheen gaan, en een check die **alle** routes afgaat.

## 6. Kapotte HTML geeft hydration-mismatches

**Symptoom.** Potentieel Vue-warnings in de console bij `v-html`.

**Oorzaak.** `wpautop` verminkt de nesting rond shortcodes, bijv.
`<div class="oi_vc_text_span"></p>` met een niet-gesloten `<div>`. De browser
normaliseert dat bij het parsen, waardoor de DOM afwijkt van de server-string.

**Opgelost met.** Server-side parsen en herserialiseren met cheerio (parse5).

**Aangetoond dat het nodig is:** ruw ≠ genormaliseerd, en de uitvoer is
idempotent:

```js
const once = cheerio.load(raw, null, false).html()
const twice = cheerio.load(once, null, false).html()
raw === once   // false -> de browser zou de DOM aanpassen
once === twice // true  -> onze uitvoer is stabiel
```

## 7. Transient fouten permanent negatief cachen

**Symptoom.** `/over-ons` verloor stil zijn `og:image` terwijl andere pagina's
die wel hadden.

**Oorzaak.** Eén mislukte media-lookup werd als "bestaat niet" gecachet voor de
rest van het proces — en dus voor de hele build.

**Opgelost met.** Alleen negatief cachen als de API daadwerkelijk antwoordde dat
het item er niet is. Bij een netwerk-/serverfout: niets cachen, plus retry met
backoff.

## 8. Nuxt draait niet onder Yarn PnP

**Symptoom.** `yarn install` faalt op de postinstall:
`Cannot resolve module "@nuxt/kit"`.

**Opgelost met.** `nodeLinker: node-modules` in `.yarnrc.yml`. Dat bestand is
dus geen cosmetiek — zonder is het project niet installeerbaar.

**Ook relevant:** npm 10.9.x (meegeleverd met Node 22) klapt eruit op de
peer-deps van Nuxt met `Cannot read properties of null (reading 'edgesOut')`.
npm 11+ werkt wel.

---

## Testrecepten

### Hydration-warnings echt meten

`curl` ziet ze niet; die verschijnen alleen in de browserconsole. Draai Chrome
headless met CDP, navigeer, en verzamel `Runtime.consoleAPICalled`,
`Log.entryAdded` en `Runtime.exceptionThrown`.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 \
  --user-data-dir=/tmp/cp --no-first-run --disable-gpu about:blank &
```

Filter `<Suspense> is an experimental feature` weg — die komt van Nuxt zelf en
staat op elke pagina.

### Client-side navigatie op de statische output

De vraag "gebruikt de app `_payload.json` of alsnog `/api/**`?" bepaalt of de
`/api`-laag kan blijven. Meet het: serveer de output statisch, klik via
`document.querySelector('a[href=...]').click()` en lees
`Network.requestWillBeSent`. Navigeer **niet** via de URL — dan test je een
koude load in plaats van client-side routing.

### De faal-check zelf testen met een mock-API

Zet een proxy voor de echte API die gericht faalt. Twee scenario's die er echt
toe doen:

- `slug=home` geeft 508 → bootst de storing na die de lege homepage opleverde
- de berichtenlijst geeft er maar 2 → bootst gedeeltelijke data na

Controleer per test drie dingen: exit-code 1, de melding van de faal-check, en
dat `dist/` nog de vorige goede build bevat.

### `.htaccess` echt testen

macOS heeft Apache aan boord. Schrijf een eigen `httpd.conf` met
`AllowOverride All` en laad `rewrite`, `headers`, `deflate`, `setenvif`, `dir`
en `expires` expliciet — die staan standaard uit.

```bash
/usr/sbin/httpd -f /pad/httpd.conf -t   # syntaxcheck
/usr/sbin/httpd -f /pad/httpd.conf -k start
```

De canonieke redirects in `public/.htaccess` slaan `localhost` over, juist zodat
dit kan zonder een tweede variant van het bestand. Vergelijk na de build altijd
`diff public/.htaccess dist/.htaccess` — anders test je mogelijk een oude kopie.

### Wachten op een server in een script

`curl` faalt direct bij een gesloten poort, dus een `for`-lus zonder pauze is in
een fractie van een seconde op. Gebruik:

```bash
curl -s --retry 30 --retry-delay 1 --retry-connrefused -o /dev/null http://localhost:3000/
```
