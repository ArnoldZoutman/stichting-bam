import type { EventSummary } from '~~/server/utils/wp-types'

/**
 * Productienummers ("Productie VI", "onze zesde productie").
 *
 * AFGELEID, niet uit het CMS: Events Manager kent geen productienummer. We
 * tellen alle voorstellingen chronologisch op startdatum, de oudste is I.
 * Dat klopt zolang elk Events Manager-event precies één productie is (zo is
 * het nu: 6 events, 6 producties). Krijgt één productie ooit meerdere
 * events, dan schuift de nummering — dan hoort er een veld in het CMS.
 */

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

const ORDINALS = [
  '', 'eerste', 'tweede', 'derde', 'vierde', 'vijfde', 'zesde', 'zevende', 'achtste',
  'negende', 'tiende', 'elfde', 'twaalfde', 'dertiende', 'veertiende', 'vijftiende',
  'zestiende', 'zeventiende', 'achttiende', 'negentiende', 'twintigste',
]

export function toRoman(n: number): string {
  let rest = n
  let out = ''
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

const NUMBER_WORDS = [
  'nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
  'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien',
  'negentien', 'twintig',
]

/** "zes", of het cijfer zelf boven de twintig. */
export function toDutchNumberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n)
}

export function toDutchOrdinal(n: number): string {
  return ORDINALS[n] ?? `${n}e`
}

export interface ProductionNumber {
  num: number
  roman: string
  ordinal: string
}

/** Productienummer per event-id, over de volledige lijst (komend + archief). */
export function productionNumbers(events: EventSummary[]): Map<number, ProductionNumber> {
  const sorted = [...events].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  return new Map(sorted.map((event, i) => [
    event.id,
    { num: i + 1, roman: toRoman(i + 1), ordinal: toDutchOrdinal(i + 1) },
  ]))
}
