/**
 * Versturen naar Contact Form 7 (REST, `contact-form-7/v1`).
 *
 * CF7 6.x verwacht `multipart/form-data` met de veldnamen uit het formulier
 * in wp-admin plus `_wpcf7_unit_tag` (sinds CF7 5.6 verplicht; zonder geeft
 * het endpoint een fout). Het antwoord is altijd JSON met een `status`:
 *   mail_sent         — verstuurd
 *   validation_failed — `invalid_fields[]` met per veld een melding
 *   mail_failed       — formulier ok, maar WordPress kon niet mailen
 *   spam / aborted    — door spamfilter of een plugin tegengehouden
 *
 * CORS: WordPress stuurt op cms.stichting-bam.nl al
 * `Access-Control-Allow-Origin: https://www.stichting-bam.nl` mee
 * (gecontroleerd met een preflight). Geen cookies/credentials meesturen.
 */

/** De veldnamen in het CF7-formulier; moeten exact overeenkomen (zie PLAATSING.md). */
export const CF7_FIELDS = {
  naam: 'your-name',
  email: 'your-email',
  onderwerp: 'your-subject',
  bericht: 'your-message',
} as const

export type Cf7Field = keyof typeof CF7_FIELDS

export type Cf7Result =
  | { ok: true }
  | { ok: false, kind: 'invalid', fields: Partial<Record<Cf7Field, string>>, message: string }
  | { ok: false, kind: 'failed', message: string }

interface Cf7Response {
  status?: string
  message?: string
  invalid_fields?: { field?: string, message?: string }[]
}

export async function submitToCf7(
  base: string,
  formId: number,
  values: Record<Cf7Field, string>,
): Promise<Cf7Result> {
  const body = new FormData()
  for (const [key, name] of Object.entries(CF7_FIELDS)) body.append(name, values[key as Cf7Field])
  body.append('_wpcf7', String(formId))
  body.append('_wpcf7_unit_tag', `wpcf7-f${formId}-o1`)
  body.append('_wpcf7_locale', 'nl_NL')

  let data: Cf7Response
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/contact-forms/${formId}/feedback`, {
      method: 'POST',
      body,
      credentials: 'omit',
    })
    data = await res.json() as Cf7Response
  } catch {
    return { ok: false, kind: 'failed', message: 'Het bericht kon niet worden verstuurd. Controleer je internetverbinding en probeer het opnieuw.' }
  }

  if (data.status === 'mail_sent') return { ok: true }

  if (data.status === 'validation_failed') {
    const byName = Object.fromEntries(Object.entries(CF7_FIELDS).map(([k, v]) => [v, k as Cf7Field]))
    const fields: Partial<Record<Cf7Field, string>> = {}
    for (const f of data.invalid_fields ?? []) {
      const key = f.field ? byName[f.field] : undefined
      if (key && f.message) fields[key] = f.message
    }
    return { ok: false, kind: 'invalid', fields, message: data.message ?? '' }
  }

  // mail_failed, spam, aborted, of een WP-fout (bijv. formulier niet gevonden).
  return { ok: false, kind: 'failed', message: 'Het bericht kon niet worden verstuurd.' }
}
