<script setup lang="ts">
import type { CarouselItem } from '~/composables/useHomeCarousel'

/**
 * Fotocarrousel op de homepage ("In beeld"). De foto's en hun volgorde komen
 * uit WordPress (Weergave → Homepage-carrousel, `bam/v1/home-carousel`).
 *
 * BASIS IS CSS SCROLL-SNAP: de track scrollt horizontaal en snapt elke dia
 * naar het midden; swipen en trackpad werken daardoor zonder JS. JS doet
 * alleen wat CSS niet kan:
 *  - een IntersectionObserver bepaalt de actieve dia (teller, indicatoren,
 *    opacity/scale, `inert` op de rest);
 *  - knoppen, indicatoren, pijltjestoetsen en een klik op een buurfoto
 *    scrollen de track naar een dia;
 *  - een live-region meldt "Foto 3 van 12: …" na navigatie met knoppen of
 *    toetsenbord (niet bij elke scroll-pixel);
 *  - automatisch afspelen (zie hieronder).
 * Handmatige bediening loopt niet rond; geen libraries.
 *
 * AUTOMATISCH AFSPELEN (W3C APG-carrouselpatroon, WCAG 2.2.2):
 *  - elke 6 s naar de volgende dia; na de laatste direct terug naar de eerste;
 *  - pauzeknop (verplicht: beweging > 5 s moet te pauzeren zijn);
 *  - tijdelijk gepauzeerd bij hover, focus in de carrousel, buiten beeld of
 *    een verborgen tabblad;
 *  - blijvend gestopt zodra de bezoeker zelf navigeert (knop, indicator,
 *    toets, swipe, klik op een buurfoto) — de pauzeknop start het weer;
 *  - start niet bij `prefers-reduced-motion: reduce` (wel met de knop);
 *  - de live-region staat uit tijdens het afspelen, anders meldt een
 *    schermlezer elke 6 s een nieuwe foto.
 *
 * Dia's buiten de actieve zijn `inert`: niet focusbaar en onzichtbaar voor
 * schermlezers. Een klik daarop komt daardoor bij de track terecht; die zoekt
 * aan de hand van de klikpositie welke buurfoto bedoeld was.
 */
const props = defineProps<{
  items: CarouselItem[]
  /** Scènenummer voor de eyebrow ("Scène III"), bepaald door de pagina. */
  index: number
}>()

const uid = useId()
const titleId = `carrousel-titel-${uid}`
const trackId = `carrousel-track-${uid}`

const track = ref<HTMLElement | null>(null)
const slides = ref<HTMLElement[]>([])
const prevButton = ref<HTMLButtonElement | null>(null)
const nextButton = ref<HTMLButtonElement | null>(null)
const active = ref(0)
const announcement = ref('')
/**
 * Doel van een programmatische scroll. Zolang die loopt, passeert de track
 * tussenliggende dia's; de observer zou de teller dan laten meetellen
 * ("08 / 12" terwijl je naar 12 springt). Tot het scrollen klaar is
 * accepteert de observer daarom alleen het doel.
 */
let scrollTarget: number | null = null
let releaseTimer: ReturnType<typeof setTimeout> | undefined

function releaseTarget() {
  scrollTarget = null
  clearTimeout(releaseTimer)
}

const AUTOPLAY_MS = 6000
/** Bezoeker wil afspelen (knop); bij reduced motion standaard uit (zie onMounted). */
const playing = ref(true)
const hovered = ref(false)
const focusedWithin = ref(false)
const inView = ref(false)
const pageVisible = ref(true)
const mounted = ref(false)
const root = ref<HTMLElement | null>(null)
let autoplayTimer: ReturnType<typeof setTimeout> | undefined

const count = computed(() => props.items.length)
const multiple = computed(() => count.value > 1)
const pad = (n: number) => String(n).padStart(2, '0')
const counter = computed(() => `${pad(active.value + 1)} / ${pad(count.value)}`)
const caption = computed(() => props.items[active.value]?.caption ?? '')
/** Loopt de timer echt? (afspelen gewenst én niets dat tijdelijk pauzeert) */
const autoplayRunning = computed(() =>
  mounted.value && multiple.value && playing.value && inView.value && pageVisible.value && !hovered.value && !focusedWithin.value,
)

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Scroll de track zó dat dia `i` in het midden staat (geen verticale
 * paginasprong). `auto: true` = een stap van het automatisch afspelen: geen
 * melding, en het afspelen blijft aan. Elke andere aanroep komt van de
 * bezoeker en stopt het afspelen.
 */
