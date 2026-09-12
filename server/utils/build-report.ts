import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Registreert mislukte API-calls tijdens het prerenderen.
 *
 * WAAROM DIT BESTAAT
 * Bij een statische build is een stilzwijgend gedegradeerde pagina gevaarlijker
 * dan een harde crash. De build slaagt dan, de output is incompleet, en die
 * incomplete output overschrijft een goede site. Een deel van de API-fouten
 * wordt bewust opgevangen (media-index, sitenaam, `default:` op useFetch) om de
 * site overeind te houden — maar tijdens een BUILD moet zo'n fout zichtbaar
 * worden.
 *
 * Iedere definitief mislukte call wordt als één JSON-regel weggeschreven;
 * `scripts/verify-build.mjs` leest dat bestand en keurt de build af zodra er
 * ook maar één regel in staat.
 *
 * LET OP — hier is bewust GEEN `import.meta.prerender`-guard.
 * Zo'n guard zat er eerst wel, maar werkte niet: door de TypeScript-cast die
 * nodig was om het type te laten kloppen, verving Nitro `import.meta.prerender`
 * niet compile-time maar compileerde het naar `globalThis._importMeta_.prerender`
 * — altijd `undefined`. De guard blokkeerde daardoor élke registratie en de
 * controle op niet-2xx was in de praktijk niet geïmplementeerd. Nu registreren
 * we altijd; `scripts/reset-report.mjs` maakt het logbestand leeg aan het begin
 * van elke build.
 */

export const API_FAILURE_LOG = '.build-report/api-failures.jsonl'

export interface ApiFailure {
  url: string
  status: number | null
  message: string
  at: string
  /**
   * `failed`   — de call is definitief mislukt; de build wordt afgekeurd.
   * `recovered` — een poging faalde, een volgende slaagde. Geen reden om af te
   *   keuren, wél een signaal: dit is hoe dicht de build bij de rand zat. De
   *   WordPress-host geeft `508 Loop Detected` onder belasting, en zonder deze
   *   registratie ziet een build waarin elke call twee pogingen nodig had er
   *   precies zo uit als een build waarin niets misging.
   */
  severity: 'failed' | 'recovered'
}

export function recordApiFailure(failure: Omit<ApiFailure, 'at'>): void {
  try {
    mkdirSync(dirname(API_FAILURE_LOG), { recursive: true })
    appendFileSync(API_FAILURE_LOG, `${JSON.stringify({ ...failure, at: new Date().toISOString() })}\n`)
  } catch {
    // Als zelfs het wegschrijven faalt mag dat de build niet omver trekken;
    // failOnError op de prerender vangt de fatale gevallen alsnog af.
  }
}
