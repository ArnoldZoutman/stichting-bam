import { getEventList } from '~~/server/utils/wp-documents'

/**
 * Wat de header nodig heeft, zonder de hele agenda in de payload van elke
 * pagina: alleen of er een komende voorstelling is (knop "Kaarten").
 */
export default defineEventHandler(async () => {
  const { upcoming } = await getEventList()
  return { hasUpcoming: upcoming.length > 0 }
})
