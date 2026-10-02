<script setup lang="ts">
/**
 * Agenda-overzicht, opgebouwd uit Events Manager (`/api/events`), volgens
 * design-reference/pages/Uitvoeringen.dc.html: tabs Komend / Archief.
 *
 * Deze route botst met de WP-PAGINA "uitvoeringen" (id 8, lege titel): die
 * bestaat nog in WordPress, maar Vue Router geeft een statische route als
 * deze voorrang boven de catch-all (`pages/[...slug].vue`), dus deze pagina
 * wint altijd. De WP-pagina bevat alleen een handmatige kopie van dezelfde
 * voorstellingen en wordt daarom niet getoond.
 *
 * TABS: beide panelen staan altijd in de geprerenderde HTML; het inactieve
 * paneel krijgt alleen `hidden`. Dat is nodig voor de faal-check (die zoekt
 * voorstellingstitels in uitvoeringen/index.html) en voor zoekmachines. Het
 * wisselen gebeurt client-side. Zonder komende voorstellingen opent de
 * pagina op "Archief". De gekozen tab staat in de hash (#archief), zodat
 * terugnavigeren hem bewaart.
 */
const { data: events, error } = await useFetch('/api/events', { key: 'uitvoeringen' })

if (error.value) {
  throw createError({
    statusCode: 502,
    statusMessage: 'Voorstellingen konden niet worden geladen',
    fatal: true,
  })
}

const upcoming = computed(() => events.value?.upcoming ?? [])
const past = computed(() => events.value?.past ?? [])
const numbers = computed(() => productionNumbers([...upcoming.value, ...past.value]))

type TabId = 'komend' | 'archief'
const tabs: { id: TabId, label: string }[] = [
  { id: 'komend', label: 'Komend' },
  { id: 'archief', label: 'Archief' },
]
const active = ref<TabId>(upcoming.value.length ? 'komend' : 'archief')
const tabRefs = ref<HTMLButtonElement[]>([])

const route = useRoute()

// Uit de router en niet uit `window.location.hash`: die is tijdens hydratie
// tijdelijk leeg (gemeten), de router kent de hash van de initiële URL wel.
onMounted(() => {
  const fromHash = route.hash.slice(1)
  if (fromHash === 'komend' || fromHash === 'archief') active.value = fromHash
})

function select(id: TabId, focus = false) {
  active.value = id
  history.replaceState(history.state, '', `#${id}`)
  if (focus) tabRefs.value[tabs.findIndex((t) => t.id === id)]?.focus()
}

/** WAI-ARIA tabs-patroon: pijltjes, Home en End verplaatsen en activeren. */
function onKeydown(event: KeyboardEvent, index: number) {
  const last = tabs.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  select(tabs[next]!.id, true)
}

const { eventDateParts, formatEventTime } = useEventDate()

function rowMeta(event: { locationName: string | null, startTime: string | null }) {
  return [event.locationName, event.startTime ? `Aanvang ${formatEventTime(event.startTime, null)}` : '']
    .filter(Boolean)
    .join(' · ')
}

useWpSeo({
  title: 'Uitvoeringen',
  description: 'Voorstellingen van Stichting BAM: aankomende producties en het archief van eerdere voorstellingen.',
  path: '/uitvoeringen',
})
</script>

<template>
  <div>
    <PageHero
      eyebrow="Programma"
      title="Uitvoeringen"
      intro="Komende voorstellingen en alle producties van BAM tot nu toe."
    />

    <section class="agenda">
      <div class="agenda__inner">
        <div role="tablist" aria-label="Weergave" class="tabs">
          <button
            v-for="(tab, i) in tabs"
            :id="`tab-${tab.id}`"
            :key="tab.id"
            ref="tabRefs"
            type="button"
            role="tab"
            class="tab"
            :aria-selected="active === tab.id ? 'true' : 'false'"
            :aria-controls="`paneel-${tab.id}`"
            :tabindex="active === tab.id ? 0 : -1"
            @click="select(tab.id)"
            @keydown="onKeydown($event, i)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div
          id="paneel-komend"
          role="tabpanel"
          aria-labelledby="tab-komend"
          tabindex="0"
          :hidden="active !== 'komend'"
        >
          <ul v-if="upcoming.length" class="rows">
            <li v-for="event in upcoming" :key="event.id" class="row reveal">
              <div v-if="eventDateParts(event.startDate, event.endDate)" class="row__date">
                <span class="row__day">{{ eventDateParts(event.startDate, event.endDate)!.day }}</span>
                <span class="row__month">{{ eventDateParts(event.startDate, event.endDate)!.month }}</span>
              </div>
              <div class="row__body">
                <h2 class="row__title">{{ event.title }}</h2>
                <p v-if="rowMeta(event)" class="row__meta">{{ rowMeta(event) }}</p>
              </div>
              <BamButton :to="`/uitvoeringen/${event.slug}`" variant="secondary" size="small">
                Info<span class="visually-hidden"> over {{ event.title }}</span>
              </BamButton>
            </li>
          </ul>
          <p v-else class="empty">Er staan op dit moment geen nieuwe voorstellingen gepland.</p>
        </div>

        <div
          id="paneel-archief"
          role="tabpanel"
          aria-labelledby="tab-archief"
          tabindex="0"
          :hidden="active !== 'archief'"
        >
          <ul v-if="past.length" class="card-grid archive">
            <li v-for="(event, i) in past" :key="event.id" class="reveal">
              <EventCard :event="event" variant="archive" :num="numbers.get(event.id)?.roman" :heading-level="2" :eager="i === 0 && active === 'archief'" />
            </li>
          </ul>
          <p v-else class="empty">Er zijn nog geen eerdere voorstellingen.</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.agenda {
  padding: 72px var(--gutter) var(--section-y);
}

.agenda__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.tab {
  min-height: 48px;
  padding: 14px 32px;
  border: 1.5px solid var(--bam-night);
  background: var(--bam-white);
  color: var(--bam-night);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease;
}

.tab:hover {
  background: var(--bam-mist);
}

.tab[aria-selected='true'] {
  background: var(--bam-night);
  color: var(--bam-white);
}

[role='tabpanel']:focus-visible {
  outline-offset: 8px;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 2px solid var(--bam-night);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px 40px;
  padding: 32px 16px;
  border-bottom: 1px solid rgba(10, 42, 107, 0.25);
  background: var(--bam-white);
  transition: background 0.3s ease;
}

.row:hover {
  background: var(--bam-mist);
}

.row__date {
  flex: none;
  width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.row__day {
  font-family: var(--font-accent);
  font-size: 52px;
  line-height: 1;
  color: var(--bam-night);
  white-space: nowrap;
}

.row__month {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--bam-label);
}

.row__body {
  flex: 999 1 320px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row__title {
  margin: 0;
  font-size: 34px;
  letter-spacing: 1px;
  line-height: 1.15;
}

.row__meta {
  margin: 0;
  font-size: 16px;
  color: var(--bam-body);
}

.archive {
  margin: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
}

.empty {
  margin: 0;
  padding: 40px 24px;
  border-top: 2px solid var(--bam-night);
  text-align: center;
  font-size: 18px;
  color: var(--bam-body);
}
</style>
