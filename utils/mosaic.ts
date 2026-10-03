/**
 * Plant het fotomozaïek (EventGallery.vue) zó dat er geen gaten vallen.
 *
 * WAAROM: met `grid-auto-flow: dense`, een blikvanger van 2×2, staande foto's
 * van 1×2 en liggende van 1×1 telt een galerij van tien liggende foto's 13
 * cellen; in 4 kolommen blijven er dan 3 gaten in de laatste rij. Deze
 * functie bootst de grid-plaatsing na en vult gaten op door liggende tegels
 * (van achter naar voren) te vergroten tot 2×2 of te verbreden tot 2×1, tot
 * er niets meer openligt — per kolomaantal, dus per breakpoint apart.
 *
 * Pure functie zonder Vue/Nuxt, getest met `node --test` (tests/mosaic.test.mjs).
 */

export type Orientation = 'landscape' | 'portrait'

export interface TileSpan {
  /** Kolommen breed. */
  c: number
  /** Rijen hoog. */
  r: number
}

export interface MosaicPlan {
  spans: TileSpan[]
  rows: number
  holes: number
}

/** Bootst `grid-auto-flow: dense` na: elk item op de eerste plek waar het past. */
export function simulate(spans: TileSpan[], cols: number): { rows: number, holes: number } {
  const grid: boolean[][] = []
  const free = (row: number, col: number) => !grid[row]?.[col]
  let rows = 0

  for (const { c, r } of spans) {
    const width = Math.min(c, cols)
    let placed = false
    for (let row = 0; !placed; row++) {
      for (let col = 0; col + width <= cols && !placed; col++) {
        let fits = true
        for (let dr = 0; dr < r && fits; dr++) {
          for (let dc = 0; dc < width && fits; dc++) fits = free(row + dr, col + dc)
        }
        if (!fits) continue
        for (let dr = 0; dr < r; dr++) {
          grid[row + dr] ??= []
          for (let dc = 0; dc < width; dc++) grid[row + dr]![col + dc] = true
        }
        rows = Math.max(rows, row + r)
        placed = true
      }
    }
  }

  let holes = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) if (free(row, col)) holes++
  }
  return { rows, holes }
}

export function planMosaic(orientations: Orientation[], cols: number, { hero = true } = {}): MosaicPlan {
  const spans: TileSpan[] = orientations.map((o, i) =>
    hero && i === 0 && cols >= 2 ? { c: 2, r: 2 } : o === 'portrait' ? { c: 1, r: 2 } : { c: 1, r: 1 },
  )

  const base = simulate(spans, cols)
  if (base.holes === 0 || cols < 2) return { spans, ...base }

  // Kandidaten: liggende 1×1-tegels (niet de blikvanger), van achter naar
  // voren — liever onderaan een grotere tegel dan bovenaan.
  const candidates: number[] = []
  for (let i = spans.length - 1; i >= (hero ? 1 : 0); i--) {
    if (orientations[i] === 'landscape') candidates.push(i)
  }
  // Volle breedte (1 rij) alleen als laatste redmiddel, bijv. 4 liggende foto's
  // in 3 kolommen; daar is met 2×1/2×2 geen sluitend raster mogelijk.
  const ops: TileSpan[] = [{ c: 2, r: 1 }, { c: 2, r: 2 }, ...(cols > 2 ? [{ c: cols, r: 1 }] : [])]

  // Begrensde zoektocht (max. 4 aanpassingen): de eerste oplossing zonder
  // gaten met zo weinig mogelijk aanpassingen. Een gulzige aanpak bleef
  // steken (gemeten: 1 gat bij bam-voyage en zo-zonde). Galerijen zijn klein
  // (≤ ~20 tegels), dus dit blijft een paar duizend simulaties.
  let best: MosaicPlan = { spans: [...spans], ...base }
  const search = (start: number, depth: number, current: TileSpan[]): MosaicPlan | null => {
    if (depth === 0) return null
    for (let k = start; k < candidates.length; k++) {
      const i = candidates[k]!
      for (const op of ops) {
        if (current[i]!.c !== 1 || current[i]!.r !== 1) continue
        const trial = current.map((s, n) => (n === i ? op : s))
        const result = simulate(trial, cols)
        if (result.holes === 0) return { spans: trial, ...result }
        if (result.holes < best.holes) best = { spans: trial, ...result }
        const deeper = search(k + 1, depth - 1, trial)
        if (deeper) return deeper
      }
    }
    return null
  }
  for (let depth = 1; depth <= 4; depth++) {
    const found = search(0, depth, spans)
    if (found) return found
  }
  // Geen oplossing gevonden: het plan met de minste gaten.
  return best
}

export interface GalleryPlan {
  /** Volgorde van de foto's (indexen in de invoer); meestal 0..n-1. */
  order: number[]
  /** Eén plan per kolomaantal, in de volgorde van `colsList`, op `order`. */
  plans: MosaicPlan[]
}

/**
 * Plant de galerij voor meerdere breakpoints tegelijk, met ÉÉN volgorde voor
 * allemaal (zichtbare volgorde = DOM-volgorde = lightbox).
 *
 * Eerst de volgorde van WordPress. Blijven er gaten (typisch: een staande
 * foto achteraan — daarna komt niets meer dat een gat kan vullen), dan als
 * laatste redmiddel één staande foto een paar plekken naar voren; de
 * blikvanger blijft eerst. Lukt ook dat niet, dan de volgorde met de minste
 * gaten.
 */
export function planGallery(orientations: Orientation[], colsList: number[]): GalleryPlan {
  const evaluate = (order: number[]) => {
    const o = order.map((i) => orientations[i]!)
    const plans = colsList.map((cols) => planMosaic(o, cols))
    return { order, plans, holes: plans.reduce((sum, p) => sum + p.holes, 0) }
  }

  const original = orientations.map((_, i) => i)
  let best = evaluate(original)
  if (best.holes === 0) return best

  for (let p = orientations.length - 1; p >= 1; p--) {
    if (orientations[p] !== 'portrait') continue
    for (let target = p - 1; target >= 1; target--) {
      const order = original.filter((i) => i !== p)
      order.splice(target, 0, p)
      const result = evaluate(order)
      if (result.holes === 0) return result
      if (result.holes < best.holes) best = result
    }
  }
  return best
}
