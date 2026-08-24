// Validation d'un bundle hebdomadaire Cap80 AVANT application (§ injection recettes).
// Usage :  node scripts/validate-bundle.mjs <bundle.json> [--record]
//
// Rôle : « le validateur, c'est Claude Code ». On ne fait PAS l'import dans l'app ;
// ce script vérifie le fichier produit par Cowork, refuse s'il y a une incohérence,
// et n'écrit rien (sauf le hash d'idempotence avec --record, une fois le bundle appliqué).
//
// Contrôles :
//   1. Structure (foods/recipes/week/expectedTotals) et énumérations.
//   2. Références : chaque foodId/recipeId existe (catalogue actuel + bundle).
//   3. cookedFactor uniquement sur state 'cru'.
//   4. Règle légumes : catégorie 'legumes' sans « cru »/« cuit » au libellé → signalé.
//   5. Deux états (cru/cuit) à valeur per100g identique → alerte douce.
//   6. week présent ⇒ expectedTotals OBLIGATOIRE ; recalcul indépendant des totaux
//      par jour et comparaison à expectedTotals (refus + jour fautif + détail repas).
//   7. Idempotence : hash du bundle ; réappliquer le même est un no-op.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { computeFoodsHash } from './foods-version.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data')
const HASH_FILE = join(HERE, '.last-bundle.sha')

const CATEGORIES = ['legumes', 'fruits', 'proteines', 'laitiers', 'feculents', 'gras', 'epices', 'boissons', 'autre']
const STATES = ['cru', 'cuit', 'tel-quel']
const RECIPE_SLOTS = ['petit-dej', 'dejeuner', 'collation', 'diner']
const MEAL_SLOTS = [...RECIPE_SLOTS, 'extra']
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const errors = []
const warnings = []
/** Totaux recalculés par jour ; rempli plus bas, déclaré ici car `report()` peut être
 *  appelé tôt (empreinte de base incompatible). */
let dayComputed = []
const err = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

// ---- Entrées ----
const bundlePath = process.argv[2]
const record = process.argv.includes('--record')
if (!bundlePath) {
  console.error('Usage : node scripts/validate-bundle.mjs <bundle.json> [--record]')
  process.exit(2)
}
const raw = readFileSync(bundlePath)
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 16)

if (!record && existsSync(HASH_FILE) && readFileSync(HASH_FILE, 'utf8').trim() === hash) {
  console.log(`Déjà importé (hash ${hash}) — aucune modification.`)
  process.exit(0)
}

let bundle
try {
  bundle = JSON.parse(raw.toString('utf8'))
} catch (e) {
  console.error('JSON invalide :', e.message)
  process.exit(1)
}

const readData = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'))
const foodsFile = readData('foods.json')
const baseFoods = foodsFile.foods
const baseRecipes = readData('recipes.json').recipes
const basePlan = readData('plan.default.json')

// ---- 0. Empreinte de la base d'aliments (AVANT tout contrôle de totaux) ----
// Un bundle calculé sur une base antérieure produirait des écarts caloriques
// indiagnosticables : on tranche ici, avec le bon message.
const currentFoodsVersion = computeFoodsHash(baseFoods)
if (foodsFile.version !== currentFoodsVersion) {
  err(
    `foods.json n'est pas estampillé : version déclarée « ${foodsFile.version ?? 'aucune'} », ` +
      `calculée « ${currentFoodsVersion} ». Lance : node scripts/foods-version.mjs --stamp`,
  )
}
// Tolérance de forme : `foodsVersion` accepté à la racine ou dans `meta`.
const declaredFoodsVersion = bundle.foodsVersion ?? bundle.meta?.foodsVersion
if (!declaredFoodsVersion) {
  warn(`bundle sans « foodsVersion » — impossible de vérifier la base utilisée (attendu : ${currentFoodsVersion}).`)
} else if (declaredFoodsVersion !== currentFoodsVersion) {
  err(
    `Bundle calculé sur une base d'aliments DIFFÉRENTE : bundle « ${declaredFoodsVersion} » ` +
      `vs base actuelle « ${currentFoodsVersion} ».\n` +
      "    → Ce n'est pas une erreur de calcul : régénère le bundle avec le foods.json à jour\n" +
      '      (https://raw.githubusercontent.com/christophem59/Cap80-app/main/src/data/foods.json).',
  )
  // Inutile de comparer des totaux calculés sur deux bases différentes.
  report()
}

// ---- Catalogue fusionné (base + bundle), pour résoudre les références ----
const foodsById = new Map(baseFoods.map((f) => [f.id, f]))
for (const f of bundle.foods ?? []) foodsById.set(f.id, f)
const recipesById = new Map(baseRecipes.map((r) => [r.id, r]))
for (const r of bundle.recipes ?? []) recipesById.set(r.id, r)

