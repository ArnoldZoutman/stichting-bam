<script setup lang="ts">
/**
 * Catch-all voor alle WP-pagina's. Alle 9 pagina's hebben `parent: 0`, dus de
 * structuur is plat: we accepteren alleen een enkel pad-segment.
 */
const route = useRoute()

const slugSegments = computed(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? raw.filter(Boolean) : [raw].filter(Boolean)
})

const slug = computed(() => String(slugSegments.value[slugSegments.value.length - 1] ?? ''))

// Geneste paden bestaan niet in deze WP-installatie: direct een echte 404.
if (slugSegments.value.length !== 1) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

const { data: page, error } = await useFetch(`/api/page/${slug.value}`, {
  key: `page-${slug.value}`,
})

// Een 404 uit WordPress moet een echte Nuxt-404 worden, geen lege pagina.
if (error.value || !page.value) {
  throw createError({
    statusCode: error.value?.statusCode === 404 || !page.value ? 404 : 502,
    statusMessage: 'Pagina niet gevonden',
    fatal: true,
  })
}

// De pagina `uitvoeringen` heeft in WordPress een lege titel; val dan terug op
// de slug zodat <h1> en <title> niet leeg blijven.
const titel = computed(() => {
  if (page.value?.title) return page.value.title
  const s = slug.value.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
})

useWpSeo({
  title: titel.value,
  description: page.value.description,
  path: `/${slug.value}`,
  image: page.value.featuredImage,
})
</script>

<template>
  <div class="container">
    <div class="page-header">
      <h1>{{ titel }}</h1>
    </div>

    <figure v-if="page?.featuredImage" class="page-hero">
      <img
        :src="page.featuredImage.src"
        :srcset="page.featuredImage.srcset || undefined"
        sizes="(max-width: 72rem) 100vw, 72rem"
        :alt="page.featuredImage.alt"
        :width="page.featuredImage.width"
        :height="page.featuredImage.height"
        decoding="async"
      >
    </figure>

    <WpContent v-if="page && !page.isEmpty" :html="page.html" />

    <!--
      Verwachte situatie, geen bug: een aantal pagina's bevat in WordPress
      alleen een shortcode van een ticketing-/sliderplugin. Die shortcodes
      worden door de REST API niet uitgevoerd, dus er is geen content.
    -->
    <div v-else class="content-notice">
      <p>Deze pagina heeft in het CMS geen tekstuele inhoud. De oorspronkelijke pagina bestaat uit een plugin-onderdeel dat niet via de REST API beschikbaar is.</p>
    </div>
  </div>
</template>
