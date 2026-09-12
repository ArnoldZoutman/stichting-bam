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
 * content. Zie README. `Uitvoeringen` wijst tegenwoordig naar de agenda die
 * uit Events Manager wordt opgebouwd (`pages/uitvoeringen/index.vue`), niet
 * meer naar de WP-pagina met dezelfde slug.
 */

export interface NavItem {
  label: string
  to: string
}

export const mainNavigation: NavItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Over ons', to: '/over-ons' },
  { label: 'Uitvoeringen', to: '/uitvoeringen' },
  { label: 'Hart voor BAM', to: '/hart-voor-bam' },
  { label: 'Nieuws', to: '/nieuws' },
]

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
