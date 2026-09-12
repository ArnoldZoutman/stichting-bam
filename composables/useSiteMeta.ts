import type { ResolvedImage } from '~~/server/utils/wp-types'

/** Naam en omschrijving van de site, één keer opgehaald en gedeeld. */
export function useSiteInfo() {
  return useFetch('/api/site', {
    key: 'site-info',
    default: () => ({ name: 'Stichting BAM', description: '', home: '' }),
  })
}

export interface SeoInput {
  title: string
  description: string
  path: string
  image?: ResolvedImage | null
  type?: 'website' | 'article'
  publishedAt?: string
}

/**
 * Zet title, description, canonical en Open Graph. De canonical wijst naar
 * DEZE frontend (runtimeConfig.public.siteUrl), niet naar de WP-site.
 */
export function useWpSeo(input: SeoInput) {
  const config = useRuntimeConfig()
  const site = String(config.public.siteUrl).replace(/\/$/, '')
  const url = `${site}${input.path}`

  useSeoMeta({
    title: input.title,
    description: input.description || undefined,
    ogTitle: input.title,
    ogDescription: input.description || undefined,
    ogType: input.type ?? 'website',
    ogUrl: url,
    ogLocale: 'nl_NL',
    ogImage: input.image?.og.src,
    ogImageWidth: input.image?.og.width,
    ogImageHeight: input.image?.og.height,
    ogImageAlt: input.image?.alt || input.title,
    twitterCard: input.image ? 'summary_large_image' : 'summary',
    articlePublishedTime: input.publishedAt,
  })

  useHead({
    link: [{ rel: 'canonical', href: url }],
  })
}
