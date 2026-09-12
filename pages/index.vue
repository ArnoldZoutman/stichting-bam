<script setup lang="ts">
/**
 * Startpagina.
 *
 * LET OP: de WP-pagina `home` bevat als enige inhoud `[rev_slider_vc
 * alias="tegen-tijd"]`. Revolution Slider publiceert zijn slides NIET via de
 * REST API, dus die content is via deze route niet te krijgen. Er is dus geen
 * redactionele tekst om te tonen.
 *
 * We verzinnen hier geen vervangende tekst. In plaats daarvan bouwen we de
 * startpagina uit wél beschikbare API-data: de sitenaam en -omschrijving uit
 * /wp-json/ en de meest recente berichten. Als de `home`-pagina in WordPress
 * ooit echte content krijgt, wordt die hier automatisch alsnog getoond.
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

/**
 * De sitebeschrijving in WordPress is leeg en `home` heeft geen tekst, dus er
 * is geen eigen omschrijving voor deze pagina. In plaats van er een te
 * verzinnen gebruiken we de intro van "Over ons" — echte CMS-tekst. Is ook die
 * er niet, dan krijgt de startpagina géén meta description.
 */
const { data: overOns } = await useFetch('/api/page/over-ons', {
  key: 'page-over-ons-intro',
  default: () => null,
})

const titel = computed(() => site.value?.name || 'Stichting BAM')
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
  <div class="container">
    <div class="page-header">
      <h1>{{ titel }}</h1>
      <p v-if="site?.description" class="page-header__meta">{{ site.description }}</p>
    </div>

    <WpContent v-if="home && !home.isEmpty" :html="home.html" />

    <section v-if="posts.items.length">
      <h2>Laatste nieuws</h2>
      <ul class="post-list">
        <PostCard v-for="post in posts.items" :key="post.id" :post="post" />
      </ul>
      <p style="margin-top: var(--ruimte-m)">
        <NuxtLink class="button" to="/nieuws">Alle berichten</NuxtLink>
      </p>
    </section>
  </div>
</template>
