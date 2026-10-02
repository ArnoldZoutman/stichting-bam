<script setup lang="ts">
/**
 * Klein label boven een kop ("Scène I · …"). 13px, letter-spacing 6px,
 * uppercase.
 *
 *  - tone `light`: `--bam-label` (op wit/sky)
 *  - tone `dark`: oranje (op night)
 *  - tone `ink`: inkt (op peach en op het blauwe vlak, waar label-blauw te
 *    weinig contrast heeft)
 *
 * Met `rule` komt er een oranje lijntje onder dat vanuit het midden groeit.
 * De wrapper heeft `display: contents`: label en lijn worden zo gewone
 * kinderen van de omringende flex-kolom en krijgen diens `gap`, net als in de
 * prototypes.
 */
withDefaults(
  defineProps<{
    tone?: 'light' | 'dark' | 'ink'
    rule?: boolean
    tag?: string
  }>(),
  { tone: 'light', rule: false, tag: 'p' },
)
</script>

<template>
  <div class="eyebrow-wrap">
    <component :is="tag" class="eyebrow" :class="`eyebrow--${tone}`"><slot /></component>
    <span v-if="rule" class="eyebrow-rule rule" aria-hidden="true" />
  </div>
</template>

<style scoped>
.eyebrow-wrap {
  display: contents;
}

.eyebrow {
  margin: 0;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  letter-spacing: 6px;
  text-transform: uppercase;
}

.eyebrow--light {
  color: var(--bam-label);
}

.eyebrow--dark {
  color: var(--bam-orange);
  font-weight: 600;
}

.eyebrow--ink {
  color: var(--bam-ink);
}

.eyebrow-rule {
  display: block;
  width: 96px;
  height: 3px;
  background: var(--bam-orange);
}
</style>
