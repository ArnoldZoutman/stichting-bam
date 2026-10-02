<script setup lang="ts">
import type { PostSummary } from '~~/server/utils/wp-types'

/**
 * Kaart voor een nieuwsbericht; de hele kaart is één link.
 * Meta = "[categorie] · [datum]"; de eerste categorie van het bericht (de
 * standaardcategorie "Geen categorie" filtert de serverlaag al weg).
 * Zonder uitgelichte afbeelding: decoratief zonnestralenvlak.
 *
 * `featured`: de brede "Uitgelicht"-kaart bovenaan /nieuws.
 */
const props = withDefaults(
  defineProps<{
    post: PostSummary
    showExcerpt?: boolean
    featured?: boolean
    headingLevel?: 2 | 3 | 4
    /** Eerste kaart boven de vouw: niet lazy laden (LCP). */
    eager?: boolean
  }>(),
  { showExcerpt: true, featured: false, headingLevel: 3, eager: false },
)

const { formatDate } = useDutchDate()
const category = computed(() => props.post.categories?.[0]?.name)
</script>

<template>
  <NuxtLink :to="`/nieuws/${post.slug}`" class="news-card" :class="{ 'news-card--featured': featured }">
    <div class="news-card__media">
      <span v-if="featured" class="news-card__badge">Uitgelicht</span>
      <img
        v-if="post.featuredImage"
        class="news-card__img"
        :src="post.featuredImage.src"
        :srcset="post.featuredImage.srcset || undefined"
        :sizes="featured ? '(max-width: 900px) calc(100vw - 48px), 640px' : '(max-width: 760px) calc(100vw - 80px), (max-width: 1100px) calc(50vw - 60px), 350px'"
        :alt="post.featuredImage.alt"
        :width="post.featuredImage.width"
        :height="post.featuredImage.height"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : undefined"
        decoding="async"
      >
      <div v-else class="news-card__img sunburst" aria-hidden="true" />
    </div>
    <div class="news-card__body">
      <p class="news-card__meta">
        <template v-if="category">{{ category }} · </template>
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
      </p>
      <component :is="`h${headingLevel}`" class="news-card__title">{{ post.title }}</component>
      <p v-if="showExcerpt && post.description" class="news-card__excerpt">{{ post.description }}</p>
      <span v-if="featured" class="news-card__more" aria-hidden="true">Lees verder →</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.news-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  padding: 14px 14px 26px;
  background: var(--bam-white);
  border: var(--card-border);
  color: var(--bam-ink);
  text-decoration: none;
  transition: transform 0.5s ease, box-shadow 0.5s ease;
}

.news-card:hover {
  color: var(--bam-ink);
  transform: translateY(-4px);
  box-shadow: var(--card-shadow-hover);
}

.news-card:focus-visible {
  box-shadow: var(--focus-halo), var(--card-shadow-hover);
}

.news-card__media {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bam-night);
}

.news-card__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Uitgelicht: foto en tekst naast elkaar, klapt onder ~900px om ── */
.news-card--featured {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0;
  padding: 0;
  background: var(--bam-sky);
}

.news-card--featured .news-card__media {
  flex: 1 1 480px;
  min-height: 360px;
  aspect-ratio: auto;
  background: var(--bam-blue);
}

.news-card--featured .news-card__body {
  flex: 1 1 420px;
  justify-content: center;
  gap: 18px;
  padding: clamp(28px, 4vw, 48px) clamp(24px, 4vw, 44px);
}

.news-card--featured .news-card__meta,
.news-card--featured .news-card__title,
.news-card--featured .news-card__excerpt {
  padding: 0;
}

.news-card--featured .news-card__title {
  font-size: clamp(32px, 3.6vw, 48px);
  line-height: 1.1;
}

.news-card--featured .news-card__excerpt {
  font-size: 18px;
  line-height: 1.7;
}

.news-card__badge {
  position: absolute;
  z-index: 1;
  left: 0;
  top: 0;
  padding: 10px 18px;
  background: var(--bam-orange);
  color: var(--bam-ink);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.news-card__more {
  align-self: flex-start;
  padding-bottom: 4px;
  border-bottom: 3px solid var(--bam-orange);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.news-card__img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.news-card:hover .news-card__img {
  transform: scale(1.04);
}

.news-card__meta {
  margin: 0;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--bam-label);
}

.news-card__title {
  margin: 0;
  padding: 0 8px;
  font-family: var(--font-display);
  font-size: 27px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 1px;
}

.news-card__excerpt {
  margin: 0;
  padding: 0 8px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--bam-body);
}

@media (prefers-reduced-motion: reduce) {
  .news-card,
  .news-card__img {
    transition: none;
  }

  .news-card:hover,
  .news-card:hover .news-card__img {
    transform: none;
  }
}
</style>