function goTo(i: number, { auto = false, instant = false }: { auto?: boolean, instant?: boolean } = {}) {
  if (!auto) playing.value = false
  const announce = !auto
  const target = Math.max(0, Math.min(count.value - 1, i))
  const el = slides.value[target]
  const container = track.value
  if (!el || !container) return
  scrollTarget = target
  clearTimeout(releaseTimer)
  // Vangnet voor browsers zonder `scrollend`, of als er niets te scrollen viel.
  releaseTimer = setTimeout(releaseTarget, 1200)
  container.scrollTo({
    left: el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2,
    behavior: instant || reducedMotion() ? 'auto' : 'smooth',
  })
  // Direct bijwerken, niet wachten op de observer: zo kloppen knoppen en
  // melding meteen, ook als de smooth-scroll nog loopt.
  active.value = target
  if (announce) {
    const text = props.items[target]?.caption
    announcement.value = `Foto ${target + 1} van ${count.value}${text ? `: ${text}` : ''}`
  }
  keepFocus()
}

/** Wordt de knop met focus `disabled` (begin/einde), zet de focus dan op de andere. */
function keepFocus() {
  nextTick(() => {
    const focused = document.activeElement
    if (focused === prevButton.value && active.value === 0) nextButton.value?.focus()
    if (focused === nextButton.value && active.value === count.value - 1) prevButton.value?.focus()
  })
}

function onKeydown(event: KeyboardEvent) {
  if (!multiple.value) return
  const map: Record<string, number> = {
    ArrowLeft: active.value - 1,
    ArrowRight: active.value + 1,
    Home: 0,
    End: count.value - 1,
  }
  if (!(event.key in map)) return
  event.preventDefault()
  goTo(map[event.key]!)
}

/** Klik op een half zichtbare buurfoto: naar die foto. */
function onTrackClick(event: MouseEvent) {
  const hit = slides.value.findIndex((el) => {
    const r = el.getBoundingClientRect()
    return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
  })
  if (hit >= 0 && hit !== active.value) goTo(hit)
}

// ── Automatisch afspelen ────────────────────────────────────────────────
function scheduleAutoplay() {
  clearTimeout(autoplayTimer)
  if (!autoplayRunning.value) return
  autoplayTimer = setTimeout(() => {
    const last = active.value >= count.value - 1
    // Van de laatste terug naar de eerste: springen, niet in één ruk langs alle dia's scrollen.
    goTo(last ? 0 : active.value + 1, { auto: true, instant: last })
  }, AUTOPLAY_MS)
}

// Elke wissel (ook handmatig) of pauze-verandering zet de 6 s opnieuw in.
watch([autoplayRunning, active], scheduleAutoplay)

function togglePlay() {
  playing.value = !playing.value
}

function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) focusedWithin.value = false
}

function onVisibility() {
  pageVisible.value = document.visibilityState === 'visible'
}

/** Horizontaal scrollen met trackpad/muiswiel is navigeren; verticaal (de pagina) niet. */
function onWheel(event: WheelEvent) {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) releaseTarget()
}

/** Scrollt de track terwijl er geen programmatische scroll loopt, dan swipet de bezoeker. */
function onTrackScroll() {
  if (scrollTarget === null) playing.value = false
}

let observer: IntersectionObserver | null = null
let viewObserver: IntersectionObserver | null = null

onMounted(() => {
  if (!track.value || !multiple.value) return
  if (reducedMotion()) playing.value = false
  onVisibility()
  document.addEventListener('visibilitychange', onVisibility)
  if (root.value) {
    viewObserver = new IntersectionObserver(([entry]) => {
      inView.value = Boolean(entry?.isIntersecting)
    }, { threshold: 0.5 })
    viewObserver.observe(root.value)
  }
  mounted.value = true
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const i = slides.value.indexOf(entry.target as HTMLElement)
          if (i >= 0 && (scrollTarget === null || i === scrollTarget)) active.value = i
        }
      }
    },
    { root: track.value, threshold: [0.6] },
  )
  for (const el of slides.value) observer.observe(el)
  track.value.addEventListener('scrollend', releaseTarget)
  // Begint de bezoeker zelf te swipen/scrollen, dan telt weer elke dia.
  track.value.addEventListener('pointerdown', releaseTarget)
  track.value.addEventListener('wheel', onWheel, { passive: true })
  track.value.addEventListener('scroll', onTrackScroll, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  viewObserver?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  clearTimeout(releaseTimer)
  clearTimeout(autoplayTimer)
})
</script>

