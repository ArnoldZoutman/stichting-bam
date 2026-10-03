// Unittests voor extractGallery (server/utils/wp-gallery.ts).
//
// Draaien: `yarn test` (= node --test --experimental-strip-types tests/).
// Vereist Node >= 22.6 voor --experimental-strip-types. Bewust .mjs: zo valt
// dit bestand buiten de typecheck van Nuxt, die een import met .ts-extensie
// zou afkeuren.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractGallery } from '../server/utils/wp-gallery.ts'

const img = (id, extra = '') =>
  `<img loading="lazy" decoding="async" width="1024" height="683" data-id="${id}" src="https://cms.example/foto-${id}-1024x683.jpg" alt="" class="wp-image-${id}" srcset="https://cms.example/foto-${id}-300x200.jpg 300w, https://cms.example/foto-${id}-1024x683.jpg 1024w" ${extra}/>`

// Zoals op cms.stichting-bam.nl (okt 2026), ingekort.
const gutenberg = `<p>Inleiding.</p>
<figure class="wp-block-gallery has-nested-images columns-default is-cropped wp-block-gallery-1 is-layout-flex wp-block-gallery-is-layout-flex">
<figure class="wp-block-image size-large">${img(2252)}</figure>
<figure class="wp-block-image size-large">${img(2250)}<figcaption class="wp-element-caption">De slotscène</figcaption></figure>
<figure class="wp-block-image size-large">${img(2249)}</figure>
</figure>
<p>Slot.</p>`

test('Gutenberg-galerij: ID\'s in volgorde, bijschrift per foto, galerij weg uit de content', () => {
  const r = extractGallery(gutenberg)
  assert.deepEqual(r.ids, [2252, 2250, 2249])
  assert.equal(r.fallbackItems.length, 3)
  assert.equal(r.fallbackItems[0].src, 'https://cms.example/foto-2252-1024x683.jpg')
  assert.equal(r.fallbackItems[0].width, 1024)
  assert.equal(r.fallbackItems[0].height, 683)
  assert.equal(r.fallbackItems[1].caption, 'De slotscène')
  assert.equal(r.fallbackItems[0].caption, '')
  assert.ok(!r.contentWithoutGallery.includes('wp-block-gallery'))
  assert.ok(!r.contentWithoutGallery.includes('<img'))
  assert.ok(r.contentWithoutGallery.includes('Inleiding.'))
  assert.ok(r.contentWithoutGallery.includes('Slot.'))
})

test('ID uit wp-image-<id> als data-id ontbreekt', () => {
  const html = `<figure class="wp-block-gallery"><figure class="wp-block-image"><img src="https://cms.example/a.jpg" class="wp-image-77" width="800" height="1200" alt="Staand"></figure></figure>`
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [77])
  assert.equal(r.fallbackItems[0].alt, 'Staand')
})

test('klassieke [gallery]-shortcode (div.gallery met .gallery-item)', () => {
  const html = `<div id="gallery-1" class="gallery galleryid-5 gallery-columns-3">
<dl class="gallery-item"><dt class="gallery-icon"><a href="https://cms.example/a" data-attachment-id="11"><img width="300" height="200" src="https://cms.example/a-300x200.jpg" alt=""></a></dt><dd class="wp-caption-text gallery-caption">Eerste</dd></dl>
<dl class="gallery-item"><dt class="gallery-icon"><img width="300" height="200" src="https://cms.example/b-300x200.jpg" class="attachment-thumbnail wp-image-12" alt=""></dt></dl>
</div><p>Daarna.</p>`
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [11, 12])
  assert.equal(r.fallbackItems[0].caption, 'Eerste')
  assert.ok(!r.contentWithoutGallery.includes('gallery-item'))
  assert.ok(r.contentWithoutGallery.includes('Daarna.'))
})

test('galerij zonder ID\'s: ids leeg, wel fallback-items met de img-attributen', () => {
  const html = `<figure class="wp-block-gallery"><figure class="wp-block-image"><img src="https://cms.example/x.jpg" srcset="https://cms.example/x.jpg 1024w" width="1024" height="683" alt="Zaal"></figure></figure>`
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [])
  assert.equal(r.fallbackItems.length, 1)
  assert.equal(r.fallbackItems[0].id, null)
  assert.equal(r.fallbackItems[0].srcset, 'https://cms.example/x.jpg 1024w')
})

test('content zonder galerij blijft ongewijzigd', () => {
  const html = '<p>Alleen tekst, met een <img src="https://cms.example/losse.jpg" alt=""> losse afbeelding.</p>'
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [])
  assert.deepEqual(r.fallbackItems, [])
  assert.equal(r.contentWithoutGallery, html)
})

test('alleen de EERSTE van twee galerijen wordt eruit gehaald', () => {
  const html = `<figure class="wp-block-gallery"><figure class="wp-block-image">${img(1)}</figure></figure>
<p>Tussen.</p>
<figure class="wp-block-gallery"><figure class="wp-block-image">${img(2)}</figure></figure>`
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [1])
  assert.ok(r.contentWithoutGallery.includes('data-id="2"'))
  assert.ok(!r.contentWithoutGallery.includes('data-id="1"'))
})

test('dubbele ID\'s worden één keer geteld, maar elke foto blijft een fallback-item', () => {
  const html = `<figure class="wp-block-gallery"><figure class="wp-block-image">${img(5)}</figure><figure class="wp-block-image">${img(5)}</figure></figure>`
  const r = extractGallery(html)
  assert.deepEqual(r.ids, [5])
  assert.equal(r.fallbackItems.length, 2)
})

test('lege of ontbrekende content', () => {
  assert.deepEqual(extractGallery('').ids, [])
  assert.equal(extractGallery('').contentWithoutGallery, '')
})
