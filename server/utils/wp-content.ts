import * as cheerio from 'cheerio'
import type { WpMedia } from './wp-types'
import {
  fetchMediaByIds,
  buildSrcSet,
  wpGet,
  fetchAllPageSlugs,
  fetchAllPostSlugs,
  fetchAllEventSlugs,
} from './wp-client'
import { excludedPageSlugs } from '~~/config/navigation'

/**
 * ============================================================================
 * WAT DEZE SITE ÉCHT TERUGGEEFT — en waarom dit géén Gutenberg-renderer is
 * ============================================================================
 *
 * De opdracht ging uit van Gutenberg-blokken (`wp-block-image`, `wp-block-quote`,
 * `alignwide`, ...). Een inventarisatie van alle 9 pagina's en 7 berichten laat
 * zien dat er op deze site GEEN ENKELE `wp-block-*`-klasse voorkomt. Nul.
 *
 * De site draait op WPBakery Page Builder (Visual Composer) met het Onioneye
 * "qoon"-thema. `content.rendered` bevat daarom ONVERWERKTE shortcodes, omdat
 * WPBakery zijn shortcodes alleen in de thema-frontend uitvoert en niet in REST.
 *
 * AANGETROFFEN SHORTCODES (geteld over alle pagina's + berichten):
 *   [vc_row] x62, [vc_column] x96   -> layoutcontainers, uitgepakt (inhoud blijft)
 *   [vc_column_text] x38            -> tekstcontainer, uitgepakt
 *   [vc_single_image image="ID"] x12 -> OPGELOST naar een echte <img> via /wp/v2/media
 *   [vc_video link="..."] x2        -> omgezet naar responsive YouTube/Vimeo-embed
 *   [vc_empty_space] x1             -> verwijderd
 *   [rev_slider_vc alias="..."] x1  -> NIET herstelbaar (Revolution Slider zit niet
 *                                       in de REST API). Zie README.
 *
 * AANGETROFFEN EN GESTYLEDE HTML-KLASSEN (in assets/css/wp-content.css):
 *   oi_vc_text, oi_vc_text_span            (tekstblok met achtergrond)
 *   oi_custom_heading_holder, oi_vc_heading (kopblok)
 *   oi_icon_titile, oi_icon_sub_titile      (typefout zit in de bron; overgenomen)
 *   oi_heading_icon, oi_heading_icon_center
 *   oi_heading_border, oi_border_position_bottom, oi_border_position_none
 *   oi_vc_button                            (call-to-action-knop)
 *   oi_ff_img_holder, img-responsive        (afbeeldingswrappers)
 *   item_height_x1, item_height_x2          (minimale bloghoogte)
 *   fa, fa-picture-o, fa-youtube, ...       -> NIET gestyled; lege <i>-iconen
 *                                              worden verwijderd (geen FontAwesome)
 *   p1, s2, Apple-converted-space           -> Word-plakresten, niets te stylen
 *
 * HTML-KWALITEIT: wpautop heeft de shortcodes in <p>-tags gewikkeld en daarmee
 * de nesting gesloopt, bijv. `<div class="oi_vc_text_span"></p>` met een niet
 * gesloten <div>. Rauw in v-html zetten geeft hydration-mismatch-warnings,
 * omdat de browser die HTML normaliseert en de DOM dan afwijkt van de
 * server-string. Daarom parsen we met cheerio (dat parse5 gebruikt, de echte
 * HTML5-parser) en serialiseren we opnieuw. De uitvoer is dan al genormaliseerd
 * en identiek aan wat de browser ervan maakt.
 */

/** Herkent een shortcode-tag, inclusief eventuele attributen. */
const SHORTCODE_RE = /\[(\/?)([a-zA-Z0-9_]+)([^\]]*)\]/g

/**
 * WP heeft de aanhalingstekens in shortcode-attributen omgezet naar typografische
 * entities (`&#8221;`, `&#8243;`). Alleen BINNEN een shortcode-tag terugdraaien —
 * een globale entity-decode over de hele blob zou echte tekst aantasten en het
 * vertrouwensmodel van v-html veranderen.
 */
