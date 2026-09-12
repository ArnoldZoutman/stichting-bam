import { fetchAllPageSlugs, fetchAllPostSlugs } from '~~/server/utils/wp-client'

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

  const [pages, posts] = await Promise.all([fetchAllPageSlugs(), fetchAllPostSlugs()])

  const urls: string[] = [entry(`${site}/`), entry(`${site}/nieuws`)]

  for (const page of pages) {
    // `home` wordt op `/` gerenderd en staat er al in.
    if (page.slug === 'home') continue
    urls.push(entry(`${site}/${page.slug}`, page.modified))
  }

  for (const post of posts) {
    urls.push(entry(`${site}/nieuws/${post.slug}`, post.modified))
  }

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
})
