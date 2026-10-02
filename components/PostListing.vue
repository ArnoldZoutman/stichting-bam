<script setup lang="ts">
/**
 * Berichtenoverzicht met paginering, gedeeld door `/nieuws` en
 * `/nieuws/pagina/<n>`, volgens design-reference/pages/Nieuws.dc.html.
 *
 * Paginering loopt via het PAD en niet via een querystring: geprerenderde
 * routes worden als statisch bestand geserveerd op basis van het pad alleen,
 * waardoor `?pagina=2` de HTML van pagina 1 zou terugkrijgen. De knop
 * "Ouder nieuws" uit het prototype is daarom een link naar de volgende
 * pagina, geen "laad meer"-knop.
 *
 * Het aantal pagina's komt uit de `X-WP-TotalPages`-header van de API
 * (zie server/utils/wp-client.ts), niet uit een geraden aantal.
 *
 * Categoriefilter: client-side, over de berichten op DEZE pagina, en alleen
 * zichtbaar als die minstens twee echte categorieën hebben (de
 * standaardcategorie telt niet mee). Alle kaarten staan in de geprerenderde
 * HTML; het filter verbergt ze alleen.
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

const { features } = useAppConfig()

/** Pagina 1 woont op /nieuws, de rest op /nieuws/pagina/<n>. */
function pathFor(page: number): string {
  return page <= 1 ? '/nieuws' : `/nieuws/pagina/${page}`
}

const items = computed(() => posts.value?.items ?? [])

const categories = computed(() => {
  const seen = new Map<string, string>()
  for (const post of items.value) for (const c of post.categories) seen.set(c.slug, c.name)
  return [...seen].map(([slug, name]) => ({ slug, name }))
})
const showFilter = computed(() => categories.value.length >= 2)
const activeCategory = ref<string | null>(null)

function visible(post: { categories: { slug: string }[] }) {
  return !activeCategory.value || post.categories.some((c) => c.slug === activeCategory.value)
}

/** Alleen op pagina 1 is het nieuwste bericht "uitgelicht". */
const featured = computed(() => (props.page === 1 && items.value.length ? items.value[0] : null))
const rest = computed(() => (featured.value ? items.value.slice(1) : items.value))
const visibleCount = computed(() => items.value.filter(visible).length)

const titel = computed(() => (props.page > 1 ? `Nieuws — pagina ${props.page}` : 'Nieuws'))

useWpSeo({
  title: titel.value,
  description: 'Nieuws en berichten van Stichting BAM.',
  path: pathFor(props.page),
})
</script>

<template>
  <div>
    <PageHero
      :eyebrow="page > 1 ? `Uit de coulissen · pagina ${page}` : 'Uit de coulissen'"
      title="Nieuws"
      intro="Repetities, audities, nieuwe producties en alles wat er bij BAM speelt."
    />

    <section class="news">
      <div class="news__inner">
        <div v-if="showFilter" role="group" aria-label="Filter op categorie" class="chips">
          <button
            type="button"
            class="chip"
            :aria-pressed="activeCategory === null ? 'true' : 'false'"
            @click="activeCategory = null"
          >
            Alles
          </button>
          <button
            v-for="cat in categories"
            :key="cat.slug"
            type="button"
            class="chip"
            :aria-pressed="activeCategory === cat.slug ? 'true' : 'false'"
            @click="activeCategory = cat.slug"
          >
            {{ cat.name }}
          </button>
        </div>
        <p v-if="showFilter" class="visually-hidden" role="status">
          {{ visibleCount }} {{ visibleCount === 1 ? 'bericht' : 'berichten' }} zichtbaar
        </p>

        <div v-if="featured" v-show="visible(featured)" class="reveal">
          <NewsCard :post="featured" featured :heading-level="2" eager />
        </div>

        <ul v-if="rest.length" class="card-grid">
          <li v-for="post in rest" v-show="visible(post)" :key="post.id" class="reveal">
            <NewsCard :post="post" :heading-level="2" />
          </li>
        </ul>

        <p v-if="!items.length" class="empty">Er zijn op dit moment geen berichten.</p>

        <nav v-if="posts && posts.totalPages > 1" class="pager" aria-label="Paginering">
          <BamButton v-if="page > 1" :to="pathFor(page - 1)" variant="secondary" rel="prev">Nieuwer nieuws</BamButton>
          <span class="pager__status">Pagina {{ page }} van {{ posts.totalPages }}</span>
          <BamButton v-if="page < posts.totalPages" :to="pathFor(page + 1)" variant="secondary" rel="next">Ouder nieuws</BamButton>
        </nav>
      </div>
    </section>

    <NewsletterSignup v-if="features.newsletter" />
  </div>
</template>

<style scoped>
.news {
  padding: 72px var(--gutter) var(--section-y);
}

.news__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.chip {
  min-height: 46px;
  padding: 12px 24px;
  border: 1.5px solid var(--bam-night);
  border-radius: 999px;
  background: var(--bam-white);
  color: var(--bam-night);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease;
}

.chip[aria-pressed='true'] {
  background: var(--bam-night);
  color: var(--bam-white);
}

.news .card-grid {
  margin: 0;
}

.empty {
  margin: 0;
  text-align: center;
  font-size: 18px;
  color: var(--bam-body);
}

.pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px 32px;
}

.pager__status {
  font-size: 15px;
  color: var(--bam-body);
}
</style>