<template>
  <section
    ref="root"
    class="gallery"
    aria-roledescription="carrousel"
    :aria-labelledby="titleId"
    @keydown="onKeydown"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focusedWithin = true"
    @focusout="onFocusOut"
  >
    <div class="gallery__rays" aria-hidden="true" />

    <div class="gallery__inner reveal">
      <div class="gallery__head">
        <EyebrowLabel tone="dark" rule>Scène {{ toRoman(index) }} · In beeld</EyebrowLabel>
        <h2 :id="titleId">Zes producties, één podium</h2>
      </div>

      <div class="gallery__viewport">
        <!-- tabindex: de track is een scrollbaar gebied met (door inert) geen
             focusbare inhoud; zo is hij met het toetsenbord bereikbaar. -->
        <div
          :id="trackId"
          ref="track"
          class="track"
          :class="{ 'track--single': !multiple }"
          tabindex="0"
          role="group"
          aria-label="Foto's"
          @click="onTrackClick"
        >
          <div
            v-for="(item, i) in items"
            :key="item.id"
            ref="slides"
            class="slide"
            :class="{ 'is-active': i === active, 'slide--portrait': item.portrait }"
            role="group"
            aria-roledescription="dia"
            :aria-label="`${i + 1} van ${count}`"
            :inert="i !== active"
          >
            <div class="frame">
              <img
                :src="item.src"
                :srcset="item.srcset || undefined"
                sizes="(max-width: 760px) 88vw, min(70vw, 840px)"
                :alt="item.alt"
                :width="item.width"
                :height="item.height"
                :loading="i < 2 ? 'eager' : 'lazy'"
                decoding="async"
              >
            </div>
          </div>
        </div>
      </div>

      <div class="meta">
        <p class="meta__caption">{{ caption }}</p>
        <div class="meta__right">
          <span class="meta__counter" aria-hidden="true">{{ counter }}</span>
          <template v-if="multiple">
            <!-- WCAG 2.2.2: automatisch bewegende inhoud moet te pauzeren zijn. -->
            <button
              type="button"
              class="nav-btn"
              :aria-label="playing ? 'Automatisch afspelen pauzeren' : 'Automatisch afspelen starten'"
              :aria-controls="trackId"
              @click="togglePlay"
            >
              <svg v-if="playing" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><rect x="5" y="4" width="3.5" height="12" /><rect x="11.5" y="4" width="3.5" height="12" /></svg>
              <svg v-else width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><path d="M6 4l10 6-10 6z" /></svg>
            </button>
            <button
              ref="prevButton"
              type="button"
              class="nav-btn"
              aria-label="Vorige foto"
              :aria-controls="trackId"
              :disabled="active === 0"
              @click="goTo(active - 1)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M12.5 4 6.5 10l6 6" /></svg>
            </button>
            <button
              ref="nextButton"
              type="button"
              class="nav-btn"
              aria-label="Volgende foto"
              :aria-controls="trackId"
              :disabled="active === count - 1"
              @click="goTo(active + 1)"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75"><path d="m7.5 4 6 6-6 6" /></svg>
            </button>
          </template>
        </div>
      </div>

      <div v-if="multiple" class="dots">
        <button
          v-for="(item, i) in items"
          :key="item.id"
          type="button"
          class="dot"
          :aria-label="`Ga naar foto ${i + 1}`"
          :aria-current="i === active ? 'true' : undefined"
          :aria-controls="trackId"
          @click="goTo(i)"
        />
      </div>

      <!-- Uit tijdens automatisch afspelen (APG): anders elke 6 s een melding. -->
      <p class="visually-hidden" :aria-live="autoplayRunning ? 'off' : 'polite'" aria-atomic="true">{{ announcement }}</p>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  position: relative;
  overflow: hidden;
  padding: var(--section-y) var(--gutter);
  background: var(--bam-night);
  color: var(--bam-white);
}

/*
 * Zonnestralen zoals .sunburst, maar met 16% i.p.v. 22% blauw: op een straal
 * haalt het kleine oranje label dan 4.8:1 (bij 22% maar 4.3:1) en de
 * focusring 3.8:1. Gemeten, zie het redesign-rapport.
 */
