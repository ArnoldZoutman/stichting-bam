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
  <!--
    GEEN eigen skip-link/header/main/footer hier: `app.vue` wrapt elke pagina
    (incl. deze) al in precies die shell via `<NuxtPage />`. Die ooit hier
    verdubbelen gaf een geneste `id="hoofdinhoud"` (ongeldige HTML, skip-link
    sprong naar de verkeerde plek) én twee sitenamen door elkaar: de buitenste
    header las de echte naam uit de API (`useSiteInfo` in app.vue), deze
    pagina had zijn eigen hardcoded "Stichting BAM"-fallback. Met één shell is
    er ook maar één bron voor de sitenaam.
  -->
  <div class="container error-page">
    <h1>404</h1>
    <p>Pagina niet gevonden</p>
    <p>Deze pagina bestaat niet (meer). Controleer het adres of ga terug naar de startpagina.</p>
    <p><NuxtLink class="button" to="/">Terug naar home</NuxtLink></p>
  </div>
</template>
