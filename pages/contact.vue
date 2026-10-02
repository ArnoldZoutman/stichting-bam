<script setup lang="ts">
/**
 * Contactpagina volgens design-reference/pages/Contact.dc.html. Er bestaat
 * geen WP-pagina `contact`; dit is een eigen Nuxt-pagina.
 *
 * Contactgegevens (e-mail, postadres, KvK) komen uit het blok
 * "Contactgegevens" op de WP-pagina "Over ons" (getContactDetails). Wat daar
 * niet staat, ontbreekt hier ook: social links, reactietermijn, kaart/foto.
 *
 * FORMULIER: geen eigen backend (statische site op Vimexx). Versturen gaat
 * naar Contact Form 7 op cms.stichting-bam.nl (utils/cf7.ts). Het formulier
 * wordt pas GETOOND als `contactForm.cf7FormId` in app.config.ts is
 * ingevuld; tot dan staan hier alleen de contactgegevens. Bij elke fout
 * (netwerk, mail_failed, spam) blijft de invoer staan en volgt een
 * verwijzing naar het e-mailadres — er gaat nooit stil een bericht verloren.
 */
const { data: contact } = await useContactDetails()
const { contactForm } = useAppConfig()

const subjects = [
  'Vraag over een voorstelling',
  'Meespelen of meehelpen',
  'Sponsoring en samenwerking',
  'Iets anders',
]

const form = reactive({ naam: '', email: '', onderwerp: subjects[0]!, bericht: '' })
type Field = 'naam' | 'email' | 'bericht'
const errors = reactive<Record<Field, string>>({ naam: '', email: '', bericht: '' })
/** Alleen met een ingevuld CF7-formulier-ID is er iets om naartoe te versturen. */
const formEnabled = contactForm.cf7FormId != null
const status = ref<'idle' | 'sending' | 'sent' | 'failed'>('idle')
const failure = ref('')
const sentNotice = ref<HTMLElement | null>(null)
const fields = ref<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>({ naam: null, email: null, bericht: null })

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(): Field | null {
  errors.naam = form.naam.trim() ? '' : 'Vul je naam in.'
  errors.email = !form.email.trim()
    ? 'Vul je e-mailadres in.'
    : EMAIL.test(form.email.trim()) ? '' : 'Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl.'
  errors.bericht = form.bericht.trim() ? '' : 'Schrijf je bericht.'
  return (['naam', 'email', 'bericht'] as Field[]).find((f) => errors[f]) ?? null
}

async function onSubmit() {
  if (status.value === 'sending') return
  const firstInvalid = validate()
  if (firstInvalid) {
    fields.value[firstInvalid]?.focus()
    return
  }

  if (contactForm.cf7FormId == null) return

  status.value = 'sending'
  const result = await submitToCf7(contactForm.cf7Base, contactForm.cf7FormId, {
    naam: form.naam.trim(),
    email: form.email.trim(),
    onderwerp: form.onderwerp,
    bericht: form.bericht.trim(),
  })

  if (result.ok) {
    status.value = 'sent'
    await nextTick()
    sentNotice.value?.focus()
    return
  }

  if (result.kind === 'invalid' && Object.keys(result.fields).length) {
    // Meldingen van CF7 zelf (bijv. strengere regels in wp-admin) per veld tonen.
    for (const key of ['naam', 'email', 'bericht'] as Field[]) errors[key] = result.fields[key] ?? ''
    status.value = 'idle'
    const first = (['naam', 'email', 'bericht'] as Field[]).find((f) => errors[f])
    if (first) fields.value[first]?.focus()
    return
  }

  failure.value = result.message
  status.value = 'failed'
}

function reset() {
  Object.assign(form, { naam: '', email: '', onderwerp: subjects[0]!, bericht: '' })
  status.value = 'idle'
}

const hasDetails = computed(() => Boolean(contact.value.email || contact.value.addressLines.length || contact.value.kvk))

useWpSeo({
  title: 'Contact',
  description: 'Vragen over een voorstelling, meedoen of samenwerken? Stuur Stichting BAM een bericht.',
  path: '/contact',
})
</script>

