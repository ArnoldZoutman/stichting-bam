<script setup lang="ts">
/**
 * Nieuwsbriefblok ("Niets missen?") uit Nieuws.dc.html.
 *
 * Staat achter `features.newsletter` in app.config.ts en is UIT: er is nog
 * geen nieuwsbrief bevestigd. De uitnodigingstekst uit het prototype
 * ([KORTE UITNODIGING …]) bestaat nergens in het CMS en is weggelaten.
 */
const email = ref('')
const error = ref('')
const input = ref<HTMLInputElement | null>(null)

function onSubmit() {
  error.value = ''
  if (!input.value?.checkValidity()) {
    error.value = 'Vul een geldig e-mailadres in.'
    input.value?.focus()
    return
  }
  // TODO(nieuwsbrief): koppelen aan de gekozen nieuwsbriefdienst. Er is
  // bewust geen eigen backend (statische site). Tot dan doet dit niets.
}
</script>

<template>
  <section class="newsletter" aria-labelledby="nieuwsbrief-titel">
    <div class="newsletter__inner reveal">
      <div class="newsletter__text">
        <h2 id="nieuwsbrief-titel">Niets missen?</h2>
      </div>
      <form class="newsletter__form" novalidate @submit.prevent="onSubmit">
        <label for="nb-mail" class="visually-hidden">E-mailadres</label>
        <input
          id="nb-mail"
          ref="input"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          required
          placeholder="jouw@e-mailadres.nl"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? 'nb-fout' : undefined"
        >
        <BamButton type="submit">Aanmelden</BamButton>
        <p v-if="error" id="nb-fout" class="newsletter__error" role="alert">{{ error }}</p>
      </form>
    </div>
  </section>
</template>

<style scoped>
.newsletter {
  padding: 80px var(--gutter);
  background: var(--bam-peach);
}

.newsletter__inner {
  max-width: 880px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.newsletter__text {
  flex: 1 1 360px;
}

h2 {
  margin: 0;
  font-size: clamp(30px, 3.4vw, 42px);
  letter-spacing: 1px;
}

.newsletter__form {
  flex: 1 1 360px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

input {
  flex: 1 1 220px;
  min-height: 52px;
  padding: 0 18px;
  border: 1.5px solid var(--bam-ink);
  border-radius: 0;
  background: var(--bam-white);
  font-family: inherit;
  font-size: 16px;
  color: var(--bam-ink);
}

.newsletter__error {
  flex-basis: 100%;
  margin: 0;
  font-weight: 600;
  color: var(--bam-ink);
}
</style>
