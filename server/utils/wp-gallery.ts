import * as cheerio from 'cheerio'

/**
 * Haalt de EERSTE fotogalerij uit WordPress-content en geeft de content
 * zonder die galerij terug.
 *
 * Bewust een pure functie zonder Nuxt-afhankelijkheden (alleen cheerio), zodat
 * hij met `node --test` getest kan worden (tests/wp-gallery.test.mjs).
 *
 * Herkende vormen:
 *  - Gutenberg Galerij-blok (op deze site, okt 2026, bij alle evenementen):
 *    `figure.wp-block-gallery` > `figure.wp-block-image` > `img`
 *    (en de oudere variant met `ul.blocks-gallery-grid` > `li`);
 *  - klassieke `[gallery]`-shortcode: `div.gallery` > `.gallery-item`.
 *
 * Attachment-ID per foto, in deze volgorde: `data-id`, klasse
 * `wp-image-<id>`, `data-attachment-id` (op de img of een omhullende link).
 * Daarnaast per foto de `<img>`-attributen als terugval voor als de
 * media-API niet antwoordt.
 */

export interface GalleryFallbackItem {
  /** Attachment-ID, of null als de HTML er geen bevat. */
  id: number | null
  src: string
  srcset: string
  width: number
  height: number
  alt: string
  caption: string
}

export interface ExtractedGallery {
  /** Unieke attachment-ID's in de volgorde van WordPress (kan leeg zijn). */
  ids: number[]
  /** Eén item per foto, ook zonder ID; in de volgorde van WordPress. */
  fallbackItems: GalleryFallbackItem[]
  /** De content zonder de eerste galerij; ongewijzigd als er geen was. */
  contentWithoutGallery: string
}

const GALLERY_SELECTOR = 'figure.wp-block-gallery, div.wp-block-gallery, div.gallery'

function toInt(value: string | undefined): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function attachmentId($img: cheerio.Cheerio<any>): number | null {
  const fromData = toInt($img.attr('data-id'))
  if (fromData) return fromData
  const fromClass = toInt(($img.attr('class') ?? '').match(/\bwp-image-(\d+)\b/)?.[1])
  if (fromClass) return fromClass
  const fromAttachment = toInt($img.attr('data-attachment-id') ?? $img.closest('[data-attachment-id]').attr('data-attachment-id'))
  return fromAttachment || null
}

export function extractGallery(html: string): ExtractedGallery {
  const empty: ExtractedGallery = { ids: [], fallbackItems: [], contentWithoutGallery: html ?? '' }
  if (!html || !html.trim()) return empty

  const $ = cheerio.load(html, null, false)
  const gallery = $(GALLERY_SELECTOR).first()
  if (!gallery.length) return empty

  const fallbackItems: GalleryFallbackItem[] = []
  gallery.find('img').each((_, el) => {
    const $img = $(el)
    const src = $img.attr('src') ?? ''
    if (!src) return
    // Bijschrift per foto: Gutenberg zet het in de figure van de foto, de
    // klassieke galerij in .wp-caption-text / .gallery-caption.
    const holder = $img.closest('figure.wp-block-image, li, .gallery-item')
    const caption = holder.find('figcaption, .wp-caption-text, .gallery-caption').first().text().replace(/\s+/g, ' ').trim()
    fallbackItems.push({
      id: attachmentId($img),
      src,
      srcset: $img.attr('srcset') ?? '',
      width: toInt($img.attr('width')),
      height: toInt($img.attr('height')),
      alt: ($img.attr('alt') ?? '').trim(),
      caption,
    })
  })

  const ids = [...new Set(fallbackItems.map((item) => item.id).filter((id): id is number => id !== null))]

  gallery.remove()
  return { ids, fallbackItems, contentWithoutGallery: $.html() }
}
