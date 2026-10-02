<script setup lang="ts">
/**
 * Paginakop van de subpagina's: night-vlak met draaiende zonnestralen, een
 * oranje boog-omtrek, eyebrow, h1 en intro. Alles behalve de tekst is
 * decoratief en aria-hidden.
 *
 * De default-slot komt onder de intro (bijv. knoppen).
 */
defineProps<{
  title: string
  eyebrow?: string
  intro?: string
}>()
</script>

<template>
  <section class="page-hero-deco">
    <div class="page-hero-deco__sun sun" aria-hidden="true">
      <div class="sunburst" />
    </div>
    <div class="page-hero-deco__arch" aria-hidden="true" />
    <div class="page-hero-deco__content">
      <EyebrowLabel v-if="eyebrow" tone="dark">{{ eyebrow }}</EyebrowLabel>
      <h1>{{ title }}</h1>
      <p v-if="intro" class="page-hero-deco__intro">{{ intro }}</p>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.page-hero-deco {
  --sun-range: 700px;
  position: relative;
  overflow: hidden;
  padding: clamp(72px, 10vw, 110px) var(--gutter) clamp(72px, 9vw, 96px);
  background: var(--bam-night);
  color: var(--bam-white);
}

.page-hero-deco__sun {
  position: absolute;
  left: -20%;
  right: -20%;
  bottom: -40%;
  height: 180%;
  pointer-events: none;
}

.page-hero-deco__sun > div {
  width: 100%;
  height: 100%;
}

.page-hero-deco__arch {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: min(640px, 86%);
  height: min(360px, 80%);
  transform: translateX(-50%);
  border: 2px solid var(--bam-orange);
  border-bottom: none;
  border-radius: 320px 320px 0 0;
  pointer-events: none;
}

.page-hero-deco__content {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: clamp(44px, 7vw, 96px);
  line-height: 1;
  letter-spacing: 4px;
  overflow-wrap: anywhere;
}

.page-hero-deco__intro {
  margin: 0;
  font-size: 19px;
  line-height: 1.6;
  color: var(--bam-body-on-night);
}
</style>
