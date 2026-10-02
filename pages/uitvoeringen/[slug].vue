<script setup lang="ts">
/**
 * Voorstellingspagina volgens design-reference/pages/Voorstelling.dc.html.
 *
 * Alleen secties waarvoor Events Manager data levert. Wat de API NIET heeft
 * en dus ontbreekt (zie eindrapport redesign): speeldata per voorstelling met
 * status, ticketpartner/kaartlink, korte pitch, kop boven het verhaal, duur,
 * leeftijd, prijs, toegankelijkheid, trailer, cast & crew (staat alleen als
 * lopende tekst in de content), fotogalerij. Locatie toont alleen als
 * `event_location_name` gevuld is (nu bij geen enkele voorstelling).
 *
 * Het productienummer in de eyebrow is AFGELEID (composables/useProductions).
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: event, error } = await useFetch(`/api/event/${slug.value}`, {
  key: `event-${slug.value}`,
})

if (error.value || !event.value) {
  throw createError({ statusCode: 404, statusMessage: 'Voorstelling niet gevonden', fatal: true })
}

// Alleen nodig voor het productienummer; mag de pagina niet laten falen.
const { data: events } = await useFetch('/api/events', {
  key: 'uitvoeringen',
  default: () => ({ upcoming: [], past: [] }),
})

const { formatEventPeriod, formatEventTime } = useEventDate()

const production = computed(() =>
  event.value ? productionNumbers([...events.value.upcoming, ...events.value.past]).get(event.value.id) : undefined,
)

const period = computed(() => (event.value ? formatEventPeriod(event.value.startDate, event.value.endDate) : ''))
const time = computed(() => (event.value ? formatEventTime(event.value.startTime, event.value.endTime) : ''))
const metaParts = computed(() => [period.value, time.value, event.value?.locationName ?? ''].filter(Boolean))

useWpSeo({
  title: event.value.title,
  description: event.value.description,
  path: `/uitvoeringen/${slug.value}`,
  image: event.value.featuredImage,
  type: 'article',
  publishedAt: event.value.date,
})
</script>

<template>
  <article v-if="event" class="voorstelling">
    <section class="hero">
      <div class="hero__sun sun" aria-hidden="true"><div class="sunburst" /></div>
      <div class="hero__inner">
        <nav class="crumb" aria-label="Kruimelpad">
          <ol>
            <li><NuxtLink to="/uitvoeringen">Uitvoeringen</NuxtLink></li>
            <li><span aria-current="page">{{ event.title }}</span></li>
          </ol>
        </nav>
        <div class="hero__grid">
          <div class="hero__text">
            <EyebrowLabel tone="dark">
              <template v-if="production">Productie {{ production.roman }} · </template>Muziektheater
            </EyebrowLabel>
            <h1>{{ event.title }}</h1>
            <span class="hero__rule" aria-hidden="true" />
            <p v-if="metaParts.length" class="hero__meta">
              <template v-for="(part, i) in metaParts" :key="part">
                <span v-if="i > 0" class="diamond" aria-hidden="true">◆</span><span>{{ part }}</span>
              </template>
            </p>
            <p v-if="!event.isUpcoming" class="hero__status">Deze voorstelling heeft al plaatsgevonden.</p>
          </div>
          <!-- Maat op een wrapper, niet als klasse op ArchFrame: die zou met
               gelijke specificiteit van de CSS-volgorde afhangen (gemeten CLS). -->
          <div v-if="event.featuredImage" class="hero__poster">
            <ArchFrame
              :image="event.featuredImage"
              :fan="false"
              eager
              sizes="(max-width: 900px) 100vw, 460px"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="about" aria-labelledby="over-de-voorstelling">
      <div class="about__inner">
        <div class="about__text reveal">
          <EyebrowLabel id="over-de-voorstelling" tag="h2">Over de voorstelling</EyebrowLabel>
          <WpContent v-if="!event.isEmpty" :html="event.html" />
          <p v-else class="about__empty">Deze voorstelling heeft geen tekstuele inhoud.</p>
          <div>
            <BamButton to="/uitvoeringen" variant="secondary">Alle uitvoeringen</BamButton>
          </div>
        </div>
        <aside v-if="period || time || event.locationName" class="practical reveal" aria-labelledby="praktisch">
          <h2 id="praktisch" class="practical__title">Praktisch</h2>
          <dl>
            <div v-if="period">
              <dt>Datum</dt>
              <dd>{{ period }}</dd>
            </div>
            <div v-if="time">
              <dt>Tijd</dt>
              <dd>{{ time }}</dd>
            </div>
            <div v-if="event.locationName">
              <dt>Locatie</dt>
              <dd>{{ event.locationName }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  </article>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────────────────────── */
.hero {
  --sun-range: 700px;
  position: relative;
  overflow: hidden;
  padding: 72px var(--gutter) 110px;
  background: var(--bam-night);
  color: var(--bam-white);
}

/* Bovenaan verankerd met een vaste hoogte, niet als % van de hero: anders
   verschuift de krans zodra de hero door font-swap een fractie groeit (CLS).
   Het stralenpunt ligt zo net als in het prototype ruim onder de hero. */
.hero__sun {
  position: absolute;
  left: -20%;
  right: -20%;
  top: -400px;
  height: 1700px;
  pointer-events: none;
}

.hero__sun > div {
  width: 100%;
  height: 100%;
}

.hero__inner {
  position: relative;
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.crumb ol {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bam-body-on-night);
}

.crumb li + li::before {
  content: '/';
  margin-right: 10px;
}

.crumb a {
  color: var(--bam-body-on-night);
  text-decoration: none;
}

.crumb a:hover {
  color: var(--bam-white);
}

.crumb [aria-current] {
  color: var(--bam-orange);
}

.hero__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
  gap: 64px;
  align-items: center;
}

.hero__text {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

h1 {
  margin: 0;
  font-size: clamp(44px, 7vw, 100px);
  line-height: 0.98;
  letter-spacing: 3px;
  overflow-wrap: anywhere;
}

.hero__rule {
  display: block;
  width: 96px;
  height: 3px;
  background: var(--bam-blue);
}

.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 28px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.diamond {
  color: var(--bam-orange);
}

.hero__status {
  margin: 0;
  font-size: 17px;
  color: var(--bam-body-on-night);
}

.hero__poster {
  justify-self: center;
  width: min(460px, 100%);
}

/* ── Over de voorstelling ─────────────────────────────────────────────── */
.about {
  padding: var(--section-y) var(--gutter);
}

.about__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 64px;
  align-items: flex-start;
}

.about__text {
  flex: 999 1 520px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 22px;
  font-size: 19px;
  line-height: 1.8;
  color: var(--bam-body);
}

.about__empty {
  margin: 0;
}

.practical {
  flex: 1 1 300px;
  padding: 36px 32px;
  border-top: 6px solid var(--bam-orange);
  background: var(--bam-night);
  color: var(--bam-white);
}

.practical__title {
  margin: 0 0 22px;
  font-family: var(--font-accent);
  font-size: 24px;
  letter-spacing: 0;
  color: var(--bam-orange);
}

.practical dl {
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin: 0;
}

.practical dt {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--bam-body-on-night);
}

.practical dd {
  margin: 4px 0 0;
  font-size: 18px;
}
</style>
