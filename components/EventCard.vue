<script setup lang="ts">
import type { EventSummary } from '~~/server/utils/wp-types'

/**
 * Kaart voor een voorstelling; de hele kaart is één link naar de detailpagina.
 *
 *  - variant `program` (home, Scène III): beeld 16:10, grote dag + maand/jaar
 *    of locatie, titel.
 *  - variant `archive` (uitvoeringen, tab Archief): beeld 4:3 met optioneel
 *    een productienummer erover, titel, jaar · locatie.
 *
 * Locatie wordt alleen getoond als Events Manager hem levert (nu bij geen
 * enkel event; zie MIGRATIE.md). Zonder affiche valt het beeld terug op een
 * decoratief zonnestralenvlak.
 */
const props = withDefaults(
  defineProps<{
    event: EventSummary
    variant?: 'program' | 'archive'
    /** Productienummer (Romeins), afgeleid door de aanroeper. */
    num?: string
    headingLevel?: 2 | 3 | 4
    /** Eerste kaart boven de vouw: niet lazy laden (LCP). */
    eager?: boolean
  }>(),
  { variant: 'program', num: undefined, headingLevel: 3, eager: false },
)

const { eventDateParts } = useEventDate()
const parts = computed(() => eventDateParts(props.event.startDate, props.event.endDate))

const archiveMeta = computed(() =>
  [parts.value?.year, props.event.locationName].filter(Boolean).join(' · '),
)
</script>

<template>
  <NuxtLink :to="`/uitvoeringen/${event.slug}`" class="event-card" :class="`event-card--${variant}`">
    <div class="event-card__media">
      <img
        v-if="event.featuredImage"
        class="event-card__img"
        :src="event.featuredImage.src"
        :srcset="event.featuredImage.srcset || undefined"
        sizes="(max-width: 760px) calc(100vw - 80px), (max-width: 1100px) calc(50vw - 60px), 350px"
        :alt="event.featuredImage.alt"
        :width="event.featuredImage.width"
        :height="event.featuredImage.height"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : undefined"
        decoding="async"
      >
      <div v-else class="event-card__img sunburst" aria-hidden="true" />
      <span v-if="variant === 'archive' && num" class="event-card__num" aria-hidden="true">{{ num }}</span>
    </div>

    <div v-if="variant === 'program' && parts" class="event-card__date">
      <span class="event-card__day">{{ parts.day }}</span>
      <span class="event-card__date-meta">
        <span>{{ parts.month }} {{ parts.year }}</span>
        <span v-if="event.locationName">{{ event.locationName }}</span>
      </span>
    </div>

    <component :is="`h${headingLevel}`" class="event-card__title">
      <span v-if="variant === 'archive' && num" class="visually-hidden">Productie {{ num }}: </span>{{ event.title }}
    </component>

    <p v-if="variant === 'archive' && archiveMeta" class="event-card__meta">{{ archiveMeta }}</p>
  </NuxtLink>
</template>

<style scoped>
.event-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  padding: 14px 14px 26px;
  background: var(--bam-mist);
  border: var(--card-border);
  box-shadow: 0 6px 18px rgba(10, 42, 107, 0.08);
  color: var(--bam-ink);
  text-decoration: none;
  transition: transform 0.5s ease, box-shadow 0.5s ease;
}

.event-card:hover {
  color: var(--bam-ink);
  transform: translateY(-4px);
  box-shadow: var(--card-shadow-hover);
}

.event-card:focus-visible {
  box-shadow: var(--focus-halo), var(--card-shadow-hover);
}

.event-card__media {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bam-night);
}

.event-card--archive .event-card:focus-visible {
  box-shadow: var(--focus-halo), var(--card-shadow-hover);
}

.event-card__media {
  aspect-ratio: 4 / 3;
}

.event-card__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.event-card:hover .event-card__img {
  transform: scale(1.04);
}

/* Op een night-vlak i.p.v. los op de foto: op drukke affiches is oranje
   anders onleesbaar. Night + oranje = 6.2:1, ongeacht het beeld. */
.event-card__num {
  position: absolute;
  left: 0;
  bottom: 0;
  padding: 10px 16px 6px;
  border-top: 3px solid var(--bam-orange);
  background: var(--bam-night);
  font-family: var(--font-accent);
  font-size: 44px;
  line-height: 1;
  color: var(--bam-orange);
}

.event-card__date {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 8px;
}

.event-card__day {
  font-family: var(--font-accent);
  font-size: 40px;
  line-height: 1;
  color: var(--bam-night);
  white-space: nowrap;
}

.event-card__date-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bam-label);
}

.event-card__title {
  margin: 0;
  padding: 0 8px;
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 1px;
}

.event-card--archive .event-card__title {
  font-size: 30px;
}

.event-card__meta {
  margin: 0;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bam-label);
}

@media (prefers-reduced-motion: reduce) {
  .event-card,
  .event-card__img {
    transition: none;
  }

  .event-card:hover,
  .event-card:hover .event-card__img {
    transform: none;
  }
}
</style>
