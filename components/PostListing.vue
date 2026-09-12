<script setup lang="ts">
/**
 * Berichtenoverzicht met paginering, gedeeld door `/nieuws` en
 * `/nieuws/pagina/<n>`.
 *
 * Paginering loopt via het PAD en niet via een querystring: geprerenderde
 * routes worden als statisch bestand geserveerd op basis van het pad alleen,
 * waardoor `?pagina=2` de HTML van pagina 1 zou terugkrijgen.
 *
 * Het aantal pagina's komt uit de `X-WP-TotalPages`-header van de API
 * (zie server/utils/wp-client.ts), niet uit een geraden aantal.
 */
const props = defineProps<{ page: number }>()

const PER_PAGE = 6

const { data: posts, error } = await useFetch('/api/posts', {
  key: `nieuws-pagina-${props.page}`,
  query: { page: props.page, per_page: PER_PAGE },
})

if (error.value) {
  // Voorbij de laatste pagina is een 404; al het andere een serverfout.
  const status = error.value.statusCode === 404 ? 404 : 502
  throw createError({
    statusCode: status,
    statusMessage: status === 404 ? 'Pagina niet gevonden' : 'Berichten konden niet worden geladen',
    fatal: true,
  })
}

if (posts.value && posts.value.totalPages > 0 && props.page > posts.value.totalPages) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}

/** Pagina 1 woont op /nieuws, de rest op /nieuws/pagina/<n>. */
function pathFor(page: number): string {
  return page <= 1 ? '/nieuws' : `/nieuws/pagina/${page}`
}

const titel = computed(() => (props.page > 1 ? `Nieuws — pagina ${props.page}` : 'Nieuws'))

useWpSeo({
  title: titel.value,
  description: 'Nieuws en berichten van Stichting BAM.',
  path: pathFor(props.page),
})
</script>

<template>
  <div class="container">
    <div class="page-header">
      <h1>Nieuws</h1>
      <p v-if="posts" class="page-header__meta">
        {{ posts.total }} {{ posts.total === 1 ? 'bericht' : 'berichten' }}
        <template v-if="posts.totalPages > 1"> — pagina {{ page }} van {{ posts.totalPages }}</template>
      </p>
    </div>

    <ul v-if="posts?.items.length" class="post-list">
      <PostCard v-for="post in posts.items" :key="post.id" :post="post" />
    </ul>
    <div v-else class="content-notice">
      <p>Er zijn op dit moment geen berichten.</p>
    </div>

    <nav v-if="posts && posts.totalPages > 1" class="pagination" aria-label="Paginering">
      <NuxtLink v-if="page > 1" :to="pathFor(page - 1)" rel="prev">Vorige</NuxtLink>
      <span class="pagination__status">Pagina {{ page }} van {{ posts.totalPages }}</span>
      <NuxtLink v-if="page < posts.totalPages" :to="pathFor(page + 1)" rel="next">Volgende</NuxtLink>
    </nav>
  </div>
</template>
