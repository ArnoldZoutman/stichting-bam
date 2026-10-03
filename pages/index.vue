<script setup lang="ts">
import { mainNavigation } from '~/config/navigation'
import { siteFacts } from '~/config/site'

/**
 * Startpagina volgens design-reference/pages/Main.dc.html: gordijn-hero en
 * een reeks "scènes".
 *
 * LET OP: de WP-pagina `home` bevat als enige inhoud `[rev_slider_vc
 * alias="tegen-tijd"]`. Revolution Slider publiceert zijn slides NIET via de
 * REST API. Alle scènes worden daarom uit wél beschikbare API-data opgebouwd;
 * er wordt geen tekst verzonnen. Elke scène verschijnt alleen als er data
 * voor is, en de nummering (Scène I, II, …) telt alleen de zichtbare scènes.
 *
 *  - Volgende voorstelling: eerstvolgende komende voorstelling (nu geen).
 *  - Terugblik: de meest recente voorbije voorstelling.
 *  - In beeld: de fotocarrousel uit WordPress (Weergave → Homepage-carrousel).
 *    Lege lijst of mislukte call → geen scène (zie getHomeCarousel).
 *  - Uitvoeringen: de drie meest recente voorstellingen. De faal-check eist
 *    links naar min(3, n) voorstellingen op deze pagina.
 *  - Nieuws: de drie nieuwste berichten. Staat niet in het prototype, maar de
 *    faal-check eist berichttitels op de homepage (afgesproken in fase 0).
 *  - Achter de schermen: eerste alinea van de pagina "Over ons".
 *
 * Als de `home`-pagina in WordPress ooit echte content krijgt, wordt die
 * onder de hero alsnog getoond.
 */
const { data: site } = await useSiteInfo()

const { data: home } = await useFetch('/api/page/home', {
  key: 'page-home',
  // Een ontbrekende home-pagina mag de startpagina niet laten crashen.
  default: () => null,
})

const { data: posts } = await useFetch('/api/posts', {
  key: 'home-posts',
  query: { page: 1, per_page: 3 },
  default: () => ({ items: [], page: 1, totalPages: 0, total: 0 }),
})

const { data: events } = await useFetch('/api/events', {
  key: 'home-events',
  // Een falende agenda-call mag de rest van de startpagina niet laten
  // crashen. Een ECHTE mislukking wordt nog steeds vastgelegd door
  // server/utils/build-report.ts en laat de faal-check falen.
  default: () => ({ upcoming: [], past: [] }),
})

const { data: carousel } = await useHomeCarousel()

const { data: overOns } = await useFetch('/api/page/over-ons', {
  key: 'page-over-ons-intro',
  default: () => null,
})

const { formatEventPeriod } = useEventDate()

const allEvents = computed(() => [...events.value.upcoming, ...events.value.past])
const numbers = computed(() => productionNumbers(allEvents.value))

/** De drie meest recente voorstellingen, komend of geweest, aflopend op datum. */
const recentEvents = computed(() =>
  [...allEvents.value]
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
    .slice(0, 3),
)

const nextEvent = computed(() => events.value.upcoming[0] ?? null)
const lastEvent = computed(() => events.value.past[0] ?? null)

function eventLine(event: { id: number, startDate: string | null, endDate: string | null, locationName: string | null }, withOrdinal = false) {
  const ordinal = numbers.value.get(event.id)?.ordinal
  return [
    withOrdinal && ordinal ? `Onze ${ordinal} productie` : '',
    event.locationName ?? '',
    formatEventPeriod(event.startDate, event.endDate),
  ].filter(Boolean)
}

const mission = computed(() => overOns.value?.lead ?? '')
const aboutPath = mainNavigation.find((item) => item.label === 'Over BAM')?.to ?? '/over-ons'

/** Zichtbare scènes in volgorde; de index bepaalt het Romeinse nummer. */
const scenes = computed(() => {
  const list: string[] = []
  if (nextEvent.value) list.push('next')
  if (lastEvent.value) list.push('retro')
  if (carousel.value.length) list.push('gallery')
  if (recentEvents.value.length) list.push('program')
  if (posts.value.items.length) list.push('news')
  list.push('about')
  return list
})

function scene(key: string): string {
  const i = scenes.value.indexOf(key)
  return i >= 0 ? `Scène ${toRoman(i + 1)}` : ''
}

