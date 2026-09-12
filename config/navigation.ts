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
 * De ticketing-pagina's (`uitvoeringen`, `mijn-reserveringen`, `locaties`,
 * `categorieen`, `tags`) staan hier bewust niet allemaal in: die bevatten
 * vrijwel geen redactionele content. Zie README.
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
 * Alle paginaslugs die de API kent. Gebruikt voor `nitro.prerender` en als
 * documentatie van wat er bestaat.
 */
export const knownPageSlugs = [
  'home',
  'over-ons',
  'uitvoeringen',
  'hart-voor-bam',
  'locaties',
  'categorieen',
  'tags',
  'mijn-reserveringen',
  'uitvoeringen-urinetown-de-musical-bedankt',
] as const
