# Migratie naar een headless frontend — stand van zaken

**Peildatum: 10 september 2026.** Alle bevindingen hieronder zijn geverifieerd
tegen de live REST API van `https://www.stichting-bam.nl/wp-json`, met anonieme
GET-requests.

## Uitgangspunt

WordPress blijft draaien inclusief het huidige thema (Onioneye "qoon" +
WPBakery Page Builder). De live site verandert niet. Daarnaast wordt deze Nuxt
3-frontend gebouwd, die WordPress **alleen als CMS** gebruikt en de theming zelf
doet.

De vraag die dit document beantwoordt: welke content is via de API bereikbaar,
welke niet, en wat is er per onderdeel nodig om dat te veranderen.

---

## 1. Wat werkt vandaag

| Content | Endpoint | Aantal | In de frontend |
|---|---|---|---|
| Pagina's | `/wp/v2/pages` | 9 | ✅ alle 9, op hun eigen slug |
| Berichten | `/wp/v2/posts` | 7 | ✅ `/nieuws` + detailpagina's |
| Media | `/wp/v2/media` | 127 | ✅ incl. `srcset` uit `media_details.sizes` |
| Categorieën | `/wp/v2/categories` | 5 | ⬜ beschikbaar, nog niet gebruikt |
| Tags | `/wp/v2/tags` | 5 | ⬜ beschikbaar, nog niet gebruikt |
| Auteurs | `/wp/v2/users` | 1 | ⬜ beschikbaar, nog niet gebruikt |
| Reacties | `/wp/v2/comments` | 0 | n.v.t. — staat leeg |
| Zoeken | `/wp/v2/search` | 16 | ⬜ dekt alleen `page` (9) + `post` (7) |

Dit is genoeg voor de redactionele kern van de site. De frontend rendert deze
content volledig server-side.

---

## 2. Wat niet via de API komt

### 2.1 Uitvoeringen — het zwaarstwegende punt

Er bestaat een custom post type **`event`** met 6 uitvoeringen:

```
/uitvoeringen/tegen-tijd/                                    → postid-2167
/uitvoeringen/karavaan/
/uitvoeringen/bam-voyage/
/uitvoeringen/zo-zonde/
/uitvoeringen/door-de-bril-van-annie-2-0/
/uitvoeringen/stichting-bam-presenteert-urinetown-de-musical/
```

Ze geven op de live site een 200 en de HTML draagt bodyclass `single-event`.
Maar via REST zijn ze onbereikbaar:

- `/wp/v2/types` kent alleen `post`, `page` en `attachment`
- `/wp/v2/event`, `/events`, `/tribe_events`, `/mec-events`, `/em_event`,
  `/evenement`, `/uitvoering`, `/uitvoeringen` → allemaal **404**
- `/wp/v2/posts/2167` en `/wp/v2/pages/2167` → **404**
- `/wp/v2/search` vindt ze niet (dekt alleen `page` + `post`)

**Oorzaak:** het post type is geregistreerd zonder `show_in_rest`. Dat is de
standaard voor custom post types uit plugins van vóór de REST-API.

**Wat er nodig is:** `show_in_rest => true` (plus een `rest_base`) voor dat post
type. Dat voegt uitsluitend endpoints toe en verandert niets aan hoe het thema
de pagina's rendert — de live site blijft dus intact. Het kan via een filter in
een mu-plugin, zonder de plugin zelf aan te raken.

**Zolang dat niet gebeurt:** de frontend kan uitvoeringen principieel niet
tonen. De links ernaartoe blijven daarom bewust naar de WordPress-site wijzen
(zie `getInternalPaths()` in `server/utils/wp-content.ts`). Een volledige
overstap is hiermee geblokkeerd — dit is het contenttype waar de stichting om
draait.

### 2.2 Revolution Slider op de homepage

De pagina `home` bestaat volledig uit `[rev_slider_vc alias="tegen-tijd"]`.
Slider Revolution 5.4.3.1 slaat zijn slides op in eigen databasetabellen en
publiceert die niet via REST. De homepage heeft dus geen redactionele content
in de API.

**Wat er nodig is:** de slidercontent ergens anders onderbrengen — als losse
pagina-inhoud, of als een eigen contenttype dat wél in REST staat. Er is geen
weg omheen via de API.

**Nu:** `/` wordt opgebouwd uit de sitenaam en de laatste berichten. Er is geen
vervangende tekst verzonnen.

