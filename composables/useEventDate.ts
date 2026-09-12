/**
 * Nederlandse datum-/tijdnotatie voor voorstellingen (Events Manager).
 *
 * `event_start_date`/`event_end_date` komen als 'Y-m-d' uit
 * `wordpress/bam-events-rest.php` (zie server/utils/wp-types.ts). Dat is
 * geen tijdzone-bewuste waarde; door 'm als 12:00 lokale tijd te parsen kan
 * een 'Y-m-d' nooit een dag opschuiven, wat bij middernacht-UTC-parsing in
 * een westelijkere tijdzone wél zou gebeuren.
 */
function toLocalDate(value: string): Date | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function useEventDate() {
  const fullDate = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })
  const dayMonth = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Amsterdam',
  })
  const dayOnly = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    timeZone: 'Europe/Amsterdam',
  })

  /**
   * Eén periode, geen twee losse datumregels:
   *  - één dag: "3 juli 2026"
   *  - meerdaags, zelfde maand: "3 en 4 juli 2026"
   *  - meerdaags, andere maand (zelfde jaar): "29 juni – 2 juli 2026"
   *  - meerdaags, ander jaar: "30 december 2026 – 2 januari 2027"
   */
  function formatEventPeriod(startDate: string | null, endDate: string | null): string {
    const start = toLocalDate(startDate ?? '')
    if (!start) return ''
    const end = toLocalDate(endDate ?? '') ?? start

    if (start.getTime() === end.getTime()) return fullDate.format(start)

    const sameYear = start.getFullYear() === end.getFullYear()
    const sameMonth = sameYear && start.getMonth() === end.getMonth()

    if (sameMonth) return `${dayOnly.format(start)} en ${fullDate.format(end)}`
    if (sameYear) return `${dayMonth.format(start)} – ${fullDate.format(end)}`
    return `${fullDate.format(start)} – ${fullDate.format(end)}`
  }

  /** "21:00 – 22:30", alleen de starttijd als er geen eindtijd is, of leeg. */
  function formatEventTime(startTime: string | null, endTime: string | null): string {
    if (!startTime) return ''
    const start = startTime.slice(0, 5)
    const end = endTime ? endTime.slice(0, 5) : ''
    return end && end !== start ? `${start} – ${end}` : start
  }

  return { formatEventPeriod, formatEventTime }
}
