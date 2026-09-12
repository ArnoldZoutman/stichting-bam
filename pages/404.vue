<script setup lang="ts">
/**
 * Echte, geprerenderde 404-inhoud — in tegenstelling tot `404.html`, dat Nitro
 * altijd als lege client-only SPA-shell rendert (zie
 * `scripts/finalize-404.mjs` en .claude/VALKUILEN.md). Deze pagina wordt
 * gewoon server-side gerenderd naar `/404/index.html` en daarna over
 * `404.html` heen gekopieerd.
 *
 * Bevat expres geen data-afhankelijkheid (geen `useFetch`): de inhoud moet
 * blijven werken als de WordPress-API niet bereikbaar is.
 */
useHead({ title: 'Pagina niet gevonden' })
</script>

<template>
  <div>
    <a class="skip-link" href="#hoofdinhoud">Naar de inhoud</a>
    <SiteHeader site-name="Stichting BAM" />
    <main id="hoofdinhoud">
      <div class="container error-page">
        <h1>404</h1>
        <p>Pagina niet gevonden</p>
        <p>Deze pagina bestaat niet (meer). Controleer het adres of ga terug naar de startpagina.</p>
        <p><NuxtLink class="button" to="/">Terug naar home</NuxtLink></p>
      </div>
    </main>
    <SiteFooter site-name="Stichting BAM" />
  </div>
</template>
