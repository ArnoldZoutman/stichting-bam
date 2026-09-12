#!/usr/bin/env node
/**
 * Maakt het logbestand met API-fouten leeg vóór een build.
 *
 * Nodig omdat server/utils/build-report.ts altijd registreert (zonder
 * prerender-guard, zie de toelichting daar). Zonder deze reset zou een
 * geslaagde build worden afgekeurd op fouten van een eerdere poging.
 *
 * Yarn 4 draait geen pre/post-scripts, dus dit wordt expliciet aangeketend in
 * het `generate`-script.
 */
import { rmSync } from 'node:fs'
rmSync('.build-report', { recursive: true, force: true })
console.log('[build] logbestand met API-fouten geleegd')
