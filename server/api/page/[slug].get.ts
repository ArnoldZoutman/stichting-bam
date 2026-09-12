import { getPageDocument } from '~~/server/utils/wp-documents'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Ontbrekende slug' })

  const doc = await getPageDocument(slug)
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden' })
  return doc
})
