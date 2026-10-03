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

  let { rows, holes } = simulate(spans, cols)
  const ops: TileSpan[] = cols >= 2 ? [{ c: 2, r: 2 }, { c: 2, r: 1 }] : []

  // Gulzig: zoek steeds de wijziging (achteraan beginnend) die de meeste gaten
  // dicht; stop als niets meer helpt. Galerijen zijn klein, dus dit is goedkoop.
  for (let guard = 0; holes > 0 && guard < orientations.length * 2; guard++) {
    let best: { i: number, span: TileSpan, rows: number, holes: number } | null = null
    for (let i = spans.length - 1; i >= (hero ? 1 : 0); i--) {
      const current = spans[i]!
      if (orientations[i] !== 'landscape' || current.c !== 1 || current.r !== 1) continue
      for (const span of ops) {
        const trial = spans.map((s, k) => (k === i ? span : s))
        const result = simulate(trial, cols)
        if (result.holes < holes && (!best || result.holes < best.holes)) best = { i, span, ...result }
      }
      if (best?.holes === 0) break
    }
    if (!best) break
    spans[best.i] = best.span
    rows = best.rows
    holes = best.holes
  }

  return { spans, rows, holes }
}
