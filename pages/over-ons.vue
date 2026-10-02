<script setup lang="ts">
/**
 * "Over BAM" volgens design-reference/pages/OverBam.dc.html, op het bestaande
 * pad `/over-ons` (de WP-slug; geen redirect nodig). Statische route, dus
 * deze wint van de catch-all `pages/[...slug].vue`.
 *
 *  - Ons verhaal: de volledige CMS-tekst van de pagina "Over ons". Die bevat
 *    zelf al de koppen ("Hallo, wij zijn BAM!", "Waar staan we voor?") en
 *    twee foto's. De uitgelichte afbeelding van de pagina is een
 *    muurtextuur (achtergrond uit het oude thema) en wordt niet getoond.
 *  - Repertoire: tijdlijn van alle voorstellingen uit Events Manager, met het
 *    AFGELEIDE productienummer (composables/useProductions).
 *  - Bestuur: weggelaten — namen, functies en foto's staan niet in het CMS.
 *  - Slot-CTA: kop en knop uit het ontwerp; de uitnodigingstekst
 *    ([KORTE UITNODIGING …]) bestaat niet in het CMS en is weggelaten.
 */
const { data: page, error } = await useFetch('/api/page/over-ons', { key: 'page-over-ons' })

if (error.value || !page.value) {
  throw createError({
    statusCode: error.value?.statusCode === 404 || !page.value ? 404 : 502,
    statusMessage: 'Pagina niet gevonden',
    fatal: true,
  })
}

const { data: events } = await useFetch('/api/events', {
  key: 'uitvoeringen',
  default: () => ({ upcoming: [], past: [] }),
})

const productions = computed(() => {
  const all = [...events.value.upcoming, ...events.value.past]
  const numbers = productionNumbers(all)
  return [...all]
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
    .map((event) => ({
      event,
      roman: numbers.get(event.id)?.roman ?? '',
      meta: [event.startDate?.slice(0, 4), event.locationName].filter(Boolean).join(' · '),
    }))
})

const countTitle = computed(() => {
  const word = toDutchNumberWord(productions.value.length)
  const noun = productions.value.length === 1 ? 'productie' : 'producties'
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${noun} tot nu toe`
})

useWpSeo({
  title: 'Over BAM',
  description: page.value.description,
  path: '/over-ons',
})
</script>

<template>
  <div v-if="page">
    <PageHero
      eyebrow="Bergse Alliantie voor Muziektheater"
      title="Over BAM"
      intro="Muziektheater uit Bergen op Zoom."
    />

    <section class="story" aria-labelledby="ons-verhaal">
      <div class="story__inner">
        <EyebrowLabel id="ons-verhaal" tag="h2" rule>Ons verhaal</EyebrowLabel>
        <WpContent v-if="!page.isEmpty" :html="page.html" class="story__content" />
      </div>
    </section>

    <section v-if="productions.length" class="timeline" aria-labelledby="repertoire">
      <div class="timeline__inner">
        <div class="timeline__head reveal">
          <EyebrowLabel>Repertoire</EyebrowLabel>
          <h2 id="repertoire">{{ countTitle }}</h2>
        </div>
        <div class="timeline__track">
          <span class="timeline__line" aria-hidden="true" />
          <ol>
            <li v-for="p in productions" :key="p.event.id" class="stop reveal">
              <span class="stop__dot" aria-hidden="true">{{ p.roman }}</span>
              <NuxtLink :to="`/uitvoeringen/${p.event.slug}`" class="stop__title">
                <span class="visually-hidden">Productie {{ p.roman }}: </span>{{ p.event.title }}
              </NuxtLink>
              <span v-if="p.meta" class="stop__meta">{{ p.meta }}</span>
            </li>
          </ol>
        </div>
        <div class="timeline__actions">
          <BamButton to="/uitvoeringen#archief" variant="secondary">Bekijk het archief</BamButton>
        </div>
      </div>
    </section>

    <section class="cta" aria-labelledby="meedoen">
      <div class="sunburst-light cta__rays" aria-hidden="true" />
      <div class="cta__inner reveal">
        <h2 id="meedoen">Meespelen, meehelpen of steunen?</h2>
        <BamButton to="/contact" variant="secondary" class="cta__button">Neem contact op</BamButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
}

/* ── Ons verhaal ───────────────────────────────────────────────────────── */
.story {
  padding: var(--section-y) var(--gutter);
}

.story__inner {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  font-size: 19px;
  line-height: 1.8;
  color: var(--bam-body);
}

/* De koppen in de CMS-tekst krijgen de schaal van het ontwerp. */
.story__content :deep(h2) {
  margin-top: 48px;
  font-size: clamp(32px, 4.5vw, 52px);
  line-height: 1.08;
  color: var(--bam-ink);
}

.story__content :deep(h2:first-child) {
  margin-top: 0;
}

/* ── Tijdlijn ──────────────────────────────────────────────────────────── */
.timeline {
  padding: 110px var(--gutter) 120px;
  background: var(--bam-sky);
}

.timeline__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.timeline__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.timeline__head h2 {
  font-size: clamp(36px, 4.5vw, 56px);
}

.timeline__track {
  position: relative;
}

.timeline__line {
  position: absolute;
  left: 0;
  right: 0;
  top: 34px;
  height: 3px;
  background: var(--bam-night);
}

.timeline ol {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(170px, 100%), 1fr));
  gap: 32px 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.stop__dot {
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--bam-orange);
  border-radius: 50%;
  background: var(--bam-night);
  font-family: var(--font-accent);
  font-size: 22px;
  color: var(--bam-white);
  transition: transform 0.3s ease, background 0.3s ease, color 0.3s ease;
}

.stop:hover .stop__dot,
.stop:focus-within .stop__dot {
  transform: scale(1.25);
  background: var(--bam-orange);
  color: var(--bam-ink);
}

.stop__title {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.15;
  letter-spacing: 1px;
  color: var(--bam-ink);
  text-decoration: none;
}

.stop__title:hover {
  color: var(--bam-label);
}

.stop__meta {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bam-label);
}

/* Smal: verticale tijdlijn, de lijn loopt door de bollen. */
@media (max-width: 560px) {
  .timeline__line {
    left: 34px;
    right: auto;
    top: 0;
    bottom: 0;
    width: 3px;
    height: auto;
  }

  .timeline ol {
    grid-template-columns: 1fr;
  }

  .stop {
    display: grid;
    grid-template-columns: 68px 1fr;
    column-gap: 20px;
    row-gap: 4px;
    align-items: center;
    text-align: left;
  }

  .stop__dot {
    grid-row: span 2;
  }
}

.timeline__actions {
  display: flex;
  justify-content: center;
}

/* ── Slot-CTA ──────────────────────────────────────────────────────────── */
.cta {
  position: relative;
  overflow: hidden;
  padding: 110px var(--gutter);
  background: var(--bam-blue);
  color: var(--bam-ink);
}

.cta__rays {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cta__inner {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  text-align: center;
}

.cta h2 {
  font-size: clamp(34px, 4.5vw, 58px);
}

.cta__button {
  background: var(--bam-white);
}

@media (prefers-reduced-motion: reduce) {
  .stop__dot {
    transition: none;
  }

  .stop:hover .stop__dot,
  .stop:focus-within .stop__dot {
    transform: none;
  }
}
</style>
