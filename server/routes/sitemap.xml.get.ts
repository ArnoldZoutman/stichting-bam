import { fetchAllPageSlugs, fetchAllPostSlugs, fetchAllEventSlugs } from '~~/server/utils/wp-client'
import { excludedPageSlugs } from '~~/config/navigation'

/** XML-escaping voor URL's in de sitemap. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function entry(loc: string, lastmod?: string): string {
  const mod = lastmod ? `\n    <lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${mod}\n  </url>`
}

/** Sitemap opgebouwd uit de API, niet uit een handmatige lijst. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const site = String(config.public.siteUrl).replace(/\/$/, '')

  const [pages, posts, events] = await Promise.all([
    fetchAllPageSlugs(),
    fetchAllPostSlugs(),
    fetchAllEventSlugs(),
  ])

  const excluded: readonly string[] = excludedPageSlugs
  const urls: string[] = [entry(`${site}/`), entry(`${site}/nieuws`), entry(`${site}/uitvoeringen`)]

  for (const page of pages) {
    // `home` wordt op `/` gerenderd en staat er al in. Uitgesloten
    // placeholderpagina's (zie config/navigation.ts) worden niet meer
    // geserveerd en horen dus ook niet in de sitemap. `uitvoeringen` staat
    // hierboven al met de eigen route erin — die van de agenda, niet van de
    // WP-pagina — dus die slaan we hier over om 'm niet dubbel te krijgen.
    if (page.slug === 'home' || page.slug === 'uitvoeringen' || excluded.includes(page.slug)) continue
    urls.push(entry(`${site}/${page.slug}`, page.modified))
  }

  for (const post of posts) {
    urls.push(entry(`${site}/nieuws/${post.slug}`, post.modified))
  }

  for (const evt of events) {
    urls.push(entry(`${site}/uitvoeringen/${evt.slug}`, evt.modified))
  }

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
})
