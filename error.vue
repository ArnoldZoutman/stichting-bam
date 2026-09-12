<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const is404 = computed(() => props.error?.statusCode === 404)
const titel = computed(() => (is404.value ? 'Pagina niet gevonden' : 'Er ging iets mis'))

useHead({ title: titel })
</script>

<template>
  <div>
    <a class="skip-link" href="#hoofdinhoud">Naar de inhoud</a>
    <SiteHeader site-name="Stichting BAM" />
    <main id="hoofdinhoud">
      <div class="container error-page">
        <h1>{{ error?.statusCode ?? 500 }}</h1>
        <p>{{ titel }}</p>
        <p v-if="is404">Deze pagina bestaat niet (meer). Controleer het adres of ga terug naar de startpagina.</p>
        <p><NuxtLink class="button" to="/" @click="clearError({ redirect: '/' })">Terug naar home</NuxtLink></p>
      </div>
    </main>
    <SiteFooter site-name="Stichting BAM" />
  </div>
</template>
