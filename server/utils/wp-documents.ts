import type {
  ContentDocument,
  PostListResult,
  WpMedia,
  WpPage,
  WpPost,
  WpEvent,
  WpTerm,
  PostCategory,
  PostDocument,
  ContactDetails,
  CarouselItem,
  EventGalleryItem,
  EventDocument,
  EventSummary,
  EventListResult,
  EventFields,
} from './wp-types'
import {
  fetchMediaByIds,
  fetchPageBySlug,
  fetchPostBySlug,
  fetchPosts,
  fetchEventBySlug,
  fetchAllEvents,
  fetchHomeCarousel,
  toResolvedImage,
  buildSrcSet,
} from './wp-client'
import * as cheerio from 'cheerio'
import { extractGallery, type ExtractedGallery } from './wp-gallery'
import { htmlToText, stripShortcodes, transformContent, extractEventDescription, truncate, firstParagraphText } from './wp-content'
import { excludedPageSlugs } from '~~/config/navigation'

/** Publieke URL van de WP-site, afgeleid van de API-base uit runtimeConfig. */
export function siteUrl(): string {
  const base = String(useRuntimeConfig().wpBase)
  return base.replace(/\/wp-json\/?$/, '').replace(/\/$/, '')
}

/** Titels komen HTML-encoded uit WP (`Categorie&#235;n`). */
export function decodeTitle(rendered: string): string {
  return htmlToText(rendered)
}

async function resolveFeatured(id: number) {
  if (!id) return null
  const media = await fetchMediaByIds([id])
  const item = media.get(id)
  return item ? toResolvedImage(item) : null
}

/**
 * Maakt van `excerpt.rendered` bruikbare platte tekst.
 *
 * WP genereert de auto-excerpt uit de RUWE content en neemt daarbij de
 * WPBakery-shortcodes inclusief hun `css=".vc_custom_…{…}"`-payload mee. Zonder
 * strippen belandt die rommel in meta descriptions én in de samenvattingen op
 * de nieuwskaartjes. Iedereen die de excerpt gebruikt, gaat hier doorheen.
 */
function excerptToText(excerpt: string): string {
  return htmlToText(stripShortcodes(excerpt))
    .replace(/\[…\]$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Bepaalt de meta description: eerst `excerpt.rendered`, anders de eerste
 * alinea uit de getransformeerde content, in beide gevallen zonder HTML.
 * Blijft er van de excerpt te weinig over, dan is die onbruikbaar en vallen we
 * terug op de content.
 */
function buildDescription(excerpt: string, contentText: string): string {
  const fromExcerpt = excerptToText(excerpt)
  if (fromExcerpt.length >= 30) return truncate(fromExcerpt)
  return truncate(contentText)
}

async function toDocument(source: WpPage | WpPost): Promise<ContentDocument> {
  const { html, text } = await transformContent(source.content.rendered, siteUrl())
  const featuredImage = await resolveFeatured(source.featured_media)
  return {
    id: source.id,
    slug: source.slug,
    title: decodeTitle(source.title.rendered),
    html,
    description: buildDescription(source.excerpt?.rendered ?? '', text),
    lead: firstParagraphText(html),
    date: source.date,
    modified: source.modified,
    featuredImage,
    isEmpty: html.length === 0,
  }
}

export async function getPageDocument(slug: string): Promise<ContentDocument | null> {
  // Bewust uitgesloten placeholderpagina's (zie config/navigation.ts): ze
  // bestaan wel in wp/v2/pages, maar bevatten alleen `<p>CONTENTS</p>` — een
  // ticketing-placeholder die hier nooit iets zinnigs oplevert. Behandel ze
  // als niet-bestaand, dezelfde 404 als een écht onbekende slug.
  if ((excludedPageSlugs as readonly string[]).includes(slug)) return null

  const page = await fetchPageBySlug(slug)
  return page ? await toDocument(page) : null
}

/**
 * De standaardcategorie ("Geen categorie"; "Uncategorized" komt uit de
 * demo-import) zegt niets over een bericht en tonen we niet als label of
 * filter.
 */
const DEFAULT_CATEGORY_SLUGS = ['geen-categorie', 'uncategorized']

function postCategories(post: WpPost): PostCategory[] {
  const terms = (post._embedded?.['wp:term'] ?? []).flat() as WpTerm[]
  return terms
    .filter((t) => t.taxonomy === 'category' && !DEFAULT_CATEGORY_SLUGS.includes(t.slug))
    .map((t) => ({ id: t.id, name: decodeTitle(t.name), slug: t.slug }))
}

/** WordPress zet `[&hellip;]` achter een automatisch gegenereerde excerpt. */
function manualExcerpt(post: WpPost): string {
  const raw = post.excerpt?.rendered ?? ''
  if (!raw.trim() || /\[(&hellip;|…)\]/.test(raw)) return ''
  return excerptToText(raw)
}

export async function getPostDocument(slug: string): Promise<PostDocument | null> {
  const post = await fetchPostBySlug(slug)
  if (!post) return null
  const doc = await toDocument(post)
  const words = htmlToText(doc.html).split(/\s+/).filter(Boolean).length
  return {
    ...doc,
    categories: postCategories(post),
    readingMinutes: Math.max(1, Math.round(words / 200)),
    intro: manualExcerpt(post),
  }
}

/** Pakt de featured image uit `_embedded` (scheelt een request per bericht). */
function embeddedImage(post: WpPost) {
  const media = post._embedded?.['wp:featuredmedia']?.[0] as WpMedia | undefined
  if (!media?.media_details) return null
  return toResolvedImage(media)
}

export async function getPostList(page: number, perPage = 6): Promise<PostListResult> {
  const { posts, totalPages, total } = await fetchPosts(page, perPage)
  return {
    page,
    totalPages,
    total,
    items: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: decodeTitle(post.title.rendered),
      description: truncate(excerptToText(post.excerpt?.rendered ?? ''), 180),
      date: post.date,
      featuredImage: embeddedImage(post),
      categories: postCategories(post),
    })),
  }
}