const isNum = (x) => typeof x === 'number' && Number.isFinite(x)

// ---- 1+3+4 : foods du bundle ----
for (const f of bundle.foods ?? []) {
  const at = `foods[${f?.id ?? '?'}]`
  if (!f.id || !f.label) err(`${at} : id et label requis.`)
  if (!CATEGORIES.includes(f.category)) err(`${at} : category invalide (${f.category}).`)
  if (!STATES.includes(f.state)) err(`${at} : state invalide (${f.state}) — attendu cru|cuit|tel-quel.`)
  const p = f.per100g ?? {}
  for (const k of ['kcal', 'proteinG', 'fatG', 'carbsG', 'fiberG']) {
    if (!isNum(p[k]) || p[k] < 0) err(`${at} : per100g.${k} manquant ou négatif.`)
  }
  if ('cookedFactor' in f && f.state !== 'cru') err(`${at} : cookedFactor interdit sur un aliment '${f.state}' (uniquement 'cru').`)
  if (f.category === 'legumes' && !/\bcrue?s?\b|\bcuite?s?\b/i.test(f.label)) {
    warn(`${at} : légume sans « cru »/« cuit » au libellé — vérifie l'état (${f.state}).`)
  }
}

// ---- 5 : cru/cuit à valeur identique (sur le catalogue fusionné) ----
const sig = (p) => `${p.kcal}|${p.proteinG}|${p.fatG}|${p.carbsG}|${p.fiberG}`
const cru = new Map(), cuit = new Map()
for (const f of foodsById.values()) {
  const base = f.id.replace(/-crus?$|-cuits?$|-crues?$|-cuites?$/i, '')
  if (f.state === 'cru') cru.set(base, f)
  if (f.state === 'cuit') cuit.set(base, f)
}
for (const [base, fc] of cru) {
  const fk = cuit.get(base)
  if (fk && sig(fc.per100g) === sig(fk.per100g)) {
    warn(`états cru/cuit à valeur identique : ${fc.id} et ${fk.id} — à vérifier.`)
  }
}

// ---- 1+2 : recipes du bundle ----
for (const r of bundle.recipes ?? []) {
  const at = `recipes[${r?.id ?? '?'}]`
  if (!r.id || !r.label) err(`${at} : id et label requis.`)
  // Tolérance de forme : slot accepté en chaîne unique, normalisé en tableau.
  const slots = typeof r.slot === 'string' ? [r.slot] : r.slot
  if (!Array.isArray(slots) || slots.length === 0 || slots.some((s) => !RECIPE_SLOTS.includes(s)))
    err(`${at} : slot invalide (${JSON.stringify(r.slot)}) — attendu parmi ${RECIPE_SLOTS.join('|')}.`)
  if (!Number.isInteger(r.servings) || r.servings <= 0) err(`${at} : servings doit être un entier > 0.`)
  if ('cookedYieldG' in r && (!isNum(r.cookedYieldG) || r.cookedYieldG <= 0)) err(`${at} : cookedYieldG doit être un nombre > 0.`)
  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) err(`${at} : ingredients requis.`)
  for (const ing of r.ingredients ?? []) {
    if (!foodsById.has(ing.foodId)) err(`${at} : foodId introuvable « ${ing.foodId} » (ni catalogue ni bundle).`)
    if (!isNum(ing.grams) || ing.grams <= 0) err(`${at} : grams invalide pour « ${ing.foodId} ».`)
  }
}

