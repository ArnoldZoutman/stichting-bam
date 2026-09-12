#!/usr/bin/env node
/**
 * Verificatie van de statische build.
 *
 * WAAROM DIT BESTAAT
 * Het risico bij een statische site is niet dat de build faalt — dat merk je.
 * Het risico is dat de build SLAAGT met een lege of halve site, omdat WordPress
 * tijdens de build even niet antwoordde. Die output wordt dan naar de hosting
 * gekopieerd en overschrijft een goede versie.
 *
 * Dit script vergelijkt de gegenereerde output met wat de API zegt dat er zou
 * moeten zijn, en eindigt met exit-code 1 zodra iets niet klopt.
 *
 * Gebruik:  node scripts/verify-build.mjs [outputmap]
 * Env:      NUXT_WP_BASE (default https://www.stichting-bam.nl/wp-json)
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || '.output/public'
const WP_BASE = (process.env.NUXT_WP_BASE || 'https://www.stichting-bam.nl/wp-json').replace(/\/$/, '')
const FAILURE_LOG = '.build-report/api-failures.jsonl'

/** Ondergrenzen. Onder deze aantallen is de site per definitie kapot. */
const MIN_PAGES = 9
const MIN_POSTS = 7
const POSTS_PER_PAGE = 6
/** Minimale hoeveelheid platte tekst in de body van een contentpagina. */
const MIN_TEXT_LENGTH = 120

const problems = []
const notes = []

function fail(msg) { problems.push(msg) }
function note(msg) { notes.push(msg) }

/** Haalt JSON op en faalt luid bij een status buiten 2xx. */
async function api(path) {
  const url = `${WP_BASE}${path}`
  let res
  try {
    res = await fetch(url)
  } catch (error) {
    throw new Error(`kon ${url} niet bereiken: ${error.message}`)
  }
  if (!res.ok) throw new Error(`${url} gaf HTTP ${res.status} ${res.statusText}`)
  return { data: await res.json(), headers: res.headers }
}