// ============================================================================
// Events Manager: /uitvoeringen en /uitvoeringen/<slug>
// ============================================================================

/**
 * Events Manager zet zijn auto-excerpt zelf al samen als
 * "DD/MM/JJJJ [– DD/MM/JJJJ] @ UU:MM – UU:MM – <echte tekst>" (geverifieerd
 * tegen alle 7 voorstellingen). Wij tonen datum/tijd al apart, dus dat
 * voorvoegsel zou de omschrijving alleen maar dubbel laten lezen. Alleen hier
 * gebruikt — de gedeelde `excerptToText()` voor pagina's/berichten blijft
 * ongemoeid.
 */
function stripEventExcerptPrefix(text: string): string {
  return text.replace(/^\d{2}\/\d{2}\/\d{4}(\s*[–-]\s*\d{2}\/\d{2}\/\d{4})?\s*@\s*\d{2}:\d{2}\s*[–-]\s*\d{2}:\d{2}\s*[–-]\s*/, '')
}

function eventExcerptText(excerpt: string): string {
  return stripEventExcerptPrefix(excerptToText(excerpt))
}

/** Combineert een datum + tijd (of alleen datum bij een hele dag) tot een Date, voor de upcoming/past-vergelijking. */
function parseEventMoment(date: string | null, time: string | null): Date | null {
  if (!date) return null
  const parsed = new Date(time ? `${date}T${time}` : `${date}T23:59:59`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Of een voorstelling nog moet komen, bepaald op het moment van de BUILD:
 * deze site is statisch, dus "nu" bevriest tot de volgende `yarn release`
 * (zie ook README, "De paginering van /nieuws wordt bij de build
 * vastgelegd" voor hetzelfde principe). Geweest = de eindmoment (of, als er
 * geen eindtijd is, het einde van de einddag) ligt in het verleden. Een
 * voorstelling die op dit moment bezig is telt dus nog als "upcoming".
 */
function computeIsUpcoming(event: Pick<WpEvent, 'event_start_date' | 'event_end_date' | 'event_end_time' | 'event_all_day'>): boolean {
  const end = parseEventMoment(
    event.event_end_date ?? event.event_start_date,
    event.event_all_day ? null : event.event_end_time,
  )
  return end ? end.getTime() >= Date.now() : false
}

function eventFields(event: WpEvent): EventFields {
  return {
    startDate: event.event_start_date,
    endDate: event.event_end_date,
    startTime: event.event_all_day ? null : event.event_start_time,
    endTime: event.event_all_day ? null : event.event_end_time,
    allDay: Boolean(event.event_all_day),
    locationName: event.event_location_name,
    isUpcoming: computeIsUpcoming(event),
  }
}

/**
 * Zet de geëxtraheerde galerij om naar EventGalleryItem's, in de volgorde van
 * WordPress. Per foto de mediagegevens uit één verzoek naar wp/v2/media
 * (srcset uit media_details.sizes, alt, caption); lukt dat niet, of ontbreekt
 * een ID, dan de attributen van de <img> uit de HTML. Foto's zonder bruikbare
 * src/breedte/hoogte vallen eruit (zouden layout shift geven).
 */
async function resolveGallery(extracted: ExtractedGallery, slug: string): Promise<EventGalleryItem[]> {
  if (!extracted.fallbackItems.length) return []

  const media = extracted.ids.length ? await fetchMediaByIds(extracted.ids, { optional: true }) : new Map()
  const missing = extracted.ids.filter((id) => !media.has(id))
  if (missing.length) {
    console.warn(`[galerij ${slug}] ${missing.length} van ${extracted.ids.length} foto's niet uit de media-API; terugval op de HTML`)
  }

  const items: EventGalleryItem[] = []
  for (const fallback of extracted.fallbackItems) {
    const m = fallback.id ? media.get(fallback.id) : undefined
    const width = m?.media_details?.width || fallback.width
    const height = m?.media_details?.height || fallback.height
    const src = m?.media_details?.sizes?.large?.source_url || m?.source_url || fallback.src
    if (!src || !width || !height) continue
    items.push({
      id: fallback.id,
      src,
      srcset: (m ? buildSrcSet(m) : '') || fallback.srcset,
      width,
      height,
      alt: (m ? m.alt_text ?? '' : fallback.alt).trim(),
      caption: m?.caption?.rendered ? htmlToText(m.caption.rendered) : fallback.caption,
      orientation: height > width ? 'portrait' : 'landscape',
    })
  }
  return items
}

async function toEventDocument(event: WpEvent): Promise<EventDocument> {
  const description = extractEventDescription(event.content.rendered)
  // De eerste galerij krijgt een eigen sectie; uit de lopende tekst halen
  // zodat de foto's niet dubbel verschijnen.
  const extracted = extractGallery(description)
  const { html, text } = await transformContent(extracted.contentWithoutGallery, siteUrl())
  const featuredImage = await resolveFeatured(event.featured_media)
  const gallery = await resolveGallery(extracted, event.slug)
  // Na het weghalen van de galerij kunnen er alleen lege <p>'s (&nbsp;) over
  // zijn; dan is er geen beschrijving (de pagina laat de kop dan weg).
  const hasContent = text.trim().length > 0 || /<(img|iframe|video|audio)\b/i.test(html)
  return {
    id: event.id,
    slug: event.slug,
    title: decodeTitle(event.title.rendered),
    html: hasContent ? html : '',
    description: buildDescription(event.excerpt?.rendered ?? '', text),
    lead: firstParagraphText(html),
    date: event.date,
    modified: event.modified,
    featuredImage,
    isEmpty: !hasContent,
    gallery,
    ...eventFields(event),
  }
}

export async function getEventDocument(slug: string): Promise<EventDocument | null> {
  const event = await fetchEventBySlug(slug)
  return event ? await toEventDocument(event) : null
}

function embeddedEventImage(event: WpEvent) {
  const media = event._embedded?.['wp:featuredmedia']?.[0] as WpMedia | undefined
  if (!media?.media_details) return null
  return toResolvedImage(media)
}

/**
 * Komende voorstellingen oplopend op datum (eerstvolgende bovenaan), het
 * archief van geweest voorstellingen aflopend (meest recente bovenaan) — dat
 * laatste is bewust: deze agenda is op dit moment vooral een archief (6 van
 * de 7 voorstellingen liggen al achter ons), en een archief lees je van
 * nieuw naar oud, net als /nieuws.
 */
/**
 * Eén keer per build (proces): de header vraagt op ELKE pagina of er een
 * komende voorstelling is (knop "Kaarten"), en de WP-host throttelt. Alleen
 * een geslaagde fetch wordt bewaard. "Komend" wordt bij de build bepaald,
 * dus binnen één build is dit resultaat stabiel.
 */
let eventListPromise: Promise<EventListResult> | null = null

export function getEventList(): Promise<EventListResult> {
  eventListPromise ??= buildEventList().catch((error) => {
    eventListPromise = null
    throw error
  })
  return eventListPromise
}

async function buildEventList(): Promise<EventListResult> {
  const events = await fetchAllEvents()
  const summaries: EventSummary[] = events.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: decodeTitle(event.title.rendered),
    description: truncate(eventExcerptText(event.excerpt?.rendered ?? ''), 180),
    featuredImage: embeddedEventImage(event),
    ...eventFields(event),
  }))

  const byStartDate = (a: EventSummary, b: EventSummary) => (a.startDate ?? '').localeCompare(b.startDate ?? '')

  return {
    upcoming: summaries.filter((e) => e.isUpcoming).sort(byStartDate),
    past: summaries.filter((e) => !e.isUpcoming).sort(byStartDate).reverse(),
  }
}