const titel = computed(() => site.value?.name || 'Stichting BAM')
/**
 * De sitebeschrijving in WordPress is leeg en `home` heeft geen tekst. In
 * plaats van een omschrijving te verzinnen gebruiken we die van "Over ons".
 */
const omschrijving = computed(
  () => home.value?.description || site.value?.description || overOns.value?.description || '',
)

useWpSeo({
  title: titel.value,
  description: omschrijving.value,
  path: '/',
  image: home.value?.featuredImage ?? overOns.value?.featuredImage ?? null,
})
</script>

<template>
  <div class="home">
    <!-- Hero: het doek -->
    <section class="hero" aria-labelledby="home-titel">
      <div class="hero__sun sun" aria-hidden="true"><div class="sunburst" /></div>
      <div class="hero__arch hero__arch--outer" aria-hidden="true" />
      <div class="hero__arch hero__arch--inner" aria-hidden="true" />

      <div class="hero__content">
        <img class="hero__logo" src="/logo.png" alt="" width="150" height="150" fetchpriority="high">
        <EyebrowLabel tone="dark">Bergen op Zoom · sinds {{ siteFacts.foundedYear }}</EyebrowLabel>
        <svg class="hero__ornament" width="120" height="24" viewBox="0 0 120 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M0 12h44M76 12h44" /><path d="M60 2l10 10-10 10-10-10z" /><path d="M60 7l5 5-5 5-5-5z" /></svg>
        <h1 id="home-titel">{{ titel }}</h1>
        <p class="hero__subtitle">Bergse Alliantie voor Muziektheater</p>
        <div class="hero__actions">
          <BamButton v-if="nextEvent" to="#volgende" tone="dark">Volgende voorstelling</BamButton>
          <BamButton v-else to="/uitvoeringen" tone="dark">Alle uitvoeringen</BamButton>
          <BamButton to="#over" variant="secondary" tone="dark">Over BAM</BamButton>
        </div>
      </div>

      <div class="hero__curtain hero__curtain--l curtain-l deco-pattern" aria-hidden="true" />
      <div class="hero__curtain hero__curtain--r curtain-r deco-pattern" aria-hidden="true" />

      <div class="hero__hint hint" aria-hidden="true">
        <span>Het doek gaat op</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6l5 5 5-5" /></svg>
      </div>
    </section>

    <section v-if="home && !home.isEmpty" class="home-content">
      <div class="container">
        <WpContent :html="home.html" />
      </div>
    </section>

    <!-- Volgende voorstelling -->
    <section v-if="nextEvent" id="volgende" class="next" aria-labelledby="volgende-titel">
      <div class="next__grid">
        <ArchFrame :image="nextEvent.featuredImage" sizes="(max-width: 900px) calc(100vw - 80px), 530px" />
        <div class="next__text reveal">
          <EyebrowLabel rule>{{ scene('next') }} · De volgende voorstelling</EyebrowLabel>
          <h2 id="volgende-titel">{{ nextEvent.title }}</h2>
          <p class="next__meta">
            <template v-for="(part, i) in eventLine(nextEvent)" :key="part">
              <span v-if="i > 0" class="diamond" aria-hidden="true">◆</span><span>{{ part }}</span>
            </template>
          </p>
          <p v-if="nextEvent.description" class="next__desc">{{ nextEvent.description }}</p>
          <div class="actions">
            <BamButton :to="`/uitvoeringen/${nextEvent.slug}`" variant="secondary">Meer informatie</BamButton>
          </div>
        </div>
      </div>
    </section>

    <!-- Terugblik -->
    <section v-if="lastEvent" class="retro" aria-labelledby="terugblik-titel">
      <div class="retro__head reveal">
        <EyebrowLabel tone="ink">{{ scene('retro') }} · Terugblik</EyebrowLabel>
        <p class="retro__line">{{ eventLine(lastEvent, true).join(' · ') }}</p>
      </div>
      <h2 id="terugblik-titel" class="visually-hidden">{{ lastEvent.title }}</h2>
      <p class="retro__drift retro__drift--solid drift-l" aria-hidden="true">{{ lastEvent.title }} ◆ {{ lastEvent.title }} ◆ {{ lastEvent.title }}</p>
      <p class="retro__drift retro__drift--outline drift-r" aria-hidden="true">{{ lastEvent.title }} ◆ {{ lastEvent.title }} ◆ {{ lastEvent.title }}</p>
      <div class="retro__actions reveal">
        <BamButton :to="`/uitvoeringen/${lastEvent.slug}`" variant="secondary">Meer informatie</BamButton>
      </div>
    </section>

    <!-- In beeld: fotocarrousel -->
    <HomeCarousel
      v-if="carousel.length"
      :items="carousel"
      :index="scenes.indexOf('gallery') + 1"
    />

    <!-- Uitvoeringen -->
    <section v-if="recentEvents.length" id="uitvoeringen" class="program" aria-labelledby="programma-titel">
      <div class="container program__inner">
        <div class="section-head reveal">
          <div class="section-head__titles">
            <EyebrowLabel>{{ scene('program') }} · Uitvoeringen</EyebrowLabel>
            <h2 id="programma-titel">Op het programma</h2>
          </div>
          <NuxtLink to="/uitvoeringen" class="more-link">Alle uitvoeringen <span aria-hidden="true">→</span></NuxtLink>
        </div>
        <ul class="card-grid">
          <li v-for="event in recentEvents" :key="event.id" class="reveal">
            <EventCard :event="event" />
          </li>
        </ul>
      </div>
    </section>

    <!-- Nieuws -->
    <section v-if="posts.items.length" class="news" aria-labelledby="nieuws-titel">
      <div class="container program__inner">
        <div class="section-head reveal">
          <div class="section-head__titles">
            <EyebrowLabel>{{ scene('news') }} · Nieuws</EyebrowLabel>
            <h2 id="nieuws-titel">Laatste nieuws</h2>
          </div>
          <NuxtLink to="/nieuws" class="more-link">Alle berichten <span aria-hidden="true">→</span></NuxtLink>
        </div>
        <ul class="card-grid">
          <li v-for="post in posts.items" :key="post.id" class="reveal">
            <NewsCard :post="post" />
          </li>
        </ul>
      </div>
    </section>

    <!-- Achter de schermen -->
    <section id="over" class="about" aria-labelledby="over-titel">
      <div class="sunburst-light about__rays" aria-hidden="true" />
      <div class="about__inner reveal">
        <EyebrowLabel tone="ink">{{ scene('about') }} · Achter de schermen</EyebrowLabel>
        <svg width="160" height="40" viewBox="0 0 160 40" aria-hidden="true" fill="none" stroke="#FFFFFF" stroke-width="1.5"><path d="M80 38 L80 4" /><path d="M80 38 L52 10" /><path d="M80 38 L108 10" /><path d="M80 38 L30 26" /><path d="M80 38 L130 26" /><path d="M20 38h120" /></svg>
        <h2 id="over-titel">Muziektheater uit Bergen op Zoom</h2>
        <p v-if="mission" class="about__mission">{{ mission }}</p>
        <BamButton :to="aboutPath" variant="secondary" class="about__button">Lees ons verhaal</BamButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
