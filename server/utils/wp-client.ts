import type { WpMedia, WpPage, WpPost, WpEvent, ResolvedImage } from './wp-types'
import { recordApiFailure } from './build-report'

/**
 * Dunne, getypeerde client op de WP REST API.
 *
 * Alleen leesoperaties (GET). Er wordt nergens geauthenticeerd en er worden
 * geen credentials meegestuurd; de API van stichting-bam.nl staat open voor
 * anonieme GET-requests.
 */

/** Base-URL uit runtimeConfig; nooit hardcoded in de rest van de code. */
function wpBase(): string {
  const base = useRuntimeConfig().wpBase
  return String(base).replace(/\/$/, '')
}

/** Alleen deze velden opvragen scheelt fors in responsegrootte. */
const DOC_FIELDS = 'id,slug,link,date,modified,title,content,excerpt,parent,featured_media'
const LIST_FIELDS = 'id,slug,link,date,modified,title,excerpt,featured_media,_links,_embedded'
const MEDIA_FIELDS = 'id,slug,alt_text,mime_type,source_url,media_details'

/** De `event_*`-velden komen van `wordpress/bam-events-rest.php`, niet van de CPT zelf. */
const EVENT_EXTRA_FIELDS =
  'event_start_date,event_end_date,event_start_time,event_end_time,event_all_day,event_location_name'
const EVENT_DOC_FIELDS = `id,slug,link,date,modified,title,content,excerpt,featured_media,${EVENT_EXTRA_FIELDS}`
const EVENT_LIST_FIELDS = `id,slug,link,date,modified,title,excerpt,featured_media,_links,_embedded,${EVENT_EXTRA_FIELDS}`

/**
 * `_embed` werkt op deze installatie ALLEEN als `_links` ook in `_fields` staat;
 * zonder `_links` komt `_embedded` niet mee. Geverifieerd tegen de live API.
 */

type WpQuery = Record<string, string | number>

/**
 * `$fetch` met Nitro's route-typing uitgeschakeld.
 *
 * Nitro probeert elke `$fetch`-URL te matchen tegen de interne API-routes van
 * dit project. Bij een absolute URL naar een externe API loopt die
 * type-inferentie vast ("Excessive stack depth"). We praten hier met
 * WordPress, niet met onszelf, dus die inferentie voegt niets toe.
 */
const externalFetch = $fetch as unknown as {
  <T>(url: string, opts?: { query?: WpQuery }): Promise<T>
  raw: <T>(url: string, opts?: { query?: WpQuery }) => Promise<{ _data?: T; headers: Headers }>
}

/**
 * Eén tot drie pogingen bij een tijdelijke fout. WordPress is een externe
 * afhankelijkheid en tijdens het prerenderen vuren we veel requests kort na
 * elkaar af; een incidentele 5xx of 429 mag de build niet stilletjes uithollen.
 * Echte clientfouten (404, 400) worden niet opnieuw geprobeerd.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4, url = '(onbekend)'): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error
      const status =
        (error as { status?: number })?.status ?? (error as { statusCode?: number })?.statusCode ?? null
      const fatal = Boolean(status && status < 500 && status !== 429)
      const lastAttempt = attempt === attempts - 1

      // Elke definitief mislukte call vastleggen, ook als de aanroeper hem
      // straks opvangt. Zie server/utils/build-report.ts.
      const message = (error as { message?: string })?.message ?? String(error)
      if (fatal || lastAttempt) {
        recordApiFailure({ url, status, message, severity: 'failed' })
      } else {
        // Deze poging mislukte, maar we gaan het opnieuw proberen. Slaagt dat,
        // dan is het geen bouwfout — wel het vastleggen waard, zodat zichtbaar
        // blijft hoe dicht de build bij de limiet van de WP-host zat.
        recordApiFailure({ url, status, message, severity: 'recovered' })
        // 500 ms, 1 s, 2 s. Een 508/429 van shared hosting is een throttle; die
        // heeft echt even tijd nodig voordat een nieuwe poging zin heeft.
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
      }

      if (fatal) throw error
    }
  }
  throw lastError
}

/**
 * GET op een absolute WordPress-URL, met dezelfde retry als de rest.
 * Gebruik deze in plaats van `$fetch` direct, zodat elke externe aanroep
 * dezelfde behandeling van tijdelijke storingen krijgt.
 */
