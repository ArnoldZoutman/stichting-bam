// Unittests voor planMosaic (utils/mosaic.ts): geen gaten in het mozaïek.
// Draaien: `yarn test` (Node >= 22.6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planMosaic, planGallery, simulate } from '../utils/mosaic.ts'

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

// De echte volgordes op cms.stichting-bam.nl (okt 2026); hier bleef de eerste,
// gulzige versie op 1 gat steken.
const ECHT = {
  'bam-voyage': [L, L, L, L, L, L, L, L, P, L],
  'zo-zonde': [L, P, L, P, L, L, L, L, P, L],
  'tegen-tijd': rep(L, 9),
}
for (const [naam, set] of Object.entries(ECHT)) {
  for (const cols of [4, 3, 2]) {
    test(`echte galerij ${naam}, ${cols} kolommen: geen gaten`, () => {
      const plan = planMosaic(set, cols)
      assert.equal(plan.holes, 0, JSON.stringify(plan.spans))
    })
  }
}

test('willekeurige galerijen van 7 t/m 20 foto\'s met hooguit 40% staande: geen gaten (planGallery)', () => {
  // Gemeten grens (4000 willekeurige galerijen): bij >= 7 foto's met <= 40%
  // staande altijd sluitend (0 van 1743). Bij kleinere galerijen of meer
  // staande foto's kan op één breakpoint een gat overblijven; staande foto's
  // blijven bewust 2 rijen hoog. De echte galerijen: max. 3 staande op 10.
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let run = 0; run < 400; run++) {
    const n = 7 + Math.floor(rnd() * 14)
    const cap = Math.floor(n * 0.4)
    let portraits = 0
    const set = Array.from({ length: n }, (_, i) => (i > 0 && portraits < cap && rnd() < 0.3 && ++portraits ? P : L))
    const g = planGallery(set, [4, 3, 2])
    assert.deepEqual(g.plans.map((p) => p.holes), [0, 0, 0], `${set.map((o) => o[0]).join('')}`)
    assert.equal(g.order[0], 0, 'blikvanger blijft eerst')
  }
})

test('planGallery houdt de volgorde van WordPress als die al sluit', () => {
  const g = planGallery(ECHT['zo-zonde'], [4, 3, 2])
  assert.deepEqual(g.order, ECHT['zo-zonde'].map((_, i) => i))
})

test('planGallery schuift een staande foto achteraan naar voren als dat nodig is', () => {
  const set = [...rep(L, 11), P]
  const g = planGallery(set, [4, 3, 2])
  assert.deepEqual(g.plans.map((p) => p.holes), [0, 0, 0])
  assert.notEqual(g.order.at(-1), 11)
})

test('3 en 4 foto\'s: blikvanger plus de rest ernaast, zonder gaten', () => {
  assert.equal(planMosaic(rep(L, 3), 3).holes, 0)
  assert.equal(planMosaic(rep(L, 4), 4).holes, 0)
})

test('staande foto\'s blijven 2 rijen hoog, de blikvanger 2×2', () => {
  const plan = planMosaic([L, P, L, L, L, L, L, L, L, L], 4)
  assert.deepEqual(plan.spans[0], { c: 2, r: 2 })
  assert.deepEqual(plan.spans[1], { c: 1, r: 2 })
})
