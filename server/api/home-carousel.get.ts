import { getHomeCarousel } from '~~/server/utils/wp-documents'

/**
 * Alleen tijdens de build: het resultaat belandt via `useFetch` in de
 * prerender-payload van `/` (`_payload.json`). Op de statische hosting
 * bestaat deze route niet, en dat hoeft ook niet.
 */
export default defineEventHandler(async () => {
  return await getHomeCarousel()
})