<template>
  <div>
    <PageHero
      eyebrow="Laat van je horen"
      title="Contact"
      intro="Vragen over een voorstelling, meedoen of samenwerken? Stuur ons een mail."
    />

    <section class="contact">
      <div class="contact__inner">
        <div v-if="formEnabled" class="contact__form-col">
          <h2>Stuur een bericht</h2>

          <div v-if="status === 'sent'" ref="sentNotice" role="status" class="notice" tabindex="-1">
            <p class="notice__title">Bedankt, je bericht is verstuurd.</p>
            <p>We nemen zo snel mogelijk contact met je op.</p>
            <div><BamButton variant="secondary" @click="reset">Nog een bericht</BamButton></div>
          </div>

          <form v-else class="form" novalidate @submit.prevent="onSubmit">
            <p class="form__hint">Alle velden zijn verplicht.</p>

            <div class="form__row">
              <div class="field">
                <label for="c-naam">Naam</label>
                <input
                  id="c-naam"
                  :ref="(el) => (fields.naam = el as HTMLInputElement)"
                  v-model="form.naam"
                  type="text"
                  name="naam"
                  autocomplete="name"
                  required
                  :aria-invalid="errors.naam ? 'true' : undefined"
                  :aria-describedby="errors.naam ? 'c-naam-fout' : undefined"
                >
                <p v-if="errors.naam" id="c-naam-fout" class="field__error">{{ errors.naam }}</p>
              </div>
              <div class="field">
                <label for="c-mail">E-mailadres</label>
                <input
                  id="c-mail"
                  :ref="(el) => (fields.email = el as HTMLInputElement)"
                  v-model="form.email"
                  type="email"
                  name="email"
                  autocomplete="email"
                  inputmode="email"
                  required
                  :aria-invalid="errors.email ? 'true' : undefined"
                  :aria-describedby="errors.email ? 'c-mail-fout' : undefined"
                >
                <p v-if="errors.email" id="c-mail-fout" class="field__error">{{ errors.email }}</p>
              </div>
            </div>

            <div class="field">
              <label for="c-onderwerp">Onderwerp</label>
              <select id="c-onderwerp" v-model="form.onderwerp" name="onderwerp">
                <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="field">
              <label for="c-bericht">Bericht</label>
              <textarea
                id="c-bericht"
                :ref="(el) => (fields.bericht = el as HTMLTextAreaElement)"
                v-model="form.bericht"
                name="bericht"
                rows="6"
                required
                :aria-invalid="errors.bericht ? 'true' : undefined"
                :aria-describedby="errors.bericht ? 'c-bericht-fout' : undefined"
              />
              <p v-if="errors.bericht" id="c-bericht-fout" class="field__error">{{ errors.bericht }}</p>
            </div>

            <div class="form__actions">
              <BamButton type="submit" :aria-disabled="status === 'sending' ? 'true' : undefined">
                {{ status === 'sending' ? 'Bezig met versturen…' : 'Versturen' }}
              </BamButton>
            </div>

            <div role="status" class="form__status">
              <p v-if="status === 'failed'" class="notice notice--warn">
                {{ failure }}
                <template v-if="contact.email">
                  Mail je bericht naar <a :href="`mailto:${contact.email}?subject=${encodeURIComponent(form.onderwerp)}`">{{ contact.email }}</a>.
                </template>
              </p>
            </div>
          </form>
        </div>

        <aside v-if="hasDetails" class="details" :class="{ 'details--solo': !formEnabled }" aria-labelledby="contactgegevens">
          <h2 id="contactgegevens" class="details__title">Stichting BAM</h2>
          <dl>
            <div v-if="contact.email">
              <dt>E-mail</dt>
              <dd><a :href="`mailto:${contact.email}`">{{ contact.email }}</a></dd>
            </div>
            <div v-if="contact.addressLines.length">
              <dt>Postadres</dt>
              <dd>
                <address>
                  <template v-for="(line, i) in contact.addressLines" :key="line"><br v-if="i > 0">{{ line }}</template>
                </address>
              </dd>
            </div>
            <div v-if="contact.kvk">
              <dt>KvK</dt>
              <dd>{{ contact.kvk }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  </div>
</template>

<style scoped>
.contact {
  padding: 100px var(--gutter) 130px;
}

.contact__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 64px;
  align-items: flex-start;
}

.contact__form-col {
  flex: 999 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

h2 {
  margin: 0;
  font-size: clamp(32px, 4vw, 48px);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.form__hint {
  margin: 0;
  font-size: 15px;
  color: var(--bam-body);
}

.form__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  gap: 22px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
}

input,
select,
textarea {
  min-height: 52px;
  padding: 0 16px;
  border: 1.5px solid var(--bam-night);
  border-radius: 0;
  background: var(--bam-mist);
  font-family: inherit;
  font-size: 17px;
  color: var(--bam-ink);
}

textarea {
  padding: 14px 16px;
  line-height: 1.6;
  resize: vertical;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  border-color: var(--bam-blue);
}

[aria-invalid='true'] {
  border-color: #b3261e;
  border-width: 2px;
}

/* Rood op wit 6.5:1; het icoon-teken maakt de fout ook zonder kleur herkenbaar. */
.field__error {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #b3261e;
}

.field__error::before {
  content: '⚠ ';
}

.form__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}

.form__status:empty {
  display: none;
}

.notice {
  margin: 0;
  padding: 32px 30px;
  border-top: 6px solid var(--bam-orange);
  background: var(--bam-sky);
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-size: 18px;
  color: var(--bam-body);
}

.notice:focus-visible {
  outline-offset: 4px;
}

.notice p {
  margin: 0;
}

.notice--warn {
  display: block;
  padding: 20px 24px;
  font-size: 17px;
  color: var(--bam-ink);
}

.notice__title {
  font-family: var(--font-display);
  font-size: 34px;
  letter-spacing: 1px;
  color: var(--bam-ink);
}

/* ── Contactgegevens ───────────────────────────────────────────────────── */
/* Zonder formulier staat het blok alleen: gecentreerd, niet uitgerekt. */
.details.details--solo {
  flex: 0 1 560px;
  margin: 0 auto;
}

.details {
  flex: 1 1 320px;
  padding: 40px 34px;
  border-top: 6px solid var(--bam-orange);
  background: var(--bam-night);
  color: var(--bam-white);
}

.details__title {
  margin: 0 0 24px;
  font-family: var(--font-accent);
  font-size: 26px;
  letter-spacing: 0;
  color: var(--bam-orange);
}

.details dl {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin: 0;
}

.details dt {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--bam-body-on-night);
}

.details dd {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.5;
}

.details a {
  color: var(--bam-white);
  text-decoration-color: var(--bam-orange);
  overflow-wrap: anywhere;
}

.details a:hover {
  color: var(--link-on-night);
}

.details address {
  font-style: normal;
}
</style>