/** Platte tekst uit de body, zonder script/style, om "lege app-div" te herkennen. */
function bodyText(html) {
  const body = html.replace(/[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*/i, '')
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function checkHtml(relPath, { requireH1 = true, mustContain = [] } = {}) {
  const file = join(OUT, relPath)
  if (!existsSync(file)) {
    fail(`ontbreekt: ${relPath}`)
    return
  }
  const html = readFileSync(file, 'utf8')
  if (requireH1 && !/<h1[\s>]/i.test(html)) fail(`${relPath}: geen <h1> in de HTML`)

  const text = bodyText(html)
  if (text.length < MIN_TEXT_LENGTH) {
    fail(`${relPath}: slechts ${text.length} tekens tekst in de body (minimaal ${MIN_TEXT_LENGTH}) — ziet eruit als een lege app-div`)
  }
  for (const needle of mustContain) {
    if (!html.includes(needle)) fail(`${relPath}: mist verwachte inhoud "${needle}"`)
  }
}

async function main() {
  console.log(`Verificatie van ${OUT}`)
  console.log(`API: ${WP_BASE}\n`)

  if (!existsSync(OUT) || !statSync(OUT).isDirectory()) {
    console.error(`FOUT: outputmap ${OUT} bestaat niet. Is 'yarn generate' gedraaid?`)
    process.exit(1)
  }

  // ── 1. Mislukte API-calls tijdens de build ────────────────────────────────
  // Sommige API-fouten worden bij runtime bewust opgevangen (media-index,
  // sitenaam). Tijdens een build mag dat juist NIET stilletjes gebeuren.
  if (existsSync(FAILURE_LOG)) {
    const entries = readFileSync(FAILURE_LOG, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line) } catch { return { message: line } } })

    const hard = entries.filter((e) => e.severity !== 'recovered')
    const recovered = entries.filter((e) => e.severity === 'recovered')

    if (hard.length) {
      fail(`${hard.length} mislukte API-call(s) tijdens het prerenderen:`)
      for (const f of hard.slice(0, 10)) {
        fail(`   → HTTP ${f.status ?? 'n.v.t.'} op ${f.url} — ${f.message}`)
      }
    }
    if (recovered.length) {
      // Geen reden om af te keuren, wel een signaal: de WordPress-host zat
      // tegen zijn limiet. Blijft dit terugkomen, verlaag dan
      // nitro.prerender.concurrency of verhoog interval.
      note(`LET OP: ${recovered.length} API-call(s) slaagden pas na een nieuwe poging` +
        ` (statussen: ${[...new Set(recovered.map((e) => e.status))].join(', ')}).` +
        ` De build is goed, maar WordPress zat tegen zijn limiet aan.`)
    }
    if (!hard.length && !recovered.length) note('geen mislukte API-calls tijdens het prerenderen')
  } else {
    note('geen logbestand met API-fouten (er ging niets mis)')
  }

  // ── 2. Verwachting ophalen uit de API ─────────────────────────────────────
  const { data: pages } = await api('/wp/v2/pages?per_page=100&_fields=slug')
  const { data: posts } = await api('/wp/v2/posts?per_page=100&_fields=slug')
  const { headers } = await api(`/wp/v2/posts?per_page=${POSTS_PER_PAGE}&page=1&_fields=slug`)
  const listingPages = Number(headers.get('x-wp-totalpages') ?? 1)

  console.log(`API meldt: ${pages.length} pagina's, ${posts.length} berichten, ${listingPages} overzichtspagina('s)`)

  if (pages.length < MIN_PAGES) fail(`te weinig pagina's uit de API: ${pages.length}, verwacht minimaal ${MIN_PAGES}`)
  if (posts.length < MIN_POSTS) fail(`te weinig berichten uit de API: ${posts.length}, verwacht minimaal ${MIN_POSTS}`)

  // ── 3. Homepage-content in de API ─────────────────────────────────────────
  // Let op: dit controleert de RUWE content.rendered uit WordPress, niet de
  // gerenderde uitvoer. De pagina `home` bevat alleen een sliderplugin-shortcode
  // die bij ons geen zichtbare content oplevert (zie README); leeg raken van dit
  // veld betekent dus dat WordPress zelf niets meer teruggeeft.
  const { data: home } = await api('/wp/v2/pages?slug=home&_fields=slug,content')
  if (!home.length) {
    fail('de pagina met slug "home" bestaat niet in de API')
  } else if (!home[0].content?.rendered?.trim()) {
    fail('content.rendered van de homepage is leeg in de API')
  } else {
    note(`homepage content.rendered: ${home[0].content.rendered.trim().length} tekens`)
  }

  // ── 4. Elke verwachte route als echt HTML-bestand ─────────────────────────
  const expected = []
  for (const p of pages) expected.push(p.slug === 'home' ? 'index.html' : `${p.slug}/index.html`)
  expected.push('nieuws/index.html')
  for (let n = 2; n <= listingPages; n++) expected.push(`nieuws/pagina/${n}/index.html`)
  for (const post of posts) expected.push(`nieuws/${post.slug}/index.html`)

  for (const rel of expected) checkHtml(rel)

  // De homepage moet minstens één echte berichttitel bevatten: bewijs dat de
  // content bij de build is gerenderd en niet pas na hydratie verschijnt.
  // We kijken naar de drie nieuwste titels en eisen er één van — de homepage
  // toont er drie, dus dit faalt niet zodra de volgorde in WordPress wijzigt.
  const recent = (await api('/wp/v2/posts?per_page=3&_fields=title')).data
    .map((p) => p.title?.rendered?.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .map((t) => t.split('&')[0].slice(0, 20))
    .filter((t) => t.length >= 8)

  if (recent.length) {
    const homeFile = join(OUT, 'index.html')
    const homeHtml = existsSync(homeFile) ? readFileSync(homeFile, 'utf8') : ''
    if (!recent.some((t) => homeHtml.includes(t))) {
      fail(`index.html bevat geen van de drie nieuwste berichttitels (${recent.join(' / ')}) — het nieuwsblok is niet gerenderd`)
    }
  }

  // ── 5. 404-pagina en losse bestanden ──────────────────────────────────────
  for (const file of ['404.html', 'robots.txt', 'sitemap.xml', '.htaccess']) {
    if (!existsSync(join(OUT, file))) fail(`ontbreekt: ${file}`)
  }

  // ── 6. Totaalaantal HTML-bestanden ────────────────────────────────────────
  // Afgeleid van de API, niet hardcoded: anders faalt de build om de verkeerde
  // reden zodra er een bericht bij komt.
  const found = expected.filter((rel) => existsSync(join(OUT, rel))).length
  console.log(`HTML-bestanden: ${found} van ${expected.length} verwachte routes aanwezig`)
  if (found < expected.length) fail(`${expected.length - found} verwachte HTML-bestand(en) ontbreken`)

  // ── Rapport ───────────────────────────────────────────────────────────────
  console.log('')
  for (const n of notes) console.log(`  ok   ${n}`)
  if (!problems.length) {
    console.log('\n✔ Build geverifieerd: alle verwachte routes aanwezig en gevuld.')
    process.exit(0)
  }
  console.error(`\n✘ Build AFGEKEURD — ${problems.length} probleem(en):`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nDe output is NIET geschikt om te publiceren; een bestaande site zou ermee worden overschreven.')
  process.exit(1)
}

main().catch((error) => {
  console.error(`\n✘ Verificatie afgebroken: ${error.message}`)
  console.error('Dit betekent dat de API onbereikbaar was of een fout gaf. De build is niet te vertrouwen.')
  process.exit(1)
})
