/**
 * Statische build voor shared hosting (Apache + PHP, geen Node.js).
 *
 * `nuxt generate` rendert alle routes bij de build tot platte HTML-bestanden in
 * `.output/public`. Er draait op de server niets van dit project; de
 * `server/`-map is uitsluitend build-time code.
 *
 * Bewust GEEN ISR/SWR/routeRules-caching: die vereisen een draaiende server en
 * zouden hier dode configuratie zijn.
 */

import { excludedPageSlugs } from './config/navigation'

/** Basis-URL van de WP REST API. Overschrijfbaar met NUXT_WP_BASE. */
const WP_BASE = (process.env.NUXT_WP_BASE || 'https://www.stichting-bam.nl/wp-json').replace(/\/$/, '')

/**
 * Haalt de te genereren routes op uit de API.
 *
 * `crawlLinks` alleen is niet genoeg: een pagina waar nergens naartoe gelinkt
 * wordt zou stil wegvallen. Daarom halen we de slugs expliciet op. Faalt dit,
 * dan gooien we — een build met een halve routelijst is precies het scenario
 * dat we willen voorkomen.
 */
async function fetchPrerenderRoutes(): Promise<string[]> {
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${WP_BASE}${path}`)
    if (!res.ok) {
      throw new Error(`WP API gaf ${res.status} ${res.statusText} op ${path}`)
    }
    return (await res.json()) as T
  }

  const [pages, posts, events] = await Promise.all([
    get<{ slug: string }[]>('/wp/v2/pages?per_page=100&_fields=slug'),
    get<{ slug: string }[]>('/wp/v2/posts?per_page=100&_fields=slug'),
    // Bestaat pas nadat wordpress/bam-events-rest.php op de server staat.
    // Faalt die call, dan gooien we net als bij pagina's/berichten — een
    // build zonder agenda is precies de halve build die we willen voorkomen.
    get<{ slug: string }[]>('/wp/v2/events?per_page=100&_fields=slug'),
  ])

  if (!pages.length || !posts.length) {
    throw new Error(`WP API gaf een lege lijst: ${pages.length} pagina's, ${posts.length} berichten`)
  }
  if (!events.length) {
    throw new Error(`WP API gaf een lege lijst voorstellingen (0 events)`)
  }

  // Aantal overzichtspagina's uit de echte response-header, niet geraden.
  const perPage = 6
  const head = await fetch(`${WP_BASE}/wp/v2/posts?per_page=${perPage}&page=1`)
  if (!head.ok) throw new Error(`WP API gaf ${head.status} op de berichtenlijst`)
  const totalPages = Number(head.headers.get('x-wp-totalpages') ?? 1)

  const excluded: readonly string[] = excludedPageSlugs
  const routes = new Set<string>(['/', '/nieuws', '/uitvoeringen', '/robots.txt', '/sitemap.xml'])
  for (const page of pages) {
    // `home` wordt op `/` gerenderd. Uitgesloten placeholderpagina's (zie
    // config/navigation.ts) krijgen bewust GEEN route: die worden niet meer
    // geserveerd, dus ook niet geprerenderd.
    if (page.slug === 'home' || excluded.includes(page.slug)) continue
    routes.add(`/${page.slug}`)
  }
  for (const post of posts) routes.add(`/nieuws/${post.slug}`)
  for (const evt of events) routes.add(`/uitvoeringen/${evt.slug}`)
  for (let n = 2; n <= totalPages; n++) routes.add(`/nieuws/pagina/${n}`)

  return [...routes]
}

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  // SSR aan: nodig om bij de build echte HTML te kunnen renderen.
  ssr: true,

  runtimeConfig: {
    // Server-/build-only. Env: NUXT_WP_BASE. Staat bewust niet onder `public`,
    // zodat de WP-URL niet in elke client-payload belandt.
    wpBase: WP_BASE,
    public: {
      // Canonical/OG-URL van deze frontend. Env: NUXT_PUBLIC_SITE_URL.
      siteUrl: 'http://localhost:3000',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'nl' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  css: ['~/assets/css/main.css', '~/assets/css/wp-content.css'],

  nitro: {
    // Levert een output zonder serverbundel: alleen platte bestanden.
    static: true,
    prerender: {
      crawlLinks: true,
      // Een route die faalt MOET de build laten mislukken. Een geslaagde build
      // met een lege site zou de goede versie overschrijven.
      failOnError: true,
      // 404.html is nodig voor ErrorDocument in .htaccess, maar Nitro
      // rendert die specifieke naam altijd als een client-only SPA-shell
      // (leeg totdat hydratie draait — zie .claude/VALKUILEN.md). Daarom
      // wordt ook `/404` geprerenderd: een gewone pagina (`pages/404.vue`)
      // die WEL gewoon server-side gerenderd wordt. `scripts/finalize-404.mjs`
      // kopieert die inhoud na het genereren over de lege `404.html` heen.
      routes: ['/404.html', '/404'],
      // WordPress staat op shared hosting en geeft `508 Loop Detected` zodra
      // je er parallel op los gaat. Met de standaardinstelling (8 routes
      // tegelijk, geen pauze) liep de build daar tegenaan: /api/page/home
      // faalde, de homepage viel terug op zijn `default` en de build slaagde
      // mét een lege homepage. Rustig aan doen is hier geen luxe maar
      // voorwaarde voor een betrouwbare build.
      concurrency: 2,
      interval: 300,
    },
  },

  hooks: {
    /**
     * Voegt de uit de API opgehaalde routes toe aan wat Nitro gaat prerenderen.
     * Draait één keer, vóór het prerenderen begint.
     */
    async 'prerender:routes'(ctx) {
      const routes = await fetchPrerenderRoutes()
      for (const route of routes) ctx.routes.add(route)
      console.info(`[prerender] ${routes.length} routes uit de API toegevoegd`)
    },
  },

  typescript: {
    strict: true,
  },
})
