import { wpGet } from '~~/server/utils/wp-client'

/**
 * Site-metadata uit de root van de REST API (`/wp-json/`). Levert de echte
 * sitenaam en -omschrijving in plaats van een hardcoded string.
 *
 * Deze gegevens zijn cosmetisch (kop en footer), dus een storing bij WordPress
 * mag hier geen 500 opleveren en al helemaal geen prerender laten struikelen.
 * Bij een fout vallen we terug op de sitenaam zoals WordPress die voert.
 */
export default defineEventHandler(async () => {
  const base = String(useRuntimeConfig().wpBase).replace(/\/$/, '')
  try {
    const root = await wpGet<{ name?: string; description?: string; home?: string }>(`${base}/`)
    return {
      name: root.name || 'Stichting BAM',
      description: root.description || '',
      home: root.home || '',
    }
  } catch {
    return { name: 'Stichting BAM', description: '', home: '' }
  }
})