// ---- Recalcul des macros ----
const ZERO = { kcal: 0, proteinG: 0, fiberG: 0 }
function recipePerServing(r) {
  let kcal = 0, prot = 0, fib = 0
  for (const ing of r.ingredients ?? []) {
    const f = foodsById.get(ing.foodId)
    if (!f) continue
    const factor = ing.grams / 100
    kcal += f.per100g.kcal * factor
    prot += f.per100g.proteinG * factor
    fib += f.per100g.fiberG * factor
  }
  const s = r.servings || 1
  return { kcal: kcal / s, proteinG: prot / s, fiberG: fib / s }
}
function mealMacros(m, dayLabel) {
  const at = `week ${dayLabel}`
  if (m.recipeId) {
    const r = recipesById.get(m.recipeId)
    if (!r) { err(`${at} : recipeId introuvable « ${m.recipeId} ».`); return ZERO }
    const per = recipePerServing(r)
    const q = m.portions ?? 1
    return { kcal: per.kcal * q, proteinG: per.proteinG * q, fiberG: per.fiberG * q }
  }
  if (m.foodId) {
    const f = foodsById.get(m.foodId)
    if (!f) { err(`${at} : foodId introuvable « ${m.foodId} ».`); return ZERO }
    if (!isNum(m.grams)) { err(`${at} : grams requis pour foodId « ${m.foodId} ».`); return ZERO }
    const factor = m.grams / 100
    return {
      kcal: f.per100g.kcal * factor,
      proteinG: f.per100g.proteinG * factor,
      fiberG: f.per100g.fiberG * factor,
    }
  }
  if (m.estimated) {
    if (!isNum(m.estimated.kcal) || !isNum(m.estimated.proteinG)) err(`${at} : estimated.kcal/proteinG requis.`)
    // Un repas estimé (restaurant) ne déclare pas ses fibres : comptées 0.
    return { kcal: m.estimated.kcal ?? 0, proteinG: m.estimated.proteinG ?? 0, fiberG: m.estimated.fiberG ?? 0 }
  }
  err(`${at} : un repas doit avoir recipeId, foodId(+grams) OU estimated.`)
  return ZERO
}

// ---- 6 : week + expectedTotals ----
if (bundle.week) {
  const days = bundle.week.days
  if (!Array.isArray(days) || days.length === 0) err('week.days vide.')
  if (!bundle.expectedTotals) err('week présent ⇒ expectedTotals OBLIGATOIRE (perDay + moyennes).')

  for (const d of days ?? []) {
    if (!DAYS.includes(d.label)) err(`week : jour « ${d.label} » invalide.`)
    // compat : ancien format slots {slot:recipeId}
    let meals = d.meals
    if (!meals && d.slots) meals = Object.entries(d.slots).map(([slot, recipeId]) => ({ slot, recipeId }))
    if (!Array.isArray(meals)) { err(`week ${d.label} : meals requis.`); meals = [] }
    let kcal = 0, prot = 0, fib = 0
    const details = []
    for (const m of meals) {
      if (m.slot && !MEAL_SLOTS.includes(m.slot)) err(`week ${d.label} : slot invalide « ${m.slot} ».`)
      const mm = mealMacros(m, d.label)
      kcal += mm.kcal; prot += mm.proteinG; fib += mm.fiberG
      details.push({ desc: m.recipeId ?? m.foodId ?? (m.estimated ? 'estimé' : '?'), kcal: mm.kcal, prot: mm.proteinG })
    }
    dayComputed.push({ label: d.label, kcal, proteinG: prot, fiberG: fib, meals: details })
  }

  // Comparaison à expectedTotals
  const et = bundle.expectedTotals
  if (et) {
    const tolK = et.toleranceKcal ?? 20
    const tolP = et.toleranceProteinG ?? 3
    const declByDay = new Map((et.perDay ?? []).map((x) => [x.label, x]))
    for (const dc of dayComputed) {
      const decl = declByDay.get(dc.label)
      if (!decl) { err(`expectedTotals.perDay manque le jour « ${dc.label} ».`); continue }
      const tolF = et.toleranceFiberG ?? 3
      const dk = Math.abs(dc.kcal - decl.kcal)
      const dp = Math.abs(dc.proteinG - decl.proteinG)
      const df = isNum(decl.fiberG) ? Math.abs(dc.fiberG - decl.fiberG) : 0
      if (dk > tolK || dp > tolP || df > tolF) {
        err(
          `Écart au-delà de la tolérance — ${dc.label} :\n` +
            `    kcal   : déclaré ${decl.kcal}  | calculé ${dc.kcal.toFixed(0)}  | écart ${(dc.kcal - decl.kcal).toFixed(0)} (tol ±${tolK})\n` +
            `    prot.  : déclaré ${decl.proteinG} | calculé ${dc.proteinG.toFixed(1)} | écart ${(dc.proteinG - decl.proteinG).toFixed(1)} (tol ±${tolP})\n` +
            (isNum(decl.fiberG)
              ? `    fibres : déclaré ${decl.fiberG} | calculé ${dc.fiberG.toFixed(1)} | écart ${(dc.fiberG - decl.fiberG).toFixed(1)} (tol ±${tolF})\n`
              : '') +
            '    détail repas : ' +
            dc.meals.map((x) => `${x.desc} (${x.kcal.toFixed(0)} kcal, P${x.prot.toFixed(1)})`).join(' · '),
        )
      }
      if (!isNum(decl.fiberG)) warn(`expectedTotals.perDay[${dc.label}] : fiberG absent — cible fibres non vérifiée (calculé ${dc.fiberG.toFixed(1)} g).`)
    }
    // Moyennes de la semaine
    const avgK = dayComputed.reduce((s, d) => s + d.kcal, 0) / (dayComputed.length || 1)
    const avgP = dayComputed.reduce((s, d) => s + d.proteinG, 0) / (dayComputed.length || 1)
    if (isNum(et.weekAvgKcal) && Math.abs(avgK - et.weekAvgKcal) > tolK)
      err(`Moyenne semaine kcal : déclaré ${et.weekAvgKcal} | calculé ${avgK.toFixed(0)} (tol ±${tolK}).`)
    if (isNum(et.weekAvgProteinG) && Math.abs(avgP - et.weekAvgProteinG) > tolP)
      err(`Moyenne semaine prot. : déclaré ${et.weekAvgProteinG} | calculé ${avgP.toFixed(1)} (tol ±${tolP}).`)
  }
}

