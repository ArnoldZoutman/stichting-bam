<script setup lang="ts">
/**
 * Agenda-overzicht, opgebouwd uit Events Manager (`/api/events`).
 *
 * Deze route botst met de WP-PAGINA "uitvoeringen" (id 8, lege titel): die
 * bestaat nog in WordPress, maar Vue Router geeft een statische route als
 * deze voorrang boven de catch-all (`pages/[...slug].vue`), dus deze pagina
 * wint altijd. Bewust: het gegenereerde overzicht komt rechtstreeks uit
 * Events Manager en is dus altijd actueel; de WP-pagina moet bij elke nieuwe
 * productie met de hand worden bijgewerkt.
 *
 * De WP-pagina bleek bij controle geen aparte introtekst te bevatten — alleen
 * een handmatige kopie van dezelfde 6 voorstellingen (teaser + afbeelding +
 * "Lees meer"-knop) die dit overzicht nu automatisch genereert. Die tonen we
 * daarom niet nogmaals boven dit overzicht: dat zou exact dezelfde
 * voorstellingen dubbel laten zien.
 */
const { data: events, error } = await useFetch('/api/events', { key: 'uitvoeringen' })

if (error.value) {
  throw createError({
    statusCode: 502,
    statusMessage: 'Voorstellingen konden niet worden geladen',
    fatal: true,
  })
}

useWpSeo({
  title: 'Uitvoeringen',
  description: 'Voorstellingen van Stichting BAM: aankomende producties en het archief van eerdere voorstellingen.',
  path: '/uitvoeringen',
})
</script>

<template>
  <div class="container">
    <div class="page-header">
      <h1>Uitvoeringen</h1>
    </div>

    <section v-if="events?.upcoming.length">
      <h2>Aankomend</h2>
      <ul class="event-list">
        <EventCard v-for="event in events.upcoming" :key="event.id" :event="event" />
      </ul>
    </section>

    <section>
      <h2>Archief</h2>
      <ul v-if="events?.past.length" class="event-list">
        <EventCard v-for="event in events.past" :key="event.id" :event="event" />
      </ul>
      <div v-else class="content-notice">
        <p>Er zijn nog geen eerdere voorstellingen.</p>
      </div>
    </section>
  </div>
</template>