// ============================================================================
// Contactgegevens (footer, /contact)
// ============================================================================

/**
 * Er is geen apart veld of endpoint voor contactgegevens. Ze staan wel als
 * lopende tekst in de WP-pagina `over-ons`, onder de kop "Contactgegevens":
 * twee lijstjes met naam + adresregels en "E-mail: …", "KvK-nummer: …" (plus
 * IBAN en telefoon, die het ontwerp niet toont en die we dus niet
 * uitlezen).
 *
 * Bewust TOLERANT: past de redactie de opmaak aan, dan valt een veld weg
 * (null/leeg) in plaats van dat de build faalt of er iets verkeerds staat.
 * We verzinnen niets en "repareren" de tekst niet (de postcode blijft zoals
 * hij in het CMS staat).
 */
export function parseContactDetails(html: string, siteName = 'Stichting BAM'): ContactDetails {
  const empty: ContactDetails = { email: null, addressLines: [], kvk: null }
  if (!html) return empty
  const $ = cheerio.load(html, null, false)
  const heading = $('h2, h3, h4').filter((_, el) => /contactgegevens/i.test($(el).text())).first()
  if (!heading.length) return empty

  // Alle lijstregels tussen deze kop en de volgende kop.
  const lists: string[][] = []
  let node = heading.next()
  while (node.length && !node.is('h1, h2, h3, h4')) {
    if (node.is('ul, ol')) {
      lists.push(node.find('li').toArray().map((li) => $(li).text().replace(/\s+/g, ' ').trim()).filter(Boolean))
    }
    node = node.next()
  }
  const lines = lists.flat()

  const email = lines.join(' ').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? null
  const kvk = lines.map((l) => l.match(/^kvk[^:]*:\s*([\d\s]+)$/i)?.[1]?.replace(/\s/g, '')).find(Boolean) ?? null
  // Adres = regels zonder "label:" uit het eerste lijstje, minus de naam.
  const addressLines = (lists[0] ?? []).filter((l) => !l.includes(':') && l.toLowerCase() !== siteName.toLowerCase())

  return { email, addressLines, kvk }
}

