<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: event, error } = await useFetch(`/api/event/${slug.value}`, {
  key: `event-${slug.value}`,
})

if (error.value || !event.value) {
  throw createError({ statusCode: 404, statusMessage: 'Voorstelling niet gevonden', fatal: true })
}

const { formatEventPeriod, formatEventTime } = useEventDate()

const meta = computed(() => {
  if (!event.value) return ''
  const parts = [formatEventPeriod(event.value.startDate, event.value.endDate)]
  const time = formatEventTime(event.value.startTime, event.value.endTime)
  if (time) parts.push(time)
  if (event.value.locationName) parts.push(event.value.locationName)
  return parts.filter(Boolean).join(' · ')
})

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
  <article v-if="event" class="container">
    <div class="page-header">
      <h1>{{ event.title }}</h1>
      <p v-if="meta" class="page-header__meta">{{ meta }}</p>
      <p v-if="!event.isUpcoming" class="page-header__meta">Deze voorstelling heeft al plaatsgevonden.</p>
    </div>

    <figure v-if="event.featuredImage" class="page-hero">
      <img
        :src="event.featuredImage.src"
        :srcset="event.featuredImage.srcset || undefined"
        sizes="(max-width: 72rem) 100vw, 72rem"
        :alt="event.featuredImage.alt"
        :width="event.featuredImage.width"
        :height="event.featuredImage.height"
        decoding="async"
      >
    </figure>

    <WpContent v-if="!event.isEmpty" :html="event.html" />
    <div v-else class="content-notice">
      <p>Deze voorstelling heeft geen tekstuele inhoud.</p>
    </div>

    <p style="margin-top: var(--ruimte-l)">
      <NuxtLink class="button" to="/uitvoeringen">Terug naar uitvoeringen</NuxtLink>
    </p>
  </article>
</template>
