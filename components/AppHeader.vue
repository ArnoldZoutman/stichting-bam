<script setup lang="ts">
import { mainNavigation, ticketsLink } from '~/config/navigation'

/**
 * Siteheader met hoofdmenu en de knop "Kaarten".
 *
 * PROGRESSIVE ENHANCEMENT, en dat is hier geen luxe: `scripts/finalize-404.mjs`
 * haalt alle script-tags uit 404.html. Een menu dat alleen met JS opengaat
 * zou daar onbruikbaar zijn. Daarom:
 *  - zonder JS (en vóór hydratie) staat het menu gewoon open en loopt het op
 *    smalle schermen door op meerdere regels;
 *  - met JS zet een inline script in de <head> (nuxt.config.ts) vóór de
 *    eerste paint `html.js`; daarop verschijnt de hamburgerknop en klapt het
 *    menu op mobiel in. Bewust niet via `onMounted`: dan zou het menu bij
 *    elke pageload eerst open staan en daarna verspringen (CLS).
 *
 * Actieve status: `aria-current="page"` op de exacte pagina, `"true"` op de
 * sectie (bijv. "Uitvoeringen" op een voorstellingspagina). We zetten dat
 * zelf via `custom`-NuxtLinks, zodat de knop "Kaarten" (die ook naar
 * /uitvoeringen wijst) niet óók als huidige pagina wordt aangekondigd.
 */
defineProps<{ siteName: string }>()

const route = useRoute()
const open = ref(false)
const toggle = ref<HTMLButtonElement | null>(null)

// Na navigeren hoort het mobiele menu dicht te zijn.
watch(() => route.path, () => {
  open.value = false
})

function current(to: string): 'page' | 'true' | undefined {
  const path = route.path.replace(/\/$/, '') || '/'
  if (path === to) return 'page'
  if (path.startsWith(`${to}/`)) return 'true'
  return undefined
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    toggle.value?.focus()
  }
}
</script>

<template>
  <header
    class="app-header"
    :class="{ 'is-open': open }"
    @keydown="onKeydown"
  >
    <div class="app-header__inner">
      <NuxtLink to="/" class="app-header__logo">
        <!-- Boven de vouw op elke pagina; zonder prioriteit wacht hij achter de affiches uit het CMS (gemeten ~3 s). -->
        <img src="/logo.png" :alt="`${siteName} – naar de startpagina`" width="64" height="64" fetchpriority="high">
      </NuxtLink>

      <button
        ref="toggle"
        type="button"
        class="app-header__toggle"
        aria-controls="hoofdmenu"
        :aria-expanded="open ? 'true' : 'false'"
        @click="open = !open"
      >
        <span class="app-header__toggle-icon" aria-hidden="true"><span /></span>
        <!-- Vast label: de toestand zit in aria-expanded, anders wordt hij dubbel voorgelezen. -->
        <span>Menu</span>
      </button>

      <nav id="hoofdmenu" class="app-header__nav" aria-label="Hoofdmenu">
        <ul>
          <li v-for="item in mainNavigation" :key="item.to">
            <NuxtLink v-slot="{ href, navigate }" :to="item.to" custom>
              <a :href="href ?? item.to" :aria-current="current(item.to)" class="app-header__link" @click="navigate">{{ item.label }}</a>
            </NuxtLink>
          </li>
        </ul>
        <NuxtLink v-slot="{ href, navigate }" :to="ticketsLink.to" custom>
          <a :href="href ?? ticketsLink.to" class="app-header__tickets" @click="navigate">{{ ticketsLink.label }}</a>
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  z-index: 5;
  background: var(--bam-night);
  border-bottom: 1px solid rgba(255, 150, 0, 0.5);
}

.app-header__inner {
  max-width: calc(var(--container) + 2 * var(--gutter));
  margin: 0 auto;
  padding: 18px var(--gutter);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.app-header__logo {
  display: flex;
  flex: none;
}

.app-header__logo img {
  display: block;
  width: 64px;
  height: 64px;
}

.app-header__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.app-header__nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.app-header__link {
  display: inline-block;
  padding: 6px 0;
  border-bottom: 2px solid transparent;
  color: var(--bam-white);
  text-decoration: none;
  transition: color 0.3s ease, border-color 0.3s ease;
}

.app-header__link:hover {
  color: var(--link-on-night);
}

.app-header__link[aria-current] {
  border-bottom-color: var(--bam-orange);
}

.app-header__tickets {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 12px 20px;
  background: var(--bam-orange);
  color: var(--bam-ink);
  font-weight: 700;
  text-decoration: none;
  transition: background 0.3s ease, color 0.3s ease;
}

.app-header__tickets:hover {
  background: var(--bam-white);
  color: var(--bam-ink);
}

/* Zonder JS onzichtbaar: dan is er niets om open/dicht te klappen. */
.app-header__toggle {
  display: none;
}

@media (max-width: 899px) {
  html.js .app-header__toggle {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 0 16px;
    border: 1.5px solid var(--bam-white);
    background: transparent;
    color: var(--bam-white);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
  }

  .app-header__toggle-icon,
  .app-header__toggle-icon span,
  .app-header__toggle-icon span::before,
  .app-header__toggle-icon span::after {
    display: block;
    width: 20px;
    height: 2px;
  }

  .app-header__toggle-icon {
    height: 14px;
    position: relative;
  }

  .app-header__toggle-icon span {
    position: absolute;
    top: 6px;
    background: var(--bam-orange);
    transition: background 0.2s ease;
  }

  .app-header__toggle-icon span::before,
  .app-header__toggle-icon span::after {
    content: '';
    position: absolute;
    left: 0;
    background: var(--bam-orange);
    transition: transform 0.2s ease;
  }

  .app-header__toggle-icon span::before {
    transform: translateY(-6px);
  }

  .app-header__toggle-icon span::after {
    transform: translateY(6px);
  }

  .is-open .app-header__toggle-icon span {
    background: transparent;
  }

  .is-open .app-header__toggle-icon span::before {
    transform: rotate(45deg);
  }

  .is-open .app-header__toggle-icon span::after {
    transform: rotate(-45deg);
  }

  /* Met JS: menu als uitklappaneel over de volle breedte. */
  html.js .app-header__nav {
    display: none;
    flex-basis: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 8px 0 12px;
  }

  html.js .is-open .app-header__nav {
    display: flex;
  }

  html.js .app-header__nav ul {
    flex-direction: column;
    gap: 0;
  }

  html.js .app-header__link {
    display: flex;
    align-items: center;
    min-height: 48px;
    width: 100%;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  }

  html.js .app-header__link[aria-current] {
    color: var(--bam-orange);
    border-bottom-color: rgba(255, 255, 255, 0.15);
    box-shadow: inset 3px 0 0 var(--bam-orange);
    padding-left: 14px;
  }

  html.js .app-header__tickets {
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-header__toggle-icon span,
  .app-header__toggle-icon span::before,
  .app-header__toggle-icon span::after {
    transition: none;
  }
}
</style>
