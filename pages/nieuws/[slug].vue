<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data: post, error } = await useFetch(`/api/post/${slug.value}`, {
  key: `post-${slug.value}`,
})

if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Bericht niet gevonden', fatal: true })
}

const { formatDate } = useDutchDate()

useWpSeo({
  title: post.value.title,
  description: post.value.description,
  path: `/nieuws/${slug.value}`,
  image: post.value.featuredImage,
  type: 'article',
  publishedAt: post.value.date,
})
</script>

<template>
  <article v-if="post" class="container">
    <div class="page-header">
      <h1>{{ post.title }}</h1>
      <p class="page-header__meta">
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
      </p>
    </div>

    <figure v-if="post.featuredImage" class="page-hero">
      <img
        :src="post.featuredImage.src"
        :srcset="post.featuredImage.srcset || undefined"
        sizes="(max-width: 72rem) 100vw, 72rem"
        :alt="post.featuredImage.alt"
        :width="post.featuredImage.width"
        :height="post.featuredImage.height"
        decoding="async"
      >
    </figure>

    <WpContent v-if="!post.isEmpty" :html="post.html" />
    <div v-else class="content-notice">
      <p>Dit bericht heeft geen tekstuele inhoud.</p>
    </div>

    <p style="margin-top: var(--ruimte-l)">
      <NuxtLink class="button" to="/nieuws">Terug naar nieuws</NuxtLink>
    </p>
  </article>
</template>
