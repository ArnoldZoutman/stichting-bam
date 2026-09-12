<script setup lang="ts">
const { data: site } = await useSiteInfo()
const siteName = computed(() => site.value?.name ?? 'Stichting BAM')

useHead({
  // Op de startpagina is de paginatitel al de sitenaam; die niet verdubbelen.
  titleTemplate: (title?: string) =>
    !title || title === siteName.value ? siteName.value : `${title} — ${siteName.value}`,
})
</script>

<template>
  <div>
    <a class="skip-link" href="#hoofdinhoud">Naar de inhoud</a>
    <SiteHeader :site-name="siteName" />
    <main id="hoofdinhoud">
      <NuxtPage />
    </main>
    <SiteFooter :site-name="siteName" />
  </div>
</template>
