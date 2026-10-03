<script setup lang="ts">
import type { EventGalleryItem } from '~~/server/utils/wp-types'

/**
 * Fotogalerij op de voorstellingspagina: "Beeld", kop "Doek op", subtitel
 * "Een kijkje op het podium".
 *
 * De foto's komen uit de EERSTE galerij in de content van het evenement
 * (WordPress); die is daar uit de lopende tekst gehaald.
 *
 * LAY-OUT naar aantal:
 *  - 1 foto: één brede foto (16:9, max. 900px, gecentreerd);
 *  - 2 foto's: naast elkaar (mobiel onder elkaar);
 *  - 3+: mozaïek met een blikvanger van 2×2; staande foto's 2 rijen hoog.
 *    utils/mosaic.ts (planGallery) plant voor 4 (desktop; bij precies 3
 *    foto's 3), 3 (tablet) en 2 kolommen (mobiel) zó dat er geen gaten vallen:
 *    eerst door tegels te vergroten, als laatste redmiddel door één staande
 *    foto een paar plekken naar voren te schuiven (één volgorde voor alle
 *    breedtes). Gemeten: bij >= 7 foto's met <= 40% staande altijd sluitend;
 *    bij kleinere galerijen of meer staande foto's kan op één breedte een gat
 *    overblijven (zie tests/mosaic.test.mjs).
 *  - meer dan 12: de eerste 12, plus "Toon alle N foto's".
 * Is de eerste foto staand, dan wordt de eerste liggende de blikvanger en
 * schuift die naar voren (zichtbare volgorde = DOM-volgorde = lightbox).
 *
 * TEGELS zijn `<a href>` naar het grootste bestand: zonder JS opent de foto
 * gewoon, met JS opent de lightbox (GalleryLightbox.vue). Na het sluiten
 * krijgt de tegel de focus terug.
 */
const props = withDefaults(
  defineProps<{
    items: EventGalleryItem[]
    /** Naam van de voorstelling. */
    title: string
    /**
     * Staat de galerij direct na de hero: blikvanger niet lazy laden. Bewust
     * GEEN fetchpriority="high": dan concurreert hij met het affiche in de
     * hero, dat de LCP is (gemeten: mobiele LCP 3,2 → 4,0 s).
     */
    eager?: boolean
  }>(),
  { eager: false },
)

const LIMIT = 12

/** Blikvanger = eerste liggende foto; staat er een staande voor, dan naar voren. */
const ordered = computed(() => {
  const list = [...props.items]
  if (list[0]?.orientation === 'portrait') {
    const firstLandscape = list.findIndex((item) => item.orientation === 'landscape')
    if (firstLandscape > 0) list.unshift(...list.splice(firstLandscape, 1))
  }
  return list
})

const total = computed(() => ordered.value.length)
const showAll = ref(false)
const layout = computed(() => (total.value === 1 ? 'single' : total.value === 2 ? 'pair' : 'mosaic'))

/**
 * Plan voor de zichtbare set (de eerste 12, of alles na "Toon alle"). De
 * volgorde uit het plan is ook de volgorde van de tegels en de lightbox.
 */
const plan = computed(() => {
  const subset = showAll.value ? ordered.value : ordered.value.slice(0, LIMIT)
  if (layout.value !== 'mosaic') return { items: subset, lg: null, md: null, sm: null }
  const g = planGallery(subset.map((item) => item.orientation), [total.value === 3 ? 3 : 4, 3, 2])
  return { items: g.order.map((i) => subset[i]!), lg: g.plans[0]!, md: g.plans[1]!, sm: g.plans[2]! }
})
const visible = computed(() => plan.value.items)
/** Volgorde voor de lightbox: de zichtbare tegels, daarna de nog verborgen foto's. */
const lightboxItems = computed(() => [...visible.value, ...ordered.value.filter((item) => !visible.value.includes(item))])
const countLabel = computed(() => `${total.value} ${total.value === 1 ? 'foto' : "foto's"}`)

