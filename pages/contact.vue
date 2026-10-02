<script setup lang="ts">
/**
 * Contactpagina. Er bestaat geen WP-pagina `contact`; deze route is een
 * eigen Nuxt-pagina. In fase 2 van het redesign alleen de paginakop, zodat
 * het menu-item niet naar een 404 wijst. Formulier volgt in fase 6.
 */
useWpSeo({
  title: 'Contact',
  description: 'Vragen over een voorstelling, meedoen of samenwerken? Stuur Stichting BAM een bericht.',
  path: '/contact',
})
</script>

<template>
  <PageHero
    eyebrow="Laat van je horen"
    title="Contact"
    intro="Vragen over een voorstelling, meedoen of samenwerken? Stuur ons een bericht."
  />
</template>
