<script setup lang="ts">
/**
 * Knop uit het ontwerp. Met `to` een link (NuxtLink, intern of extern), zonder
 * `to` een echte `<button>`.
 *
 *  - variant `primary`: oranje vlak, inkt-tekst
 *  - variant `secondary`: 1.5px-lijn, transparant
 *  - tone `light` (op een lichte achtergrond) of `dark` (op night/blauw):
 *    bepaalt lijnkleur en hover-kleur, zie DESIGN.md "Vaste patronen".
 */
const props = withDefaults(
  defineProps<{
    to?: string
    variant?: 'primary' | 'secondary'
    tone?: 'light' | 'dark'
    size?: 'default' | 'small'
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { to: undefined, variant: 'primary', tone: 'light', size: 'default', type: 'button' },
)

const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <component
    :is="props.to ? NuxtLink : 'button'"
    :to="props.to"
    :type="props.to ? undefined : props.type"
    class="bam-button"
    :class="[`bam-button--${variant}`, `bam-button--${tone}`, `bam-button--${size}`]"
  >
    <slot />
  </component>
</template>

<style scoped>
.bam-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 16px 30px;
  border: 1.5px solid transparent;
  border-radius: 0;
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 3px;
  text-transform: uppercase;
  text-decoration: none;
  text-align: center;
  cursor: pointer;
  transition: background 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}

.bam-button--small {
  min-height: 44px;
  padding: 12px 20px;
  font-size: 13px;
}

/* Primair: oranje vlak met inkt-tekst (7.7:1). */
.bam-button--primary {
  background: var(--bam-orange);
  border-color: var(--bam-orange);
  color: var(--bam-ink);
}

.bam-button--primary.bam-button--dark:hover {
  background: var(--bam-white);
  border-color: var(--bam-white);
  color: var(--bam-ink);
}

.bam-button--primary.bam-button--light:hover {
  background: var(--bam-ink);
  border-color: var(--bam-ink);
  color: var(--bam-white);
}

/* Secundair: lijn, transparant. */
.bam-button--secondary {
  background: transparent;
  font-weight: 600;
}

.bam-button--secondary.bam-button--light {
  border-color: var(--bam-ink);
  color: var(--bam-ink);
}

.bam-button--secondary.bam-button--light:hover {
  background: var(--bam-ink);
  color: var(--bam-white);
}

.bam-button--secondary.bam-button--dark {
  border-color: var(--bam-white);
  color: var(--bam-white);
}

.bam-button--secondary.bam-button--dark:hover {
  background: var(--bam-orange);
  border-color: var(--bam-orange);
  color: var(--bam-ink);
}
</style>
