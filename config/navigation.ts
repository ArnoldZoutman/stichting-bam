/**
 * ============================================================================
 * HANDMATIGE VERVANGING VAN HET WORDPRESS-MENU
 * ============================================================================
 *
 * De endpoints `/wp/v2/menu-items`, `/wp/v2/templates` en `/wp/v2/template-parts`
 * geven een 401 voor anonieme requests, en `/wp/v2/navigation` is leeg. Het
 * WP-menu is dus niet leesbaar zonder authenticatie — en authenticatie valt
 * buiten scope (geen credentials in dit project).
 *
 * Daarom staat het hoofdmenu hier als statische lijst. Dit is de ENIGE plek
 * waar de navigatie wordt gedefinieerd. Verandert het menu in WordPress, dan
 * moet deze lijst met de hand worden bijgewerkt.
 *
 * De items verwijzen naar de slugs die daadwerkelijk in de API bestaan.
 * De ticketing-pagina's (`mijn-reserveringen`, `locaties`, `categorieen`,
 * `tags`) staan hier bewust niet in: die bevatten vrijwel geen redactionele
 * content. Zie README. `Uitvoeringen` wijst naar de agenda die uit Events
 * Manager wordt opgebouwd (`pages/uitvoeringen/index.vue`), niet naar de
 * WP-pagina met dezelfde slug.
 *
 * Redesign (Art Deco): "Over BAM" blijft op het bestaande pad `/over-ons`
 * (de WP-slug) zodat er geen redirect nodig is. "Home" staat er expliciet in
 * (niet iedereen klikt op het logo); "Hart voor BAM" alleen in de footer.
 */

export interface NavItem {
  label: string
  to: string
}

export const mainNavigation: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Uitvoeringen', to: '/uitvoeringen' },
  { label: 'Nieuws', to: '/nieuws' },
  { label: 'Over BAM', to: '/over-ons' },
  { label: 'Contact', to: '/contact' },
]

/** Footermenu: het hoofdmenu plus pagina's die niet in de header passen. */
export const footerNavigation: NavItem[] = [
  ...mainNavigation,
  { label: 'Hart voor BAM', to: '/hart-voor-bam' },
]

/**
 * De knop "Kaarten" in de header. Alleen zichtbaar als er een komende
 * voorstelling is (bepaald bij de build, `/api/nav`). Ticketing valt buiten
 * scope en Events Manager levert geen kaartlink via de API; daarom wijst hij
 * naar het programma. Komt er ooit een echte bestelpagina, dan is dit de
 * enige plek.
 */
export const ticketsLink: NavItem = { label: 'Kaarten', to: '/uitvoeringen' }

/**
 * Alle paginaslugs die de API kent en die deze frontend ook daadwerkelijk als
 * eigen pagina serveert. Gebruikt voor `nitro.prerender` en als documentatie
 * van wat er bestaat.
 *
 * `uitvoeringen` staat er nog in: de WP-pagina met die slug bestaat nog
 * (id 8), maar de route `/uitvoeringen` wordt tegenwoordig eigenstandig
 * gerenderd door `pages/uitvoeringen/index.vue` (de agenda uit Events
 * Manager) — Vue Router geeft een statische route voorrang boven de
 * catch-all, dus die WP-pagina wordt niet meer gebruikt. Zie
 * `excludedPageSlugs` hieronder voor pagina's die wél zijn uitgesloten.
 */
export const knownPageSlugs = [
  'home',
  'over-ons',
  'uitvoeringen',
  'hart-voor-bam',
  'uitvoeringen-urinetown-de-musical-bedankt',
] as const

/**
 * Paginaslugs die WEL in `wp/v2/pages` bestaan, maar die deze frontend
 * bewust NIET serveert: ze bevatten in het CMS letterlijk alleen
 * `<p>CONTENTS</p>`, een placeholder die de ticketing-plugin op de
 * WordPress-site zelf invult maar die in de REST API leeg blijft. Ze leverden
 * hier tot nu toe een pagina op met alleen het woord "CONTENTS" — zie
 * `.claude/CONTEXT.md`. `getPageDocument()` in `server/utils/wp-documents.ts`
 * behandelt deze slugs als niet-bestaand (echte 404), en
 * `nuxt.config.ts` neemt ze niet op in `nitro.prerender.routes`.
 */
export const excludedPageSlugs = [
  'mijn-reserveringen',
  'locaties',
  'categorieen',
  'tags',
] as const
