// Unittests voor planMosaic (utils/mosaic.ts): geen gaten in het mozaïek.
// Draaien: `yarn test` (Node >= 22.6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMosaic, simulate } from '../utils/mosaic.ts'

const L = 'landscape'
const P = 'portrait'
const rep = (o, n) => Array.from({ length: n }, () => o)

test('simulate telt gaten: blikvanger + 9 liggende in 4 kolommen = 3 gaten', () => {
  const spans = [{ c: 2, r: 2 }, ...rep({ c: 1, r: 1 }, 9)]
  assert.deepEqual(simulate(spans, 4), { rows: 4, holes: 3 })
})

for (const cols of [4, 3, 2]) {
  test(`Tegen Tijd (9 liggend), ${cols} kolommen: geen gaten`, () => {
    assert.equal(planMosaic(rep(L, 9), cols).holes, 0)
  })
  test(`10 liggend, ${cols} kolommen: geen gaten`, () => {
    assert.equal(planMosaic(rep(L, 10), cols).holes, 0)
  })
  test(`10 foto's met 4 staande (zoals de echte galerij), ${cols} kolommen: geen gaten`, () => {
    // Volgorde zoals in WordPress kan liggen; varianten met staande vooraan,
    // in het midden en achteraan.
    for (const set of [
      [L, P, L, P, L, L, P, L, P, L],
      [L, L, L, L, L, L, P, P, P, P],
      [L, P, P, P, P, L, L, L, L, L],
    ]) {
      const plan = planMosaic(set, cols)
      assert.equal(plan.holes, 0, `${set.join('')} @${cols}: ${JSON.stringify(plan.spans)}`)
    }
  })
  test(`12 en 15 foto's, ${cols} kolommen: geen gaten`, () => {
    assert.equal(planMosaic(rep(L, 12), cols).holes, 0)
    assert.equal(planMosaic([L, ...rep(P, 3), ...rep(L, 11)], cols).holes, 0)
  })
}

test('3 en 4 foto\'s: blikvanger plus de rest ernaast, zonder gaten', () => {
  assert.equal(planMosaic(rep(L, 3), 3).holes, 0)
  assert.equal(planMosaic(rep(L, 4), 4).holes, 0)
})

test('staande foto\'s blijven 2 rijen hoog, de blikvanger 2×2', () => {
  const plan = planMosaic([L, P, L, L, L, L, L, L, L, L], 4)
  assert.deepEqual(plan.spans[0], { c: 2, r: 2 })
  assert.deepEqual(plan.spans[1], { c: 1, r: 2 })
})
