<script setup lang="ts">
import { footerNavigation } from '~/config/navigation'

/**
 * Sitefooter. De contactkolom komt uit het blok "Contactgegevens" op de
 * WP-pagina "Over ons" (getContactDetails); ontbreekt dat, dan valt de kolom
 * weg in plaats van dat er iets verzonnen wordt.
 */
defineProps<{ siteName: string }>()

const { data: contact } = await useContactDetails()
const hasContact = computed(() => Boolean(contact.value.email || contact.value.addressLines.length))

const jaar = new Date().getFullYear()
</script>

<template>
  <footer class="app-footer">
    <div class="app-footer__inner">
      <div class="app-footer__brand">
        <img src="/logo.png" alt="" width="88" height="88" loading="lazy">
        <p>Bergse Alliantie voor Muziektheater</p>
      </div>
      <div v-if="hasContact" class="app-footer__contact">
        <h2 class="app-footer__heading">Contact</h2>
        <a v-if="contact.email" :href="`mailto:${contact.email}`">{{ contact.email }}</a>
        <address v-if="contact.addressLines.length">
          <template v-for="(line, i) in contact.addressLines" :key="line"><br v-if="i > 0">{{ line }}</template>
        </address>
      </div>
      <nav class="app-footer__nav" aria-labelledby="footermenu-kop">
        <h2 id="footermenu-kop" class="app-footer__heading">Menu</h2>
        <ul>
          <li v-for="item in footerNavigation" :key="item.to">
            <NuxtLink :to="item.to">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
    <div class="app-footer__bottom">
      <p>&copy; {{ jaar }} {{ siteName }}</p>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  border-top: 4px solid var(--bam-orange);
  background: var(--bam-night);
  color: var(--bam-white);
}

.app-footer__inner,
.app-footer__bottom {
  max-width: calc(var(--container) + 2 * var(--gutter));
  margin: 0 auto;
  padding-inline: var(--gutter);
}

.app-footer__inner {
  padding-block: 64px 40px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  gap: 40px;
}

.app-footer__brand {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-footer__brand img {
  display: block;
  width: 88px;
  height: 88px;
}

.app-footer__brand p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--bam-body-on-night);
}

.app-footer__heading {
  margin: 0 0 4px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--bam-orange);
}

.app-footer__contact {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--bam-body-on-night);
}

.app-footer__contact a {
  color: var(--bam-white);
  text-decoration-color: var(--bam-orange);
}

.app-footer__contact a:hover {
  color: var(--link-on-night);
}

.app-footer__contact address {
  font-style: normal;
}

.app-footer__nav ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 15px;
}

.app-footer__nav a {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  color: var(--bam-white);
  text-decoration: none;
}

.app-footer__nav a:hover {
  color: var(--link-on-night);
}

.app-footer__bottom {
  padding-block: 20px 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.app-footer__bottom p {
  margin: 0;
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--bam-body-on-night);
}
</style>