export async function wpGet<T>(url: string, query: WpQuery = {}): Promise<T> {
  return await withRetry(() => externalFetch<T>(url, { query }), 4, url)
}

async function wpFetch<T>(path: string, query: WpQuery): Promise<T> {
  return await withRetry(() => externalFetch<T>(`${wpBase()}${path}`, { query }), 4, `${wpBase()}${path}`)
}

/** Als bovenstaande, maar geeft ook de response-headers terug (voor X-WP-TotalPages). */
async function wpFetchWithHeaders<T>(
  path: string,
  query: WpQuery,
): Promise<{ data: T; headers: Headers }> {
  const res = await withRetry(() => externalFetch.raw<T>(`${wpBase()}${path}`, { query }), 4, `${wpBase()}${path}`)
  return { data: res._data as T, headers: res.headers }
}

export async function fetchPageBySlug(slug: string): Promise<WpPage | null> {
  const pages = await wpFetch<WpPage[]>('/wp/v2/pages', {
    slug,
    per_page: 1,
    _fields: DOC_FIELDS,
  })
  return pages[0] ?? null
}

export async function fetchAllPageSlugs(): Promise<Pick<WpPage, 'slug' | 'modified' | 'title'>[]> {
  return await wpFetch('/wp/v2/pages', { per_page: 100, _fields: 'slug,modified,title' })
}

export async function fetchPostBySlug(slug: string): Promise<WpPost | null> {
  const posts = await wpFetch<WpPost[]>('/wp/v2/posts', {
    slug,
    per_page: 1,
    _fields: `${DOC_FIELDS},categories,tags`,
  })
  return posts[0] ?? null
}

export async function fetchPosts(page: number, perPage: number) {
  const { data, headers } = await wpFetchWithHeaders<WpPost[]>('/wp/v2/posts', {
    page,
    per_page: perPage,
    _embed: 1,
    _fields: LIST_FIELDS,
  })
  // Paginering op basis van de echte response-header, niet op een geraden aantal.
  return {
    posts: data,
    totalPages: Number(headers.get('x-wp-totalpages') ?? 1),
    total: Number(headers.get('x-wp-total') ?? data.length),
  }
}

export async function fetchAllPostSlugs(): Promise<Pick<WpPost, 'slug' | 'modified'>[]> {
  return await wpFetch('/wp/v2/posts', { per_page: 100, _fields: 'slug,modified' })
}

/**
 * `/wp/v2/events` bestaat pas nadat `wordpress/bam-events-rest.php` op de
 * server staat (zet `show_in_rest` op het `event`-posttype, zie dat bestand).
 * Zolang dat er niet is geeft WordPress hier een 404 — net als bij elke
 * andere lijst hierboven laten we die fout gewoon omhoog bubbelen: een build
 * die daardoor faalt is beter dan een build die de agenda stil weglaat.
 */
export async function fetchEventBySlug(slug: string): Promise<WpEvent | null> {
  const events = await wpFetch<WpEvent[]>('/wp/v2/events', {
    slug,
    per_page: 1,
    _fields: EVENT_DOC_FIELDS,
  })
  return events[0] ?? null
}

/**
 * Alle voorstellingen. Geen paginering: Events Manager op deze site houdt
 * een archief van voorstellingen bij (op dit moment 7), geen doorlopende
 * stroom zoals berichten — mocht dat ooit boven de 100 uitkomen, dan is
 * paginering hier net zo nodig te maken als bij `fetchPosts`.
 */
export async function fetchAllEvents(): Promise<WpEvent[]> {
  return await wpFetch<WpEvent[]>('/wp/v2/events', {
    per_page: 100,
    _embed: 1,
    _fields: EVENT_LIST_FIELDS,
  })
}

export async function fetchAllEventSlugs(): Promise<Pick<WpEvent, 'slug' | 'modified'>[]> {
  return await wpFetch('/wp/v2/events', { per_page: 100, _fields: 'slug,modified' })
}

