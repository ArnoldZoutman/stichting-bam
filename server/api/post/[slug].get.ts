import { getPostDocument } from '~~/server/utils/wp-documents'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Ontbrekende slug' })

  const doc = await getPostDocument(slug)
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Bericht niet gevonden' })
  return doc
})
