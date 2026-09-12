import type { ContentDocument, PostListResult, WpMedia, WpPage, WpPost } from './wp-types'
import {
  fetchMediaByIds,
  fetchPageBySlug,
  fetchPostBySlug,
  fetchPosts,
  toResolvedImage,
} from './wp-client'
import { htmlToText, stripShortcodes, transformContent, truncate } from './wp-content'

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
