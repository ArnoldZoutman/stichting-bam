#!/usr/bin/env node
/**
 * Zet een geverifieerde build klaar in `dist/` als deploy-artefact.
 *
 * WAAROM DIT BESTAAT
 * `nuxt generate` leegt `.output` vóórdat het begint te bouwen. Een mislukte
 * build laat dus een LEGE `.output/public` achter. Een deployscript dat daarna
 * onvoorwaardelijk naar `public_html` synchroniseert, wist de live site.
 *
 * Daarom is `.output/public` niet het deploy-artefact. Dit script kopieert
 * alleen een build die door scripts/verify-build.mjs is goedgekeurd naar
 * `dist/`, en doet dat via een tijdelijke map die pas op het laatst wordt
 * omgewisseld. `dist/` bevat daardoor altijd de laatste GOEDE build, ook als de
 * bouw daarna een keer mislukt.
 *
 * Deploy dus vanuit `dist/`, nooit vanuit `.output/public`.
 */

import { cpSync, existsSync, rmSync, renameSync, readdirSync } from 'node:fs'

const SOURCE = '.output/public'
const TARGET = 'dist'
const STAGING = 'dist.staging'

if (!existsSync(SOURCE)) {
  console.error(`✘ ${SOURCE} bestaat niet. Draai eerst 'yarn generate'.`)
  process.exit(1)
}

const entries = readdirSync(SOURCE)
if (!entries.length) {
  console.error(`✘ ${SOURCE} is leeg. Er is niets om te publiceren.`)
  process.exit(1)
}

rmSync(STAGING, { recursive: true, force: true })
cpSync(SOURCE, STAGING, { recursive: true })

// Pas omwisselen als de kopie compleet is.
const previous = existsSync(TARGET) ? `${TARGET}.vorige` : null
if (previous) {
  rmSync(previous, { recursive: true, force: true })
  renameSync(TARGET, previous)
}
renameSync(STAGING, TARGET)
if (previous) rmSync(previous, { recursive: true, force: true })

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    entry.isDirectory() ? walk(path) : files.push(path)
  }
}
walk(TARGET)

console.log(`✔ Geverifieerde build klaargezet in ${TARGET}/ (${files.length} bestanden)`)
console.log(`  Upload de INHOUD van ${TARGET}/ naar public_html/ — inclusief .htaccess.`)
