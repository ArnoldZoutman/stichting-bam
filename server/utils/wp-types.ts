/**
 * TypeScript-interfaces voor de WP REST API van stichting-bam.nl.
 *
 * Deze types zijn afgeleid van de DAADWERKELIJKE responses van de site
 * (opgehaald met `context=view`), niet van de generieke WP-documentatie.
 * Velden die de site wel teruggeeft maar die wij niet gebruiken zijn
 * bewust weggelaten; we vragen ze ook niet op via `_fields`.
 */

/** Een `{ rendered: string }`-wrapper, zoals WP die voor titel/content/excerpt gebruikt. */
export interface WpRendered {
  rendered: string
}

/** Eén gegenereerd afbeeldingsformaat uit `media_details.sizes`. */
export interface WpMediaSize {
  file: string
  width: number
  height: number
  mime_type: string
  source_url: string
}

/**
 * Op deze site aanwezige formaten. `qoon_blog-wide` is een thema-specifieke
 * CROP (1240x400) en dus niet schaalgelijk aan de rest — die laten we uit de
 * srcset (zie `buildSrcSet`). De sleutels zijn optioneel: kleinere uploads
 * krijgen niet alle formaten.
 */
export interface WpMediaSizes {
  thumbnail?: WpMediaSize
  medium?: WpMediaSize
  medium_large?: WpMediaSize
  large?: WpMediaSize
  'post-thumbnail'?: WpMediaSize
  'qoon_blog-wide'?: WpMediaSize
  full?: WpMediaSize
  [key: string]: WpMediaSize | undefined
}

export interface WpMediaDetails {
  width: number
  height: number
  file?: string
  sizes: WpMediaSizes
}

export interface WpMedia {
  id: number
  slug: string
  alt_text: string
  mime_type: string
  source_url: string
  media_details: WpMediaDetails
  caption?: WpRendered
}

/** Genormaliseerde afbeelding zoals onze frontend hem gebruikt. */
export interface ResolvedImage {
  id: number
  src: string
  srcset: string
  width: number
  height: number
  alt: string
  /**
   * Variant voor Open Graph. Social-platforms hebben een limiet op
   * bestandsgrootte; het origineel is hier tot 2000x2000. Dit is het grootste
   * gegenereerde formaat met dezelfde beeldverhouding tot ca. 1200px.
   */
  og: { src: string; width: number; height: number }
}

export interface WpPage {
  id: number
  slug: string
  link: string
  date: string
  modified: string
  title: WpRendered
  content: WpRendered
  excerpt: WpRendered
  parent: number
  featured_media: number
}

export interface WpPost {
  id: number
  slug: string
  link: string
  date: string
  modified: string
  title: WpRendered
  content: WpRendered
  excerpt: WpRendered
  featured_media: number
  categories: number[]
  tags: number[]
  _links?: Record<string, unknown>
  _embedded?: {
    'wp:featuredmedia'?: WpMedia[]
    'wp:term'?: WpTerm[][]
  }
}

export interface WpTerm {
  id: number
  name: string
  slug: string
  taxonomy: string
}

/**
 * Het `event`-posttype (Events Manager), zoals `wordpress/bam-events-rest.php`
 * hem in de REST API zet. De `event_*`-velden komen niet van de CPT zelf maar
 * zijn door die mu-plugin toegevoegd via `register_rest_field`, rechtstreeks
 * uit het `EM_Event`-object — vandaar de losse velden in plaats van
 * postmeta. Datums/tijden zijn de RUWE Events Manager-notatie ('Y-m-d' /
 * 'H:i:s', al ISO), niet de Nederlandse weergavenotatie van de plugin.
 *
 * Alle velden zijn nullable: de mu-plugin geeft bewust `null` in plaats van
 * een fatal error zodra Events Manager niet actief is of het event niet meer
 * bestaat (zie de comment in bam-events-rest.php).
 */
export interface WpEvent {
  id: number
  slug: string
  link: string
  date: string
  modified: string
  title: WpRendered
  content: WpRendered
  excerpt: WpRendered
  featured_media: number
  event_start_date: string | null
  event_end_date: string | null
  event_start_time: string | null
  event_end_time: string | null
  event_all_day: boolean | null
  event_location_name: string | null
  _links?: Record<string, unknown>
  _embedded?: {
    'wp:featuredmedia'?: WpMedia[]
  }
}

/** Datum/tijd/locatie-velden die pagina's en berichten niet hebben. */
export interface EventFields {
  startDate: string | null
  endDate: string | null
  /** Null bij een event dat de hele dag beslaat, of zonder tijd in Events Manager. */
  startTime: string | null
  endTime: string | null
  allDay: boolean
  locationName: string | null
  /**
   * Bepaald op het moment van de BUILD (deze site is statisch): `true` zodra
   * de einddatum/-tijd van het event nog niet voorbij is. Bevriest dus tot de
   * volgende `yarn release`.
   */
  isUpcoming: boolean
}

/** Wat onze eigen /api-routes teruggeven aan de pagina's. */
export interface ContentDocument {
  id: number
  slug: string
  title: string
  /** Getransformeerde, hydratie-veilige HTML. Kan leeg zijn. */
  html: string
  /** Platte tekst voor meta description. */
  description: string
  date: string
  modified: string
  featuredImage: ResolvedImage | null
  /** True als er na transformatie geen renderbare content overbleef. */
  isEmpty: boolean
}

export interface PostSummary {
  id: number
  slug: string
  title: string
  description: string
  date: string
  featuredImage: ResolvedImage | null
}

export interface PostListResult {
  items: PostSummary[]
  page: number
  totalPages: number
  total: number
}

/** Wat `/api/event/<slug>` teruggeeft aan de detailpagina. */
export interface EventDocument extends ContentDocument, EventFields {}

/** Wat `/api/events` teruggeeft aan het agenda-overzicht. */
export interface EventSummary extends EventFields {
  id: number
  slug: string
  title: string
  description: string
  featuredImage: ResolvedImage | null
}

export interface EventListResult {
  upcoming: EventSummary[]
  past: EventSummary[]
}
