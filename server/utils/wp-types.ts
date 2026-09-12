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
