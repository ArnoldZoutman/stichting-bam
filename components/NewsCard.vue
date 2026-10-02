<script setup lang="ts">
import type { PostSummary } from '~~/server/utils/wp-types'

/**
 * Kaart voor een nieuwsbericht; de hele kaart is één link.
 * Meta = "[categorie] · [datum]"; de categorie alleen als de aanroeper er een
 * meegeeft (de standaardcategorie "Geen categorie" hoort weggelaten te worden).
 * Zonder uitgelichte afbeelding: decoratief zonnestralenvlak.
 */
const props = withDefaults(
  defineProps<{
    post: PostSummary
    category?: string
    showExcerpt?: boolean
    headingLevel?: 2 | 3 | 4
  }>(),
  { category: undefined, showExcerpt: true, headingLevel: 3 },
)

const { formatDate } = useDutchDate()
</script>

<template>
  <NuxtLink :to="`/nieuws/${post.slug}`" class="news-card">
    <div class="news-card__media">
      <img
        v-if="post.featuredImage"
        class="news-card__img"
        :src="post.featuredImage.src"
        :srcset="post.featuredImage.srcset || undefined"
        sizes="(max-width: 760px) 100vw, 380px"
        :alt="post.featuredImage.alt"
        :width="post.featuredImage.width"
        :height="post.featuredImage.height"
        loading="lazy"
        decoding="async"
      >
      <div v-else class="news-card__img sunburst" aria-hidden="true" />
    </div>
    <p class="news-card__meta">
      <template v-if="props.category">{{ props.category }} · </template>
      <time :datetime="post.date">{{ formatDate(post.date) }}</time>
    </p>
    <component :is="`h${headingLevel}`" class="news-card__title">{{ post.title }}</component>
    <p v-if="showExcerpt && post.description" class="news-card__excerpt">{{ post.description }}</p>
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
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--bam-night);
}

.news-card__img {
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
