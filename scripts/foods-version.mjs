// Empreinte de la base d'aliments (§ injection). Le champ `version` de foods.json EST
// le hash de son contenu nutritionnel : un bundle déclare la version contre laquelle il
// a été calculé, et le validateur refuse un bundle calculé sur une base antérieure —
// avec le bon message, au lieu d'un faux écart calorique.
//
// Usage :
//   node scripts/foods-version.mjs           → affiche la version courante (et si elle est périmée)
//   node scripts/foods-version.mjs --stamp    → recalcule et réécrit `version` dans foods.json

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FOODS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'foods.json')

/** Hash stable du contenu qui influence les calculs (id, état, macros, facteur). */
export function computeFoodsHash(foods) {
  const norm = [...foods]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => {
      const p = f.per100g
      return [f.id, f.state, p.kcal, p.proteinG, p.fatG, p.carbsG, p.fiberG, f.cookedFactor ?? ''].join(':')
    })
    .join('|')
  return createHash('sha256').update(norm).digest('hex').slice(0, 12)
}

// Exécuté directement ? (sinon on n'expose que computeFoodsHash, sans effet de bord)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (!isMain) {
  // importé comme module : rien à faire.
} else if (process.argv.includes('--stamp')) {
  const raw = readFileSync(FOODS, 'utf8')
  const data = JSON.parse(raw)
  const hash = computeFoodsHash(data.foods)
  if (data.version === hash) {
    console.log(`Déjà à jour : ${hash}`)
  } else {
    // Réécrit seulement la ligne `version` (ou l'insère après `source`) pour préserver
    // le formatage compact « une ligne par aliment ».
    const line = `  "version": ${JSON.stringify(hash)},`
    const updated = /^\s*"version":/m.test(raw)
      ? raw.replace(/^\s*"version":.*$/m, line)
      : raw.replace(/^(\s*"source":.*)$/m, `$1\n${line}`)
    writeFileSync(FOODS, updated)
    console.log(`Version mise à jour : ${data.version ?? '(aucune)'} → ${hash}`)
  }
} else {
  const data = JSON.parse(readFileSync(FOODS, 'utf8'))
  const hash = computeFoodsHash(data.foods)
  console.log(`version déclarée : ${data.version ?? '(aucune)'}`)
  console.log(`version calculée : ${hash}`)
  console.log(data.version === hash ? 'OK — à jour.' : 'PÉRIMÉE — lance : node scripts/foods-version.mjs --stamp')
}
