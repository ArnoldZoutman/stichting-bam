import { getEventDocument } from '~~/server/utils/wp-documents'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Ontbrekende slug' })

  const doc = await getEventDocument(slug)
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Voorstelling niet gevonden' })
  return doc
})