// ---- Bloc `target` : cohérence avec le programme (signalé, jamais bloquant) ----
if (bundle.target) {
  const t = bundle.target
  const phase = (basePlan.phases ?? []).find((p) => p.id === t.phaseId)
  if (!phase) {
    warn(`target.phaseId « ${t.phaseId} » inconnu du plan par défaut — vérifie la phase visée.`)
  } else {
    if (isNum(t.calendarWeek)) {
      const end = phase.endCalendarWeek ?? Infinity
      if (t.calendarWeek < phase.startCalendarWeek || t.calendarWeek > end) {
        warn(
          `target : semaine ${t.calendarWeek} hors de la phase « ${phase.label} » ` +
            `(S${phase.startCalendarWeek}–${phase.endCalendarWeek ?? '∞'}).`,
        )
      }
    }
    if (isNum(t.targetKcal) && isNum(phase.targetKcal) && t.targetKcal !== phase.targetKcal)
      warn(`target.targetKcal ${t.targetKcal} ≠ plan ${phase.targetKcal} pour « ${phase.label} ».`)
    if (isNum(t.targetProteinG) && isNum(phase.proteinG) && t.targetProteinG !== phase.proteinG)
      warn(`target.targetProteinG ${t.targetProteinG} ≠ plan ${phase.proteinG} pour « ${phase.label} ».`)
  }
  // Les moyennes réelles doivent rester proches de la cible annoncée.
  if (isNum(t.targetKcal) && dayComputed.length) {
    const avg = dayComputed.reduce((s, d) => s + d.kcal, 0) / dayComputed.length
    if (Math.abs(avg - t.targetKcal) > 150)
      warn(`Moyenne calculée ${avg.toFixed(0)} kcal vs cible ${t.targetKcal} (écart > 150).`)
  }
} else if (bundle.week) {
  warn('bundle sans bloc « target » — semaine/phase visée non déclarée (recommandé).')
}

report()

// ---- Rapport ----
function report() {
  console.log(`\nBundle : ${bundlePath}  (hash ${hash})`)
  console.log(
    `Contenu : ${(bundle.foods ?? []).length} aliment(s), ${(bundle.recipes ?? []).length} recette(s), ` +
      `${bundle.week ? (bundle.week.days ?? []).length + ' jour(s)' : 'pas de semaine'}.`,
  )
  console.log(`Base d'aliments : ${currentFoodsVersion}${declaredFoodsVersion ? ` (bundle : ${declaredFoodsVersion})` : ''}`)
  if (bundle.target) {
    const t = bundle.target
    console.log(`Cible déclarée : S${t.calendarWeek ?? '?'} · ${t.phaseId ?? '?'} · ${t.targetKcal ?? '?'} kcal · P${t.targetProteinG ?? '?'}`)
  }

  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} avertissement(s) (non bloquant) :`)
    for (const w of warnings) console.log('  - ' + w)
  }

  if (errors.length) {
    console.log(`\n❌ REFUSÉ — ${errors.length} erreur(s), rien ne sera appliqué :\n`)
    for (const e of errors) console.log('  • ' + e)
    process.exit(1)
  }

  if (bundle.week) {
    console.log('\nTotaux recalculés par jour :')
    for (const d of dayComputed)
      console.log(
        `  ${d.label.padEnd(9)} ${d.kcal.toFixed(0).padStart(5)} kcal  P${d.proteinG.toFixed(0).padStart(3)}  F${d.fiberG.toFixed(0).padStart(3)}`,
      )
  }
  console.log('\n✅ VALIDÉ — cohérent, prêt à appliquer.')
  if (record) {
    writeFileSync(HASH_FILE, hash + '\n')
    console.log(`Hash enregistré (${hash}) : ce bundle est marqué comme appliqué.`)
  }
  process.exit(0)
}
