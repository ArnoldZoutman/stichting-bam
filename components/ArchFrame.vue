<script setup lang="ts">
import type { ResolvedImage } from '~~/server/utils/wp-types'

/**
 * Boog-kader voor affiches en foto's: `border-radius: 300px 300px 0 0`, 2px
 * oranje rand, 14px binnenruimte. Met `fan` waaiert de boog open bij in beeld
 * komen (zie motion.css).
 *
 * Zonder afbeelding toont het kader een decoratief zonnestralenvlak (aria-
 * hidden) in plaats van een verzonnen beeld.
 */
withDefaults(
  defineProps<{
    image?: ResolvedImage | null
    ratio?: string
    sizes?: string
    fan?: boolean
    eager?: boolean
  }>(),
  { image: null, ratio: '4 / 5', sizes: '(max-width: 760px) 100vw, 460px', fan: true, eager: false },
)
</script>

<template>
  <div class="arch" :class="{ fan }" :style="{ aspectRatio: ratio }">
    <div class="arch__inner">
      <img
        v-if="image"
        :src="image.src"
        :srcset="image.srcset || undefined"
        :sizes="sizes"
        :alt="image.alt"
        :width="image.width"
        :height="image.height"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : undefined"
        decoding="async"
      >
      <div v-else class="arch__placeholder sunburst" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.arch {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: 14px;
  border: 2px solid var(--bam-orange);
  border-radius: var(--arch-radius);
  background: var(--bam-white);
}

.arch__inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 286px 286px 0 0;
  background: var(--bam-night);
}

.arch__inner img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.arch__placeholder {
  width: 100%;
  height: 100%;
}
</style>