.gallery__rays {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-conic-gradient(from 0deg at 50% 100%, rgba(0, 162, 255, 0.16) 0deg 3deg, transparent 3deg 9deg);
}

.gallery__inner {
  position: relative;
  max-width: var(--container);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.gallery__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.gallery__head h2 {
  margin: 0;
  font-size: clamp(36px, 5vw, 64px);
  line-height: 1.08;
  color: var(--bam-white);
}

/* ── Track ─────────────────────────────────────────────────────────────── */
.gallery__viewport {
  /* Maten van de dia in % van DEZE breedte (cqw), los van de padding van de track. */
  container-type: inline-size;
  --slide-w: 70cqw;
  --gap: 24px;
}

/* Smal: de track loopt door tot in de paginamarges, zodat 88cqw ook echt
   ~88% van het scherm is (anders 88% van de container ≈ 76% van het scherm). */
@media (max-width: 760px) {
  .gallery__viewport {
    --slide-w: 88cqw;
    --gap: 12px;
    margin-inline: calc(-1 * var(--gutter));
  }
}

.track {
  display: flex;
  gap: var(--gap);
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: calc((100cqw - var(--slide-w)) / 2);
  padding-inline: calc((100cqw - var(--slide-w)) / 2);
  padding-block: 8px;
  scrollbar-width: none;
}

.track::-webkit-scrollbar {
  display: none;
}

.track:focus-visible {
  outline-offset: 4px;
}

.slide {
  flex: 0 0 var(--slide-w);
  scroll-snap-align: center;
  scroll-snap-stop: always;
  opacity: 0.45;
  transform: scale(0.92);
  transition: opacity 0.4s ease, transform 0.4s ease;
  cursor: pointer;
}

.slide.is-active {
  opacity: 1;
  transform: none;
  cursor: auto;
}

.track--single .slide {
  margin-inline: auto;
}

/* Rechthoek (geen boog: die snijdt groepsfoto's te veel weg). Rand en witte
   binnenruimte zitten altijd in het kader, alleen zichtbaar bij de actieve
   dia — zo verandert de maat niet bij het wisselen. */
.frame {
  aspect-ratio: 3 / 2;
  box-sizing: border-box;
  padding: 10px;
  border: 2px solid transparent;
  background: transparent;
  transition: border-color 0.4s ease, background-color 0.4s ease;
}

.is-active .frame {
  border-color: var(--bam-orange);
  background: var(--bam-white);
}

.frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: var(--bam-night);
}

/* Staand: niet afsnijden, maar passend op een night-vlak. */
.slide--portrait .frame img {
  object-fit: contain;
}

/* ── Onderschrift en bediening ─────────────────────────────────────────── */
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 24px;
  width: min(100%, 840px);
  margin: 0 auto;
}

.meta__caption {
  flex: 1 1 260px;
  min-height: 1.5em;
  margin: 0;
  font-size: 17px;
  line-height: 1.5;
  color: var(--bam-body-on-night);
}

.meta__right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

/* 26px = grote tekst; ook op een straal ruim boven de 3:1 voor grote tekst. */
.meta__counter {
  margin-right: 8px;
  font-family: var(--font-accent);
  font-size: 26px;
  line-height: 1;
  color: var(--bam-orange);
  white-space: nowrap;
}

.nav-btn {
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

.nav-btn:hover:not(:disabled) {
  border-color: var(--bam-orange);
  background: var(--bam-orange);
  color: var(--bam-ink);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

/* Zichtbaar balkje 24×3, klikvlak 24×24 (WCAG 2.5.8). */
.dot {
  position: relative;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.dot::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 3px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.35);
  transition: background 0.3s ease;
}

.dot:hover::after {
  background: rgba(255, 255, 255, 0.7);
}

.dot[aria-current='true']::after {
  background: var(--bam-orange);
}

/* Smal: 12 balkjes op één regel. Klikvlak 22px met 2px tussenruimte: de
   middelpunten liggen 24px uit elkaar, wat WCAG 2.5.8 (spacing-uitzondering)
   toestaat. */
@media (max-width: 420px) {
  .dots {
    gap: 2px;
  }

  .dot {
    width: 22px;
  }

  .dot::after {
    left: 2px;
    right: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slide,
  .frame,
  .nav-btn,
  .dot::after {
    transition: none;
  }
}
</style>
