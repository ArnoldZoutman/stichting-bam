#!/usr/bin/env node
/**
 * Vervangt de lege `404.html`-shell door de echte, geprerenderde inhoud van
 * `/404`.
 *
 * WAAROM DIT BESTAAT
 * Nitro rendert een route met de exacte naam `404.html` altijd als een
 * client-only SPA-fallback: een lege `<div id="__nuxt"></div>` die pas na
 * hydratie tekst toont. Voor crawlers en browsers zonder JavaScript is dat
 * bestand dus feitelijk leeg, ook al staat de HTTP-status (via Apache's
 * ErrorDocument) wel goed.
 *
 * `pages/404.vue` is een gewone pagina en wordt daarom gewoon server-side
 * gerenderd naar `/404/index.html`, mét de echte tekst. Dit script kopieert
 * die inhoud over `404.html` heen en ruimt de tussenmap `404/` op — die is
 * geen route die hoort te bestaan (Apache serveert 404's via `404.html`, niet
 * via `/404/`), en zou anders als een dode link meekomen in de deploy.
 *
 * Draait ná `nuxt generate` en vóór `scripts/verify-build.mjs`, zodat de
 * faal-check de ECHTE inhoud controleert.
 *
 * Verwijdert ook de script- en modulepreload-tags uit de gekopieerde HTML.
 * Zonder JavaScript is er toch niets te hydrateren — Apache serveert dit
 * bestand voor een willekeurig pad, niet voor `/404` waar het voor gebouwd
 * is, dus hydratie zou daar alleen een "Hydration completed but contains
 * mismatches"-warning opleveren. De inline `<style>`-tags (de kritieke CSS)
 * blijven staan, dus de pagina oogt identiek; alleen de nu toch nutteloze
 * JS-afhankelijkheid verdwijnt.
 *
 * UITZONDERING: tags met `data-analytics` blijven staan. Die horen niet bij
 * de hydratie (ze zijn onafhankelijk van de Vue-app) en juist op de
 * 404-pagina is meten nuttig: zo zie je welke dode links bezoekers volgen.
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import * as cheerio from 'cheerio'

const OUT = process.argv[2] || '.output/public'
const source = join(OUT, '404', 'index.html')
const target = join(OUT, '404.html')

if (!existsSync(source)) {
  console.error(`✘ ${source} ontbreekt. Staat '/404' in nitro.prerender.routes (nuxt.config.ts)?`)
  process.exit(1)
}

const $ = cheerio.load(readFileSync(source, 'utf8'))
$('script').not('[data-analytics]').remove()
$('link[rel="modulepreload"]').remove()
writeFileSync(target, $.html())

rmSync(join(OUT, '404'), { recursive: true, force: true })

const kept = $('script[data-analytics]').length
console.log(`✔ ${target} vervangen door de geprerenderde inhoud van /404, zonder script-tags` +
  `${kept ? ` (op ${kept} analytics-tag(s) na)` : ''} (tussenmap opgeruimd).`)
