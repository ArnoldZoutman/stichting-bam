<script setup lang="ts">
/**
 * Pagina 2 en verder van het berichtenoverzicht.
 *
 * Pagina 1 heeft zijn eigen URL (`/nieuws`); `/nieuws/pagina/1` zou daar een
 * duplicaat van zijn en geeft daarom een 404.
 */
const route = useRoute()
const page = computed(() => Number(route.params.page))

if (!Number.isInteger(page.value) || page.value < 2) {
  throw createError({ statusCode: 404, statusMessage: 'Pagina niet gevonden', fatal: true })
}
</script>

<template>
  <PostListing :page="page" />
</template>
