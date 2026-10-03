import type { CarouselItem } from '~~/server/utils/wp-types'

export type { CarouselItem }

/**
 * Foto's van de homepage-carrousel. Net als de events via `useFetch` op de
 * build-time `/api`-laag: bij `nuxt generate` komt het resultaat in de
 * payload van de pagina, en bij client-side navigatie leest Nuxt die
 * payload (`_payload.json`) — er gaat live nooit een request naar `/api`.
 */
export function useHomeCarousel() {
  return useFetch<CarouselItem[]>('/api/home-carousel', {
    key: 'home-carousel',
    default: () => [],
  })
}
