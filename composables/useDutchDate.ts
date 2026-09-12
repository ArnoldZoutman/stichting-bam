/** Nederlandse datumnotatie, consistent op server en client. */
export function useDutchDate() {
  const formatter = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })

  function formatDate(value: string): string {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return formatter.format(date)
  }

  return { formatDate }
}
