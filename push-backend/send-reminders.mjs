// Envoi des rappels Cap80 par Web Push, exécuté par GitHub Actions dans le DÉPÔT PRIVÉ.
// Lit push/subscription.json (abonnement + préférences + fuseau), vérifie les saisies
// du jour (poids/repas/pas) et envoie une notification pour chaque rappel dû et non
// encore satisfait. Anti-doublon via push/sent.json (commité en fin de run).
//
// Emplacement attendu dans le dépôt privé : .github/scripts/send-reminders.mjs
// Variables d'environnement (secrets/vars Actions) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…), APP_URL

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import webpush from 'web-push'

const SUB_FILE = 'push/subscription.json'
const SENT_FILE = 'push/sent.json'
const APP_URL = process.env.APP_URL || 'https://christophem59.github.io/Cap80-app/'

if (!existsSync(SUB_FILE)) {
  console.log('Aucun abonnement (push/subscription.json absent) — rien à faire.')
  process.exit(0)
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error('Clés VAPID manquantes (secrets Actions).')
  process.exit(1)
}
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const FORCE = process.env.FORCE === 'true' // test manuel : ignore heure + anti-doublon
const PING = process.env.PING === 'true' // test : envoie une notif SANS charge utile (sans chiffrement)

const sub = JSON.parse(readFileSync(SUB_FILE, 'utf8'))
const prefs = sub.prefs || {}
const tz = sub.tz || 'Europe/Paris'

// Date et heure courantes dans le fuseau de l'utilisateur.
const parts = new Intl.DateTimeFormat('fr-FR', {
  timeZone: tz,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).formatToParts(new Date())
const get = (t) => parts.find((p) => p.type === t)?.value
const today = `${get('year')}-${get('month')}-${get('day')}`
const nowHhmm = `${get('hour')}:${get('minute')}`

// Lecture d'une enveloppe { records: [...] } : dates non supprimées.
function datesInFile(path) {
  if (!existsSync(path)) return new Set()
  try {
    const env = JSON.parse(readFileSync(path, 'utf8'))
    const recs = Array.isArray(env.records) ? env.records : []
    return new Set(recs.filter((r) => r && !r.deletedAt && r.date).map((r) => r.date))
  } catch {
    return new Set()
  }
}

const monthKey = today.slice(0, 7)
const hasWeigh = datesInFile('weights.json').has(today)
const hasSteps = datesInFile('steps.json').has(today)
const hasMeals = datesInFile(`meals/${monthKey}.json`).has(today)

// Contexte, pour diagnostiquer sans deviner.
console.log(`Contexte : tz=${tz} today=${today} now=${nowHhmm} force=${FORCE}`)
console.log(`Préférences : ${JSON.stringify(prefs)}`)
console.log(`Saisi aujourd'hui — pesée:${hasWeigh} repas:${hasMeals} pas:${hasSteps}`)
const endpoint = sub.subscription?.endpoint || ''
console.log(`Cible endpoint : …${endpoint.slice(-16)} (${endpoint.split('/')[2] || '?'})`)

// Mode ping : notification sans charge utile (donc sans chiffrement) pour isoler un
// problème de payload. Si elle s'affiche (« Cap80 » sans texte), le chiffrement est en cause.
if (PING) {
  try {
    await webpush.sendNotification(sub.subscription)
    console.log('Ping envoyé (sans charge utile). Si « Cap80 » apparaît sans texte → le souci vient de la charge utile chiffrée.')
  } catch (err) {
    console.error('Échec du ping :', err?.statusCode || err?.message || err)
  }
  process.exit(0)
}

const items = [
  { key: 'weigh', on: prefs.weigh, time: prefs.weighTime, missing: !hasWeigh,
    title: 'Pesée du matin', body: 'Pense à te peser avant le petit-déj ⚖️', url: `${APP_URL}#/suivi` },
  { key: 'meals', on: prefs.meals, time: prefs.mealsTime, missing: !hasMeals,
    title: 'Journal des repas', body: 'As-tu noté tes repas d’aujourd’hui ? 🍽️', url: `${APP_URL}#/repas` },
  { key: 'steps', on: prefs.steps, time: prefs.stepsTime, missing: !hasSteps,
    title: 'Tes pas du jour', body: 'Renseigne tes pas s’ils ne sont pas déjà saisis 👟', url: `${APP_URL}#/pas` },
]

// Marqueur anti-doublon du jour.
let sent = {}
if (existsSync(SENT_FILE)) {
  try { sent = JSON.parse(readFileSync(SENT_FILE, 'utf8')) } catch { sent = {} }
}
const sentToday = new Set(sent[today] || [])

if (prefs.enabled === false) {
  console.log('Rappels désactivés côté app — rien à envoyer.')
  process.exit(0)
}

let changed = false
for (const it of items) {
  if (!it.on) {
    console.log(`skip ${it.key} : rappel désactivé dans les préférences`)
    continue
  }
  if (!it.missing) {
    console.log(`skip ${it.key} : déjà saisi aujourd'hui`)
    continue
  }
  if (!FORCE && nowHhmm < it.time) {
    console.log(`skip ${it.key} : pas encore l'heure (${nowHhmm} < ${it.time})`)
    continue
  }
  if (!FORCE && sentToday.has(it.key)) {
    console.log(`skip ${it.key} : déjà notifié aujourd'hui (push/sent.json)`)
    continue
  }
  try {
    await webpush.sendNotification(
      sub.subscription,
      JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: `cap80-${it.key}` }),
    )
    console.log(`Envoyé : ${it.key}`)
    sentToday.add(it.key)
    changed = true
  } catch (err) {
    console.error(`Échec envoi ${it.key} :`, err?.statusCode || err?.message || err)
    // 404/410 = abonnement expiré : on le signale sans planter le run.
  }
}

if (changed) {
  // Ne garde que le jour courant (purge des anciens marqueurs).
  writeFileSync(SENT_FILE, JSON.stringify({ [today]: [...sentToday] }, null, 2) + '\n')
  console.log('push/sent.json mis à jour.')
} else {
  console.log('Rien à envoyer (déjà saisi, hors horaire, ou déjà notifié).')
}
