# Stichting BAM — headless frontend

Nuxt 3-frontend die de content van `https://www.stichting-bam.nl` uit de
WordPress REST API haalt en er een **volledig statische site** van bouwt voor
Apache-hosting zonder Node.

## Lees dit eerst

| Document | Waarvoor |
|---|---|
| `.claude/CONTEXT.md` | Waarom dingen zijn zoals ze zijn; openstaande punten |
| `.claude/VALKUILEN.md` | Fouten die al gemaakt zijn + testrecepten |
| `README.md` | Draaien, architectuur, Apache, faal-check |
| `MIGRATIE.md` | Welke WP-content wel/niet via de API komt |

## Commando's

```bash
corepack enable && yarn install
yarn dev            # ontwikkelen
yarn release        # generate + faal-check + klaarzetten in dist/
yarn typecheck
```

**Deploy de inhoud van `dist/`, nooit `.output/public`** — `nuxt generate` leegt
die map voordat het bouwt, dus een mislukte build laat daar niets achter.

## Vijf dingen die je makkelijk verkeerd doet

1. **Dit is geen Gutenberg-site.** Geen enkele `wp-block-*`-klasse; het is
   WPBakery met onverwerkte `[vc_row]`-shortcodes. De transformatielaag in
   `server/utils/wp-content.ts` is permanent, geen opruimklus.
2. **De WP-host throttelt** met `508 Loop Detected`. Verhoog
   `nitro.prerender.concurrency` niet zonder te meten; het heeft al een keer een
   build met een lege homepage opgeleverd.
3. **`.yarnrc.yml` is verplicht.** Nuxt werkt niet onder Yarn PnP.
4. **Querystrings werken niet** op statische hosting. Paginering loopt daarom via
   het pad: `/nieuws/pagina/2`.
5. **De faal-check is geen formaliteit.** `nuxt generate` slaagt gewoon met een
   kapotte site; alleen `scripts/verify-build.mjs` houdt dat tegen.

## Werkafspraken

- Alleen leesoperaties richting WordPress; anonieme GET, geen authenticatie,
  geen credentials in de repo.
- De live WordPress-site en het thema blijven ongemoeid.
- Ticketing, reserveringen en formulieren vallen buiten scope.
- Raak de block-rendering en styling niet aan tenzij daar expliciet om gevraagd
  wordt — die is afgestemd op de klassen die deze site daadwerkelijk gebruikt.