/**
 * Eén keer per build (proces) ophalen: de footer vraagt dit op elke pagina,
 * en de WP-host throttelt. Alleen een geslaagde fetch wordt bewaard.
 */
let contactPromise: Promise<ContactDetails> | null = null

export function getContactDetails(): Promise<ContactDetails> {
  contactPromise ??= getPageDocument('over-ons')
    .then((doc) => parseContactDetails(doc?.html ?? ''))
    .catch((error) => {
      contactPromise = null
      throw error
    })
  return contactPromise
}

// ============================================================================
// Homepage-carrousel
// ============================================================================

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const posInt = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0)

/**
 * De foto's voor de carrousel, in de volgorde van de redactie.
 *
 * Nooit een fout naar de pagina: bij een mislukte call (al vastgelegd als
 * `optional`, zie fetchHomeCarousel) of een onverwacht antwoord een
 * waarschuwing in de buildlog en `[]` — de homepage laat de scène dan weg.
 * Items zonder bruikbare `src`/`width`/`height` vallen eruit; die zouden
 * layout shift of een kapot beeld geven.
 */
export async function getHomeCarousel(): Promise<CarouselItem[]> {
  let raw: unknown
  try {
    raw = await fetchHomeCarousel()
  } catch (error) {
    console.warn(`[home-carousel] niet opgehaald, carrousel wordt weggelaten: ${(error as Error)?.message ?? error}`)
    return []
  }
  if (!Array.isArray(raw)) {
    console.warn('[home-carousel] onverwacht antwoord (geen array), carrousel wordt weggelaten')
    return []
  }

  const items: CarouselItem[] = []
  for (const entry of raw as Record<string, unknown>[]) {
    const id = posInt(entry?.id)
    const width = posInt(entry?.width)
    const height = posInt(entry?.height)
    const src = str(entry?.src)
    if (!id || !width || !height || !/^https?:\/\//.test(src)) continue
    items.push({
      id,
      src,
      srcset: str(entry.srcset),
      width,
      height,
      full: str(entry.full) || src,
      alt: str(entry.alt).trim(),
      caption: str(entry.caption).trim(),
      portrait: height > width,
    })
  }
  if (items.length < raw.length) {
    console.warn(`[home-carousel] ${raw.length - items.length} item(s) overgeslagen wegens ontbrekende src/width/height`)
  }
  return items
}
