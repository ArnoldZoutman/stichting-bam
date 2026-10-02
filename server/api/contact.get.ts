import { getContactDetails } from '~~/server/utils/wp-documents'

export default defineEventHandler(async () => {
  return await getContactDetails()
})