function decodeShortcodeQuotes(attrs: string): string {
  return attrs.replace(/&#8220;|&#8221;|&#8243;|&#8242;/g, '"')
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const decoded = decodeShortcodeQuotes(raw)
  for (const m of decoded.matchAll(/([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1]] = m[2]
  }
  return attrs
}

/** Verzamelt de media-ID's uit alle [vc_single_image]-shortcodes. */
function collectImageIds(html: string): number[] {
  const ids: number[] = []
  for (const m of html.matchAll(SHORTCODE_RE)) {
    if (m[2] !== 'vc_single_image') continue
    const id = Number(parseAttrs(m[3]).image)
    if (Number.isFinite(id) && id > 0) ids.push(id)
  }
  return ids
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Bouwt de <figure> voor een opgeloste [vc_single_image]. */
function renderImage(media: WpMedia, alignment: string | undefined): string {
  const srcset = buildSrcSet(media)
  const align = alignment === 'center' || alignment === 'right' || alignment === 'left'
    ? ` wp-align-${alignment}`
    : ''
  const { width, height } = media.media_details
  return (
    `<figure class="wp-figure${align}">` +
    `<img src="${escapeAttr(media.source_url)}"` +
    (srcset ? ` srcset="${escapeAttr(srcset)}"` : '') +
    ` sizes="(max-width: 48rem) 100vw, 48rem"` +
    ` width="${width}" height="${height}"` +
    ` alt="${escapeAttr(media.alt_text ?? '')}"` +
    ` loading="lazy" decoding="async">` +
    `</figure>`
  )
}

/** Zet een YouTube-/Vimeo-URL om naar een embed-URL. Onbekende hosts: null. */
function toEmbedUrl(link: string): { url: string; title: string } | null {
  const youtube = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/)
  if (youtube) return { url: `https://www.youtube-nocookie.com/embed/${youtube[1]}`, title: 'YouTube-video' }
  const vimeo = link.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { url: `https://player.vimeo.com/video/${vimeo[1]}`, title: 'Vimeo-video' }
  return null
}

function renderVideo(link: string): string {
  const embed = toEmbedUrl(link)
  if (!embed) return ''
  return (
    `<div class="wp-embed-responsive">` +
    `<iframe src="${escapeAttr(embed.url)}" title="${escapeAttr(embed.title)}" loading="lazy" ` +
    `allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>` +
    `</div>`
  )
}

/**
 * Vervangt alle WPBakery-shortcodes. Containers worden uitgepakt (hun inhoud
 * blijft staan), inhoudelijke shortcodes worden omgezet naar echte HTML.
 */
function replaceShortcodes(html: string, media: Map<number, WpMedia>): string {
  return html.replace(SHORTCODE_RE, (full, closing: string, name: string, rawAttrs: string) => {
    // Layout- en tekstcontainers: tag weg, inhoud behouden.
    if (
      name === 'vc_row' ||
      name === 'vc_column' ||
      name === 'vc_column_text' ||
      name === 'vc_row_inner' ||
      name === 'vc_column_inner'
    ) {
      return ''
    }
    if (closing) return ''

    if (name === 'vc_empty_space') return ''

    if (name === 'vc_single_image') {
      const attrs = parseAttrs(rawAttrs)
      const item = media.get(Number(attrs.image))
      // Media niet gevonden (verwijderd of API-fout): stilzwijgend weglaten.
      return item ? renderImage(item, attrs.alignment) : ''
    }

    if (name === 'vc_video') {
      return renderVideo(parseAttrs(rawAttrs).link ?? '')
    }

    // Revolution Slider en overige onbekende shortcodes: verwijderen. De data
    // zit niet in de REST API, dus er valt niets te renderen.
    return ''
  })
}

/**
 * Index van source_url -> media, zodat inline <img>-tags in de content
 * (49 stuks, allemaal originelen op volle grootte) alsnog een srcset krijgen.
 * Wordt één keer per serverproces opgebouwd.
 */
let mediaByUrl: Map<string, WpMedia> | null = null

async function getMediaUrlIndex(): Promise<Map<string, WpMedia>> {
  if (mediaByUrl) return mediaByUrl
  const index = new Map<string, WpMedia>()
  try {
    const config = useRuntimeConfig()
    const base = String(config.wpBase).replace(/\/$/, '')
    for (let page = 1; page <= 2; page++) {
      const items = await wpGet<WpMedia[]>(`${base}/wp/v2/media`, {
        per_page: 100,
        page,
        _fields: 'id,slug,alt_text,mime_type,source_url,media_details',
      })
      for (const item of items) index.set(item.source_url, item)
      if (items.length < 100) break
    }
  } catch {
    // Niet cachen bij een fout: een tijdelijke storing zou anders het hele
    // proces lang zonder srcset op inline afbeeldingen zitten. Volgende keer
    // opnieuw proberen.
    return index
  }
  mediaByUrl = index
  return index
}

/**
 * Alle paden die deze frontend daadwerkelijk kan serveren.
 *
 * Nodig omdat de content links bevat naar pagina's die op de live WP-site wél
 * bestaan (bijv. /uitvoeringen/tegen-tijd/) maar in GEEN ENKEL REST-endpoint
 * voorkomen: die worden door de ticketingplugin gegenereerd en zijn niet als
 * post type geregistreerd. Zulke links naar een intern pad herschrijven zou
 * een 404 opleveren; ze blijven daarom naar de WP-site wijzen, waar ze werken.
 */
let internalPaths: Set<string> | null = null

async function getInternalPaths(): Promise<Set<string>> {
  if (internalPaths) return internalPaths
  const paths = new Set<string>(['/', '/nieuws', '/uitvoeringen'])
  try {
    const [pages, posts, events] = await Promise.all([
      fetchAllPageSlugs(),
      fetchAllPostSlugs(),
      fetchAllEventSlugs(),
    ])
    for (const page of pages) {
      // Uitgesloten placeholderpagina's (zie config/navigation.ts) bestaan
      // hier niet: een link ernaartoe moet extern blijven, niet naar onze
      // eigen 404 wijzen.
      if ((excludedPageSlugs as readonly string[]).includes(page.slug)) continue
      paths.add(page.slug === 'home' ? '/' : `/${page.slug}`)
    }
    for (const post of posts) paths.add(`/nieuws/${post.slug}`)
    for (const evt of events) paths.add(`/uitvoeringen/${evt.slug}`)
  } catch {
    // Niet cachen bij een fout; volgende keer opnieuw proberen. Zolang de
    // lijst ontbreekt blijven alle links extern, wat het veilige gedrag is.
    return paths
  }
  internalPaths = paths
  return paths
}

/** Normaliseert een pad voor vergelijking: zonder query, hash of slotslash. */
function normalizePath(path: string): string {
  const clean = path.split('#')[0].split('?')[0]
  return clean.length > 1 ? clean.replace(/\/+$/, '') : '/'
}

export interface TransformResult {
  html: string
  text: string
}

/**
 * Zet `content.rendered` om naar hydratie-veilige, gestylede HTML.
 *
 * @param raw    de ruwe `content.rendered` uit de API
 * @param siteUrl de publieke basis-URL van de WP-site, voor het herkennen van
 *                interne links
 */
export async function transformContent(raw: string, siteUrl: string): Promise<TransformResult> {
  if (!raw || !raw.trim()) return { html: '', text: '' }

  const imageIds = collectImageIds(raw)
  const media = imageIds.length ? await fetchMediaByIds(imageIds) : new Map<number, WpMedia>()
  const withoutShortcodes = replaceShortcodes(raw, media)

  // parse5-gebaseerd parsen in fragment-modus; corrigeert de kapotte nesting
  // exact zoals een browser dat doet.
  const $ = cheerio.load(withoutShortcodes, null, false)
  const urlIndex = await getMediaUrlIndex()
  const host = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  // Lege FontAwesome-iconen weg: we laden FontAwesome niet, dus dit zijn
  // onzichtbare of kapotte glyphs.
  $('i.fa, i[class^="fa-"], i[class*=" fa-"]').each((_, el) => {
    if (!$(el).text().trim()) $(el).remove()
  })

  // De lightbox-plugin (lightcase) draait hier niet; het attribuut suggereert
  // functionaliteit die er niet is.
  $('[data-rel]').removeAttr('data-rel')

  // Afbeeldingen: lazy loading, async decoding en waar mogelijk een srcset.
  $('img').each((_, el) => {
    const img = $(el)
    img.attr('loading', 'lazy')
    img.attr('decoding', 'async')
    if (img.attr('alt') === undefined) img.attr('alt', '')

    const src = img.attr('src')
    if (!src || img.attr('srcset')) return
    const item = urlIndex.get(src)
    if (!item) return
    const srcset = buildSrcSet(item)
    if (srcset) {
      img.attr('srcset', srcset)
      img.attr('sizes', '(max-width: 48rem) 100vw, 48rem')
    }
    if (item.media_details.width) {
      img.attr('width', String(item.media_details.width))
      img.attr('height', String(item.media_details.height))
    }
  })

  $('iframe').each((_, el) => {
    $(el).attr('loading', 'lazy')
    if (!$(el).attr('title')) $(el).attr('title', 'Ingesloten media')
  })

  // Interne links markeren zodat WpContent.vue ze client-side kan afvangen
  // (router-navigatie in plaats van een volledige pageload). Alleen links naar
  // paden die wij ook echt serveren; de rest blijft naar WordPress wijzen.
  const servable = await getInternalPaths()
  $('a[href]').each((_, el) => {
    const a = $(el)
    const href = a.attr('href') ?? ''
    const pointsAtWp = href.startsWith(`https://${host}`) || href.startsWith(`http://${host}`)
    if (!pointsAtWp) {
      // Externe links veilig openen.
      if (/^https?:\/\//i.test(href)) a.attr('rel', 'noopener noreferrer')
      return
    }

    const rawPath = href.replace(/^https?:\/\/[^/]+/, '') || '/'
    // Links naar bestanden (uploads/PDF's) blijven directe links.
    if (rawPath.startsWith('/wp-content/') || rawPath.startsWith('/wp-json/')) return

    const path = normalizePath(rawPath)
    if (!servable.has(path)) {
      // Bestaat wel op de WP-site, maar niet in deze frontend (bijv. de
      // uitvoeringspagina's van de ticketingplugin). Extern laten.
      a.attr('rel', 'noopener noreferrer')
      return
    }

    a.attr('href', path)
    a.attr('data-internal', 'true')
  })

  // Kopniveaus in de content verlagen: de paginatitel is al de <h1>.
  $('h1').each((_, el) => {
    const h1 = $(el)
    const h2 = $('<h2></h2>')
    h2.attr('class', h1.attr('class') ?? null)
    h2.html(h1.html() ?? '')
    h1.replaceWith(h2)
  })

  // Lege <p>/<div>-resten van wpautop opruimen (ontstaan waar shortcodes stonden).
  for (let pass = 0; pass < 3; pass++) {
    $('p, div, span').each((_, el) => {
      const node = $(el)
      if (!node.text().trim() && node.children().length === 0) node.remove()
    })
  }

  const html = $.html().trim()
  const text = $.root().text().replace(/\s+/g, ' ').trim()
  return { html, text }
}

/**
 * Events Manager wrapt `content.rendered` van een event in zijn eigen
 * sjabloon: een `em-item-header` met datum/tijd nogmaals als tekst, een "Aan
 * agenda toevoegen"-dropdown (die zonder JavaScript niet open/dicht kan) en
 * pas daarna de echte, door de redactie geschreven tekst in
 * `<section class="em-event-content">`. Wij tonen datum/tijd/locatie al zelf
 * (uit de `event_*`-velden), dus die header zou alles dubbel laten zien —
 * vandaar dat alleen de inhoud van die sectie wordt doorgegeven aan
 * `transformContent()`.
 *
 * De eventuele kaartverkoop-knop staat IN die sectie (met een inline
 * `style="display:none"` zolang de verkoop nog niet gestart is) en overleeft
 * deze extractie dus gewoon: `transformContent` verwijdert geen
 * `style`-attributen.
 *
 * Bestaat de sectie niet (andere EM-versie, of geen EM-sjabloon toegepast),
 * dan valt dit terug op de volledige ruwe content: beter een dubbele header
 * tonen dan een lege pagina.
 */
export function extractEventDescription(raw: string): string {
  if (!raw || !raw.trim()) return ''
  const $ = cheerio.load(raw, null, false)
  const section = $('.em-event-content').first()
  return section.length ? (section.html() ?? '') : raw
}

/** Strips HTML naar platte tekst, voor meta descriptions. */
export function htmlToText(html: string): string {
  if (!html) return ''
  return cheerio.load(html, null, false).root().text().replace(/\s+/g, ' ').trim()
}

/** Kort af op een woordgrens, voor meta descriptions. */
export function truncate(text: string, max = 160): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '')}…`
}

/**
 * Verwijdert alle shortcodes uit een HTML-fragment zonder verdere transformatie.
 *
 * Nodig voor `excerpt.rendered`: WP genereert die automatisch uit de ruwe
 * content en neemt daarbij de WPBakery-shortcodes inclusief hun `css=".vc_custom_…"`
 * payload mee. Zonder deze strip belandt die CSS-rommel in de meta description.
 */
export function stripShortcodes(html: string): string {
  return html.replace(SHORTCODE_RE, '')
}