h2 {
  margin: 0;
}

/* ── Hero ─────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: min(780px, 100svh);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bam-night);
  color: var(--bam-white);
}

.hero__sun {
  position: absolute;
  left: -25%;
  right: -25%;
  bottom: -10%;
  height: 140%;
  pointer-events: none;
}

.hero__sun > div {
  width: 100%;
  height: 100%;
}

.hero__arch {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  border-bottom: none;
  pointer-events: none;
}

.hero__arch--outer {
  width: min(760px, 88%);
  height: min(640px, 82%);
  border: 2px solid var(--bam-orange);
  border-bottom: none;
  border-radius: 380px 380px 0 0;
}

.hero__arch--inner {
  width: min(720px, 82%);
  height: min(610px, 78%);
  border: 1px solid var(--bam-blue);
  border-bottom: none;
  border-radius: 360px 360px 0 0;
}

.hero__content {
  position: relative;
  z-index: 2;
  max-width: 760px;
  padding: 120px var(--gutter) 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  text-align: center;
}

.hero__logo {
  display: block;
  width: clamp(110px, 30vw, 150px);
  height: auto;
}

.hero__ornament {
  color: var(--bam-blue);
}

.hero h1 {
  margin: 0;
  font-size: clamp(40px, 9vw, 120px);
  line-height: 0.95;
  letter-spacing: clamp(2px, 0.6vw, 6px);
  color: var(--bam-white);
}

.hero__subtitle {
  margin: 0;
  font-family: var(--font-accent);
  font-size: clamp(18px, 2.2vw, 26px);
  letter-spacing: 3px;
  color: var(--bam-orange);
}

.hero__actions,
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
}

.hero__curtain {
  position: absolute;
  z-index: 3;
  top: 0;
  bottom: 0;
  width: 17%;
}

@media (max-width: 600px) {
  .hero__curtain {
    width: 9%;
  }

  /* Tekst blijft vrij van de (nog dichte) gordijnen. */
  .hero__content {
    padding-inline: calc(9% + 16px);
  }
}

