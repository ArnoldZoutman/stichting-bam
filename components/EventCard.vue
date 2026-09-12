<script setup lang="ts">
import type { EventSummary } from '~~/server/utils/wp-types'

const props = defineProps<{ event: EventSummary }>()

const { formatEventPeriod, formatEventTime } = useEventDate()

const meta = computed(() => {
  const parts = [formatEventPeriod(props.event.startDate, props.event.endDate)]
  const time = formatEventTime(props.event.startTime, props.event.endTime)
  if (time) parts.push(time)
  if (props.event.locationName) parts.push(props.event.locationName)
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <li class="event-card" :class="{ 'event-card--past': !event.isUpcoming }">
    <NuxtLink v-if="event.featuredImage" :to="`/uitvoeringen/${event.slug}`" class="event-card__image">
      <img
        :src="event.featuredImage.src"
        :srcset="event.featuredImage.srcset || undefined"
        sizes="(max-width: 48rem) 100vw, 20rem"
        :alt="event.featuredImage.alt"
        :width="event.featuredImage.width"
        :height="event.featuredImage.height"
        loading="lazy"
        decoding="async"
      >
    </NuxtLink>
    <div class="event-card__body">
      <p class="event-card__status">{{ event.isUpcoming ? 'Aankomend' : 'Geweest' }}</p>
      <h2><NuxtLink :to="`/uitvoeringen/${event.slug}`">{{ event.title }}</NuxtLink></h2>
      <p v-if="meta" class="event-card__meta">{{ meta }}</p>
      <p v-if="event.description" class="event-card__excerpt">{{ event.description }}</p>
    </div>
  </li>
</template>
