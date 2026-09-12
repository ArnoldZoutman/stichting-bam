<script setup lang="ts">
/**
 * Rendert de getransformeerde HTML uit de WP REST API.
 *
 * De transformatie zelf (shortcodes uitpakken, HTML normaliseren, srcset,
 * lazy loading, interne links markeren) gebeurt SERVER-SIDE in
 * `server/utils/wp-content.ts`. Dit component doet alleen twee dingen die
 * per se in de browser moeten gebeuren:
 *
 *  1. interne links afvangen en via de Vue-router navigeren, zodat je geen
 *     volledige pageload krijgt;
 *  2. de container aanbieden waar assets/css/wp-content.css op aangrijpt.
 *
 * `v-html` is hier acceptabel: de bron is ons eigen CMS en de HTML is
 * server-side door een echte HTML5-parser gehaald.
 */
const props = defineProps<{ html: string }>()

const router = useRouter()
const container = ref<HTMLElement | null>(null)

/**
 * Eén gedelegeerde click-handler op de container. Links die de server als
 * intern heeft gemarkeerd (`data-internal`) gaan via de router.
 */
function onClick(event: MouseEvent) {
  // Modifier-clicks en middelklik met rust laten: die horen een nieuw tabblad
  // te openen.
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

  const anchor = (event.target as HTMLElement | null)?.closest?.('a[data-internal]')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href || anchor.getAttribute('target') === '_blank') return

  event.preventDefault()
  router.push(href)
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="container" class="wp-content" @click="onClick" v-html="props.html" />
</template>