/** Spans per breakpoint gaan als CSS-variabelen naar elke tegel. */
function tileStyle(i: number) {
  const { lg, md, sm } = plan.value
  if (!lg || !md || !sm) return undefined
  return {
    '--c-lg': lg.spans[i]?.c ?? 1,
    '--r-lg': lg.spans[i]?.r ?? 1,
    '--c-md': md.spans[i]?.c ?? 1,
    '--r-md': md.spans[i]?.r ?? 1,
    '--c-sm': sm.spans[i]?.c ?? 1,
    '--r-sm': sm.spans[i]?.r ?? 1,
    // Kleine verschuiving van het reveal-bereik per kolom (stagger).
    '--stagger': i % 4,
  }
}

function isBig(i: number) {
  return layout.value === 'single' || (plan.value.lg?.spans[i]?.c ?? 1) >= 2
}

function sizesFor(i: number) {
  if (layout.value === 'single') return '(max-width: 948px) calc(100vw - 48px), 900px'
  if (layout.value === 'pair') return '(max-width: 760px) 100vw, 600px'
  return isBig(i) ? '(max-width: 760px) 100vw, 600px' : '(max-width: 760px) 50vw, 300px'
}

function label(item: EventGalleryItem, i: number) {
  const base = `Foto ${i + 1} van ${total.value}`
  if (item.alt) return `${base} vergroten: ${item.alt}`
  return `${base} uit ${props.title} vergroten${item.caption ? `: ${item.caption}` : ''}`
}

// ── Lightbox ──────────────────────────────────────────────────────────────
const open = ref<number | null>(null)
const tiles = ref<HTMLAnchorElement[]>([])

function onClosed(lastIndex: number) {
  // Bladeren in de lightbox kan voorbij de 12 zichtbare gaan: toon dan alles,
  // zodat de bijbehorende tegel bestaat en de focus kan krijgen.
  if (lastIndex >= LIMIT) showAll.value = true
  nextTick(() => tiles.value[lastIndex]?.focus())
}

async function revealAll() {
  showAll.value = true
  await nextTick()
  tiles.value[LIMIT]?.focus()
}
</script>

<template>
  <section class="gallery-section" aria-labelledby="fotogalerij-titel">
    <div class="gallery-section__inner">
      <div class="gallery-section__head">
        <div class="gallery-section__titles">
          <EyebrowLabel rule>Beeld</EyebrowLabel>
          <h2 id="fotogalerij-titel">Doek op</h2>
          <p class="gallery-section__subtitle">Een kijkje op het podium</p>
        </div>
        <p class="gallery-section__count">{{ countLabel }}</p>
      </div>

      <div class="grid-wrap">
        <ul class="tiles" :class="[`tiles--${layout}`, { 'tiles--three': total === 3 }]">
          <li
            v-for="(item, i) in visible"
            :key="`${item.id ?? item.src}-${i}`"
            class="tile reveal"
            :class="{ 'tile--new': i >= LIMIT, 'tile--portrait': item.orientation === 'portrait' }"
            :style="tileStyle(i)"
          >
            <a
              ref="tiles"
              class="tile__link"
              :href="largestFromSrcset(item.srcset, item.src)"
              :aria-label="label(item, i)"
              aria-haspopup="dialog"
              @click.prevent="open = i"
            >
              <span class="tile__media" :class="{ 'lift-tile': i === 0 && layout === 'mosaic' }">
                <img
                  :src="item.src"
                  :srcset="item.srcset || undefined"
                  :sizes="sizesFor(i)"
                  alt=""
                  :width="item.width"
                  :height="item.height"
                  :loading="eager && i === 0 ? 'eager' : 'lazy'"
                  decoding="async"
                >
              </span>
              <span v-if="item.caption" class="tile__caption" aria-hidden="true">{{ item.caption }}</span>
            </a>
          </li>
        </ul>
      </div>

      <div v-if="total > LIMIT && !showAll" class="gallery-section__more">
        <BamButton variant="secondary" @click="revealAll">Toon alle {{ total }} foto's</BamButton>
      </div>
    </div>

    <GalleryLightbox v-model:index="open" :items="lightboxItems" :title="title" @closed="onClosed" />
  </section>
</template>

<style scoped>
.gallery-section {
  padding: var(--section-y) var(--gutter);
  background: var(--bam-sky);
}

.gallery-section__inner {
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.gallery-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
}

