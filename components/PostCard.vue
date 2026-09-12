<script setup lang="ts">
import type { PostSummary } from '~~/server/utils/wp-types'

defineProps<{ post: PostSummary }>()

const { formatDate } = useDutchDate()
</script>

<template>
  <li class="post-card">
    <NuxtLink v-if="post.featuredImage" :to="`/nieuws/${post.slug}`" class="post-card__image">
      <img
        :src="post.featuredImage.src"
        :srcset="post.featuredImage.srcset || undefined"
        sizes="(max-width: 48rem) 100vw, 20rem"
        :alt="post.featuredImage.alt"
        :width="post.featuredImage.width"
        :height="post.featuredImage.height"
        loading="lazy"
        decoding="async"
      >
    </NuxtLink>
    <div class="post-card__body">
      <p class="post-card__date">
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
      </p>
      <h2><NuxtLink :to="`/nieuws/${post.slug}`">{{ post.title }}</NuxtLink></h2>
      <p v-if="post.description" class="post-card__excerpt">{{ post.description }}</p>
    </div>
  </li>
</template>
