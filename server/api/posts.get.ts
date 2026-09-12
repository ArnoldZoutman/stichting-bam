import { getPostList } from '~~/server/utils/wp-documents'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page ?? 1) || 1)
  const perPage = Math.min(20, Math.max(1, Number(query.per_page ?? 6) || 6))

  try {
    return await getPostList(page, perPage)
  } catch (error: unknown) {
    // WP antwoordt met 400 `rest_post_invalid_page_number` als je voorbij de
    // laatste pagina vraagt. Voor onze frontend is dat een 404, geen serverfout.
    const status = (error as { status?: number; statusCode?: number })?.status
      ?? (error as { statusCode?: number })?.statusCode
    if (status === 400) {
      throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden' })
    }
    throw error
  }
})