.gallery-section__titles {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.gallery-section__head h2 {
  margin: 0;
  font-size: clamp(36px, 4.5vw, 56px);
  line-height: 1.1;
}

/* Subtitel in Limelight (het accentfont, zoals de subtitel in de hero);
   label-blauw op sky = 6.4:1. */
.gallery-section__subtitle {
  margin: -4px 0 0;
  font-family: var(--font-accent);
  font-size: clamp(18px, 2vw, 22px);
  letter-spacing: 1px;
  color: var(--bam-label);
}

.gallery-section__count {
  margin: 0;
  font-family: var(--font-accent);
  font-size: 22px;
  color: var(--bam-night);
}

/* ── Raster ────────────────────────────────────────────────────────────── */
.grid-wrap {
  container-type: inline-size;
}

.tiles {
  --cols: 4;
  --gap: 16px;
  display: grid;
  grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  /* Rijhoogte = kolombreedte × 2/3: een liggende tegel is 3:2, een staande
     (1×2) ongeveer 2:3, de blikvanger (2×2) 3:2. */
  grid-auto-rows: calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols) * 2 / 3);
  grid-auto-flow: dense;
  gap: var(--gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tiles--three {
  --cols: 3;
}

.tile {
  grid-column: span var(--c-lg, 1);
  grid-row: span var(--r-lg, 1);
  min-width: 0;
}

@media (max-width: 1023px) {
  .tiles {
    --cols: 3;
  }

  .tile {
    grid-column: span var(--c-md, 1);
    grid-row: span var(--r-md, 1);
  }
}

@media (max-width: 760px) {
  .tiles {
    --cols: 2;
    --gap: 10px;
  }

  .tile {
    grid-column: span var(--c-sm, 1);
    grid-row: span var(--r-sm, 1);
  }
}

/* 1 foto: breed 16:9-kader. 2 foto's: twee 3:2-tegels naast elkaar. */
.tiles--single,
.tiles--pair {
  grid-auto-rows: auto;
}

.tiles--single {
  grid-template-columns: minmax(0, 900px);
  justify-content: center;
}

.tiles--single .tile,
.tiles--pair .tile {
  grid-column: auto;
  grid-row: auto;
}

.tiles--single .tile__link {
  aspect-ratio: 16 / 9;
}

.tiles--pair {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tiles--pair .tile__link {
  aspect-ratio: 3 / 2;
}

@media (max-width: 760px) {
  .tiles--pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ── Tegel ─────────────────────────────────────────────────────────────── */
.tile__link {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 2px solid var(--bam-night);
  background: var(--bam-night);
  transition: border-color 0.3s ease;
}

.tile__media {
  position: absolute;
  inset: 0;
  display: block;
}

/* Ruimte voor de parallax van de blikvanger (±6%). */
.tile__media.lift-tile {
  inset: -7% 0;
}

.tile__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.tile__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 14px;
  background: rgba(10, 42, 107, 0.9);
  color: var(--bam-white);
  font-size: 15px;
  line-height: 1.4;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}

.tile__link:hover,
.tile__link:focus-visible {
  border-color: var(--bam-orange);
}

.tile__link:hover img,
.tile__link:focus-visible img {
  transform: scale(1.03);
}

.tile__link:hover .tile__caption,
.tile__link:focus-visible .tile__caption {
  transform: none;
}

/* Touch: geen hover, dus geen caption in het raster (wel in de lightbox). */
@media (hover: none) {
  .tile__caption {
    display: none;
  }
}

/* Reveal met een kleine verschuiving per kolom (scroll-driven: een
   verschoven bereik, geen tijdvertraging). */
@supports (animation-timeline: view()) {
  .tile.reveal {
    animation-range: entry calc(var(--stagger, 0) * 6%) entry calc(100% + var(--stagger, 0) * 6%);
  }
}

/* "Toon alle": nieuw zichtbare tegels faden in. */
.tile--new {
  animation: tile-in 0.4s ease both;
}

@keyframes tile-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.gallery-section__more {
  display: flex;
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .tile__link,
  .tile__media img,
  .tile__caption {
    transition: none;
  }

  .tile__link:hover img,
  .tile__link:focus-visible img {
    transform: none;
  }

  .tile--new {
    animation: none;
  }
}
</style>
