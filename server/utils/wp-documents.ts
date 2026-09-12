import type {
  ContentDocument,
  PostListResult,
  WpMedia,
  WpPage,
  WpPost,
  WpEvent,
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
  toResolvedImage,
} from './wp-client'
import { htmlToText, stripShortcodes, transformContent, extractEventDescription, truncate } from './wp-content'
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

export async function getPostDocument(slug: string): Promise<ContentDocument | null> {
  const post = await fetchPostBySlug(slug)
  return post ? await toDocument(post) : null
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

async function toEventDocument(event: WpEvent): Promise<EventDocument> {
  const description = extractEventDescription(event.content.rendered)
  const { html, text } = await transformContent(description, siteUrl())
  const featuredImage = await resolveFeatured(event.featured_media)
  return {
    id: event.id,
    slug: event.slug,
    title: decodeTitle(event.title.rendered),
    html,
    description: buildDescription(event.excerpt?.rendered ?? '', text),
    date: event.date,
    modified: event.modified,
    featuredImage,
    isEmpty: html.length === 0,
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
export async function getEventList(): Promise<EventListResult> {
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
