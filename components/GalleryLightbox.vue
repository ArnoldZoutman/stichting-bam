<script setup lang="ts">
import type { EventGalleryItem } from '~~/server/utils/wp-types'

/**
 * Herbruikbare lightbox voor een fotogalerij: een native `<dialog>` met
 * `showModal()`. Dat geeft gratis een focus-trap, Esc-om-te-sluiten en een
 * inert maken van de rest van de pagina.
 *
 * Bediening: vorige/volgende/sluiten-knoppen, pijltjestoetsen, Esc, swipen
 * (pointer events, drempel 50px) en een klik op de achtergrond. De buurfoto's
 * worden vooraf geladen. Niet rondlopen: bij de eerste/laatste foto is de
 * knop disabled.
 *
 * De ouder bepaalt welke foto open is (`v-model:index`, `null` = dicht) en
 * zet na het sluiten de focus terug op de tegel waarmee geopend werd.
 */
const props = defineProps<{
  items: EventGalleryItem[]
  /** Naam van de voorstelling, voor de toegankelijke namen. */
  title: string
}>()

const index = defineModel<number | null>('index', { default: null })
const emit = defineEmits<{ closed: [lastIndex: number] }>()

const uid = useId()
const titleId = `lightbox-titel-${uid}`
const dialog = ref<HTMLDialogElement | null>(null)
const prevButton = ref<HTMLButtonElement | null>(null)
const nextButton = ref<HTMLButtonElement | null>(null)
const announcement = ref('')
let lastIndex = 0

const count = computed(() => props.items.length)
const current = computed(() => (index.value === null ? null : props.items[index.value] ?? null))
const pad = (n: number) => String(n).padStart(2, '0')
const counter = computed(() => (index.value === null ? '' : `${pad(index.value + 1)} / ${pad(count.value)}`))
const largest = computed(() => (current.value ? largestFromSrcset(current.value.srcset, current.value.src) : ''))
const imageName = computed(() => {
  if (!current.value || index.value === null) return ''
  return current.value.alt || `${props.title}, foto ${index.value + 1} van ${count.value}`
})

function go(i: number) {
  if (i < 0 || i >= count.value) return
  index.value = i
  announcement.value = `Foto ${i + 1} van ${count.value}`
  nextTick(() => {
    const focused = document.activeElement
    if (focused === prevButton.value && i === 0) nextButton.value?.focus()
    if (focused === nextButton.value && i === count.value - 1) prevButton.value?.focus()
  })
}

function close() {
  dialog.value?.close()
}

function onClose() {
  // Ook bij Esc (native 'cancel' → 'close'). Pagina weer scrollbaar maken en
  // de ouder laten weten welke tegel de focus terug moet krijgen.
  document.documentElement.style.removeProperty('overflow')
  if (index.value !== null) lastIndex = index.value
  index.value = null
  emit('closed', lastIndex)
}

function onKeydown(event: KeyboardEvent) {
  if (index.value === null) return
  if (event.key === 'ArrowLeft') { event.preventDefault(); go(index.value - 1) }
  if (event.key === 'ArrowRight') { event.preventDefault(); go(index.value + 1) }
}

/** Klik op de achtergrond (de dialog zelf of het lege podium) sluit. */
function onBackdropClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === dialog.value || target.classList.contains('lb__stage')) close()
}

// Swipen: alleen horizontaal, drempel ~50px.
let startX: number | null = null
let startY = 0
function onPointerDown(event: PointerEvent) {
  startX = event.clientX
  startY = event.clientY
}
function onPointerUp(event: PointerEvent) {
  if (startX === null || index.value === null) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  startX = null
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
  go(dx < 0 ? index.value + 1 : index.value - 1)
}

/** De buurfoto's alvast laden, zodat bladeren direct een scherp beeld geeft. */
function preloadNeighbours(i: number) {
  for (const j of [i - 1, i + 1]) {
    const item = props.items[j]
    if (item) new Image().src = largestFromSrcset(item.srcset, item.src)
  }
}

watch(index, (i) => {
  if (i === null) return
  preloadNeighbours(i)
  if (dialog.value && !dialog.value.open) {
    announcement.value = ''
    document.documentElement.style.overflow = 'hidden'
    dialog.value.showModal()
  }
})
</script>

<template>
  <dialog
    ref="dialog"
    class="lb"
    aria-modal="true"
    :aria-labelledby="titleId"
    @close="onClose"
    @keydown="onKeydown"
    @click="onBackdropClick"
  >
    <h2 :id="titleId" class="visually-hidden">Fotogalerij {{ title }}</h2>
    <button type="button" class="lb-btn lb__close" aria-label="Sluiten" @click="close">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M5 5l10 10M15 5L5 15" /></svg>
    </button>

    <div v-if="current" class="lb__stage">
      <figure class="lb__figure" @pointerdown="onPointerDown" @pointerup="onPointerUp">
        <img
          :key="largest"
          :src="largest"
          :alt="imageName"
          :width="current.width"
          :height="current.height"
          decoding="async"
        >
        <figcaption class="lb__bar">
          <span class="lb__caption">{{ current.caption }}</span>
          <span class="lb__controls">
            <span class="lb__counter" aria-hidden="true">{{ counter }}</span>
            <button
              ref="prevButton"
              type="button"
              class="lb-btn"
              aria-label="Vorige foto"
              :disabled="index === 0"
              @click="go((index ?? 0) - 1)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12.5 4 6.5 10l6 6" /></svg>
            </button>
            <button
              ref="nextButton"
              type="button"
              class="lb-btn"
              aria-label="Volgende foto"
              :disabled="index === count - 1"
              @click="go((index ?? 0) + 1)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="m7.5 4 6 6-6 6" /></svg>
            </button>
          </span>
        </figcaption>
      </figure>
    </div>

    <p class="visually-hidden" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  </dialog>
</template>

<style scoped>
.lb {
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: rgba(10, 42, 107, 0.95);
  color: var(--bam-white);
}

.lb::backdrop {
  background: rgba(10, 42, 107, 0.6);
}

.lb__stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 64px 16px 16px;
}

.lb__figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin: 0;
  max-width: 90vw;
  touch-action: pan-y;
}

.lb__figure img {
  display: block;
  max-width: 90vw;
  max-height: 80vh;
  width: auto;
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.lb__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
  width: 100%;
}

.lb__caption {
  flex: 1 1 240px;
  font-size: 17px;
  line-height: 1.5;
  color: var(--bam-body-on-night);
}

.lb__controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* 26px = grote tekst; oranje op night 6.2:1. */
.lb__counter {
  margin-right: 8px;
  font-family: var(--font-accent);
  font-size: 26px;
  line-height: 1;
  color: var(--bam-orange);
  white-space: nowrap;
}

.lb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1.5px solid var(--bam-white);
  border-radius: 0;
  background: transparent;
  color: var(--bam-white);
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.lb-btn:hover:not(:disabled) {
  border-color: var(--bam-orange);
  background: var(--bam-orange);
  color: var(--bam-ink);
}

.lb-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.lb__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .lb-btn {
    transition: none;
  }
}
</style>