/**
 * Media-cache per request-context. 127 media-items en veel herhaling
 * (dezelfde afbeelding in meerdere shortcodes), dus batching + cache loont.
 */
const mediaCache = new Map<number, WpMedia | null>()

/** Haalt meerdere media-items in één request op (`include=1,2,3`). */
export async function fetchMediaByIds(ids: number[]): Promise<Map<number, WpMedia>> {
  const result = new Map<number, WpMedia>()
  const missing: number[] = []

  for (const id of new Set(ids)) {
    const cached = mediaCache.get(id)
    if (cached === undefined) missing.push(id)
    else if (cached !== null) result.set(id, cached)
  }

  if (missing.length) {
    try {
      const items = await wpFetch<WpMedia[]>('/wp/v2/media', {
        include: missing.join(','),
        per_page: missing.length,
        _fields: MEDIA_FIELDS,
      })
      for (const item of items) {
        mediaCache.set(item.id, item)
        result.set(item.id, item)
      }
      // De API antwoordde: ID's die er niet in zaten bestaan echt niet. Die
      // mogen negatief gecachet worden.
      for (const id of missing) if (!result.has(id)) mediaCache.set(id, null)
    } catch {
      // De API antwoordde NIET. Bewust niets cachen: een tijdelijke storing
      // negatief cachen zou de afbeelding voor de rest van het proces laten
      // verdwijnen — en tijdens een build dus uit alle geprerenderde pagina's.
      // De afbeelding valt nu alleen weg bij dit ene request.
    }
  }

  return result
}

/**
 * Bouwt een width-based srcset uit `media_details.sizes`.
 *
 * Bewust NIET meegenomen: `qoon_blog-wide` (1240x400) en `thumbnail` (150x150).
 * Dat zijn crops met een andere beeldverhouding dan het origineel; die in een
 * width-srcset mengen laat de browser een verkeerd uitgesneden bestand kiezen.
 */
export function buildSrcSet(media: WpMedia): string {
  const full = media.media_details
  const candidates: { url: string; width: number }[] = []
  const ratio = full.width && full.height ? full.width / full.height : 0

  for (const [name, size] of Object.entries(full.sizes ?? {})) {
    if (!size || name === 'qoon_blog-wide' || name === 'thumbnail' || name === 'post-thumbnail') continue
    const sizeRatio = size.width / size.height
    // Alleen formaten met (vrijwel) dezelfde beeldverhouding: dat zijn schalingen,
    // geen crops.
    if (ratio && Math.abs(sizeRatio - ratio) > 0.02) continue
    candidates.push({ url: size.source_url, width: size.width })
  }

  if (!candidates.some((c) => c.url === media.source_url) && full.width) {
    candidates.push({ url: media.source_url, width: full.width })
  }

  return candidates
    .sort((a, b) => a.width - b.width)
    .map((c) => `${c.url} ${c.width}w`)
    .join(', ')
}

/**
 * Kiest de beste variant voor Open Graph: het grootste formaat met dezelfde
 * beeldverhouding tot ca. 1200px breed. Valt terug op het origineel.
 */
function pickOgVariant(media: WpMedia): { src: string; width: number; height: number } {
  const { width, height, sizes } = media.media_details
  const ratio = width && height ? width / height : 0
  let best = { src: media.source_url, width, height }
  let bestWidth = width > 1200 ? -1 : width

  for (const [name, size] of Object.entries(sizes ?? {})) {
    if (!size || size.width > 1200) continue
    if (ratio && Math.abs(size.width / size.height - ratio) > 0.02) continue
    if (name === 'thumbnail') continue
    if (size.width > bestWidth) {
      bestWidth = size.width
      best = { src: size.source_url, width: size.width, height: size.height }
    }
  }
  return best
}

/** Zet een WpMedia om naar het genormaliseerde formaat dat de frontend gebruikt. */
export function toResolvedImage(media: WpMedia): ResolvedImage {
  return {
    id: media.id,
    src: media.source_url,
    srcset: buildSrcSet(media),
    width: media.media_details.width,
    height: media.media_details.height,
    alt: media.alt_text ?? '',
    og: pickOgVariant(media),
  }
}