### 2.3 Menu's

`/wp/v2/menu-items`, `/wp/v2/templates` en `/wp/v2/template-parts` geven **401**
voor anonieme requests; `/wp/v2/navigation` is leeg (het thema gebruikt klassieke
menu's, geen blokthema).

**Wat er nodig is:** ofwel authenticatie (application password) voor
`menu-items`, ofwel het menu blootstellen via een eigen read-only endpoint.

**Nu:** het hoofdmenu staat handmatig in `config/navigation.ts` en moet bij
wijzigingen met de hand worden bijgewerkt.

### 2.4 Instellingen

`/wp/v2/settings` geeft **401**. De sitenaam komt daarom uit de API-root
(`/wp-json/`), die wel anoniem leesbaar is. De sitebeschrijving is daar leeg.

---

## 3. Wat blijvend is, geen migratieklus

**De shortcode-laag verdwijnt niet.** Zolang de redactie in WPBakery werkt,
blijft `content.rendered` onverwerkte `[vc_row]`/`[vc_column]`/`[vc_column_text]`
shortcodes bevatten — WPBakery voert die alleen in de thema-frontend uit, niet
in REST. `server/utils/wp-content.ts` is dus een permanent onderdeel van de
architectuur, geen tijdelijke opruimlaag.

Datzelfde geldt voor het herstellen van de kapotte HTML: `wpautop` verminkt de
nesting rond shortcodes (`<div class="oi_vc_text_span"></p>`), en dat wordt
server-side met parse5 rechtgezet.

**Consequentie voor de planning:** als WPBakery ooit vervangen wordt door de
blok-editor, verandert de content-shape volledig en moet die laag opnieuw. Dat
is een apart traject, geen bijvangst van deze migratie.

---

## 4. Contentkwaliteit — los van de techniek

Twee dingen die opvallen en die geen technisch probleem zijn, maar wel bepalen
of de nieuwe site toonbaar is:

- **De 7 berichten zijn demo-content.** Alle zeven bevatten identieke lorem
  ipsum uit de thema-demo-import (14.330 tekens per stuk). De categorieën
  ("Innovations", "Lifestyle", "Video") en tags ("PHP", "Wordpress", "Awesome")
  komen uit diezelfde import. `/nieuws` toont dus zeven keer dezelfde
  nonsenstekst.
- **Vier pagina's bevatten alleen de placeholder `<p>CONTENTS</p>`**:
  `locaties`, `categorieen`, `tags`, `mijn-reserveringen`. De ticketingplugin
  vult ze in de originele frontend. In deze frontend zien ze eruit als kapotte
  pagina's, en ze staan in de sitemap.

  Voor `categorieen` en `tags` is dat oplosbaar zónder WordPress aan te raken:
  die taxonomieën staan wél in de API. `locaties` en `mijn-reserveringen` horen
  bij ticketing en vallen daarmee onder punt 2.1.

---

## 5. Beslispunten

| # | Vraag | Nodig in WP? | Blokkeert overstap? |
|---|---|---|---|
| 1 | Wordt `event` via REST beschikbaar gemaakt? | ja, `show_in_rest` | **ja** |
| 2 | Waar gaat de homepage-slidercontent heen? | ja | **ja** |
| 3 | Blijft het menu handmatig, of via auth/eigen endpoint? | mogelijk | nee |
| 4 | Wordt de demo-content vervangen door echte berichten? | ja (redactioneel) | nee |
| 5 | Worden `categorieen`/`tags` echte overzichtspagina's? | nee, frontend | nee |
| 6 | Blijft ticketing op WordPress draaien? | — | bepaalt 1 en 2 |

Punt 1 en 2 zijn de enige echte blokkades. Alles daaronder is af te handelen in
de frontend of is redactioneel werk.

---

## 6. Wat de frontend nu al doet

- Alle 9 pagina's en 7 berichten server-side gerenderd, met prerendering
- Shortcodes uitgepakt; `[vc_single_image]` opgelost naar echte `<img>` met
  `srcset`; `[vc_video]` naar responsive embeds
- Interne links alleen herschreven naar paden die deze frontend echt serveert;
  de rest wijst naar WordPress
- SEO: canonical, Open Graph met featured image, `robots.txt`, `sitemap.xml`
  uit de API
- Retry op alle externe calls, zodat een tijdelijke WP-storing geen halve
  build oplevert

Zie `README.md` voor het draaien, de architectuur en de bekende beperkingen.