.hero__curtain--l {
  left: 0;
  border-right: 3px solid var(--bam-blue);
  box-shadow: 12px 0 40px rgba(5, 20, 60, 0.45);
}

.hero__curtain--r {
  right: 0;
  border-left: 3px solid var(--bam-blue);
  box-shadow: -12px 0 40px rgba(5, 20, 60, 0.45);
}

.hero__hint {
  position: absolute;
  z-index: 4;
  bottom: 28px;
  left: 50%;
  margin-left: -100px;
  width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 4px;
  text-align: center;
  text-transform: uppercase;
  color: var(--bam-body-on-night);
}

.hero__hint svg {
  color: var(--bam-orange);
}

.home-content {
  padding: var(--section-y) 0;
}

/* ── Volgende voorstelling ─────────────────────────────────────────────── */
.next {
  padding: var(--section-y) var(--gutter);
  background: var(--bam-sky);
}

.next__grid {
  max-width: var(--container);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
  gap: clamp(40px, 6vw, 72px);
  align-items: center;
}

.next__text {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.next h2 {
  font-size: clamp(40px, 5vw, 68px);
  line-height: 1.05;
}

.next__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 1px;
}

.diamond {
  color: var(--bam-orange);
}

.next__desc {
  margin: 0;
  max-width: 52ch;
  font-size: 18px;
  line-height: 1.7;
  color: var(--bam-body);
}

.next .actions {
  justify-content: flex-start;
  margin-top: 8px;
}

/* ── Terugblik ─────────────────────────────────────────────────────────── */
.retro {
  position: relative;
  overflow: hidden;
  padding: var(--section-y) 0 var(--section-y-lg);
  background: var(--bam-peach);
  color: var(--bam-ink);
}

.retro__head {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.retro__line {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}

.retro__drift {
  margin: 0;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: clamp(72px, 15vw, 220px);
  line-height: 1;
  letter-spacing: 8px;
}

.retro__drift--solid {
  margin-top: 40px;
  color: var(--bam-ink);
}

.retro__drift--outline {
  color: transparent;
  -webkit-text-stroke: 1.5px var(--bam-white);
}

.retro__actions {
  display: flex;
  justify-content: center;
  margin-top: 56px;
  padding: 0 var(--gutter);
}

/* ── Uitvoeringen & nieuws ─────────────────────────────────────────────── */
.program,
.news {
  padding: var(--section-y) 0;
}

.program {
  background: var(--bam-white);
}

.news {
  background: var(--bam-mist);
}

.program__inner {
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.section-head__titles {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-head h2 {
  font-size: clamp(40px, 5vw, 64px);
}

.more-link {
  padding-bottom: 6px;
  border-bottom: 3px solid var(--bam-orange);
  color: var(--bam-ink);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3px;
  text-decoration: none;
  text-transform: uppercase;
}

.more-link:hover {
  color: var(--bam-label);
}

.program .card-grid,
.news .card-grid {
  margin: 0;
}

/* ── Achter de schermen ────────────────────────────────────────────────── */
.about {
  position: relative;
  overflow: hidden;
  padding: var(--section-y-lg) var(--gutter);
  background: var(--bam-blue);
  color: var(--bam-ink);
}

.about__rays {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.about__inner {
  position: relative;
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  text-align: center;
}

.about h2 {
  font-size: clamp(36px, 4.5vw, 60px);
  line-height: 1.1;
}

.about__mission {
  margin: 0;
  font-size: 19px;
  line-height: 1.75;
}

/* Witte knop met inkt-lijn op het blauwe vlak, zoals in het prototype. */
.about__button {
  background: var(--bam-white);
}
</style>
