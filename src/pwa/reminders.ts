import { todayLocal } from '../domain/dates'
import { getWeights } from '../repo/weights'
import { getDayMeals } from '../repo/meals'
import { getSteps } from '../repo/steps'

// Rappels de saisie (§ backlog « Rappels/Notifications »).
//
// Contrainte : Cap80 est un PWA statique, SANS serveur de push. On ne peut donc pas
// garantir des notifications quand l'app est complètement fermée sur tous les
// appareils. Stratégie en couches, de la plus fiable à la meilleure :
//   1. Bannière in-app (composant ReminderBanner) — toujours fiable.
//   2. Notification OS à l'ouverture si un rappel est dépassé et l'item non saisi.
//   3. Bonus : planification en arrière-plan via l'API Notification Triggers
//      (TimestampTrigger) là où le navigateur la supporte (certains Android/Chrome).

export type ReminderKey = 'weigh' | 'meals' | 'steps'

export interface ReminderPrefs {
  enabled: boolean
  weigh: boolean
  weighTime: string // 'HH:MM'
  meals: boolean
  mealsTime: string
  steps: boolean
  stepsTime: string
}

const KEY = 'cap80.reminders'

const DEFAULT_PREFS: ReminderPrefs = {
  enabled: false,
  weigh: true,
  weighTime: '08:00',
  meals: true,
  mealsTime: '20:00',
  steps: true,
  stepsTime: '20:00',
}

export function getReminderPrefs(): ReminderPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ReminderPrefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function setReminderPrefs(prefs: ReminderPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

// ---- Permission ----

export function notificationSupported(): boolean {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

// ---- Détection des saisies manquantes du jour ----

export async function pendingToday(): Promise<Record<ReminderKey, boolean>> {
  const today = todayLocal()
  const [weights, meals, steps] = await Promise.all([getWeights(), getDayMeals(today), getSteps()])
  return {
    weigh: !weights.some((w) => w.date === today),
    meals: meals.length === 0,
    steps: !steps.some((s) => s.date === today),
  }
}

interface ItemDef {
  key: ReminderKey
  on: boolean
  time: string
  title: string
  body: string
  url: string
}

export function reminderItems(p: ReminderPrefs): ItemDef[] {
  return [
    {
      key: 'weigh',
      on: p.weigh,
      time: p.weighTime,
      title: 'Pesée du matin',
      body: 'Pense à te peser avant le petit-déj ⚖️',
      url: '#/suivi',
    },
    {
      key: 'meals',
      on: p.meals,
      time: p.mealsTime,
      title: 'Journal des repas',
      body: 'As-tu noté tes repas d’aujourd’hui ? 🍽️',
      url: '#/repas',
    },
    {
      key: 'steps',
      on: p.steps,
      time: p.stepsTime,
      title: 'Tes pas du jour',
      body: 'Renseigne tes pas s’ils ne sont pas déjà saisis 👟',
      url: '#/pas',
    },
  ]
}

// ---- Utilitaires ----

const ICON = `${import.meta.env.BASE_URL}icon-192.png`

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function nowHhmm(): string {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Prochain horodatage (aujourd'hui à `hhmm` si encore à venir, sinon demain). */
function nextOccurrence(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(h, m, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return target.getTime()
}

function triggersSupported(): boolean {
  return typeof (window as { TimestampTrigger?: unknown }).TimestampTrigger === 'function'
}

// Anti-doublon : mémorise le dernier jour où un item a déclenché une notif à l'ouverture.
const NOTIFIED_KEY = 'cap80.reminders.notified'
function getNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}
function markNotified(key: ReminderKey, date: string): void {
  const m = getNotified()
  m[key] = date
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(m))
}

async function swReady(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

// ---- Notification OS à l'ouverture (fiable, sans serveur) ----

export async function runReminderCheck(): Promise<void> {
  const p = getReminderPrefs()
  if (!p.enabled) return
  if (notificationPermission() !== 'granted') return
  // Si les triggers sont supportés, la planification s'en charge : on évite le doublon.
  if (triggersSupported()) return

  const reg = await swReady()
  if (!reg) return
  // Si le push arrière-plan est configuré (abonnement présent), c'est le workflow git
  // qui envoie les notifications OS : on évite un doublon côté app. La bannière in-app
  // reste, elle, le repère visuel dans l'app.
  const sub = await reg.pushManager.getSubscription().catch(() => null)
  if (sub) return
  const hm = nowHhmm()
  const today = todayLocal()
  const pend = await pendingToday()
  const notified = getNotified()

  for (const it of reminderItems(p)) {
    if (!it.on || !pend[it.key]) continue
    if (hm < it.time) continue // pas encore l'heure du rappel
    if (notified[it.key] === today) continue // déjà notifié aujourd'hui
    try {
      await reg.showNotification(it.title, {
        body: it.body,
        tag: `cap80-${it.key}`,
        icon: ICON,
        badge: ICON,
        data: { url: it.url },
      })
      markNotified(it.key, today)
    } catch {
      // ignore : la bannière in-app reste le filet de sécurité.
    }
  }
}

// ---- Planification en arrière-plan (best-effort, là où c'est supporté) ----

export async function scheduleReminders(): Promise<void> {
  if (!triggersSupported()) return
  if (notificationPermission() !== 'granted') return
  const reg = await swReady()
  if (!reg) return
  const p = getReminderPrefs()

  for (const it of reminderItems(p)) {
    const tag = `cap80-${it.key}`
    // Retire une planification précédente non encore déclenchée pour éviter les doublons.
    try {
      const existing = await reg.getNotifications({ tag, includeTriggered: false } as never)
      existing.forEach((n) => n.close())
    } catch {
      // getNotifications peut ne pas accepter includeTriggered : sans gravité.
    }
    if (!p.enabled || !it.on) continue
    try {
      const TimestampTrigger = (window as unknown as { TimestampTrigger: new (t: number) => unknown })
        .TimestampTrigger
      await reg.showNotification(it.title, {
        body: it.body,
        tag,
        icon: ICON,
        badge: ICON,
        data: { url: it.url },
        showTrigger: new TimestampTrigger(nextOccurrence(it.time)),
      } as NotificationOptions)
    } catch {
      // ignore
    }
  }
}

/** Envoie une notification de test immédiate (bouton « Tester » des réglages). */
export async function sendTestNotification(): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false
  const reg = await swReady()
  if (!reg) return false
  try {
    await reg.showNotification('Cap80 — test', {
      body: 'Les rappels sont bien activés ✅',
      icon: ICON,
      badge: ICON,
      tag: 'cap80-test',
    })
    return true
  } catch {
    return false
  }
}

/** À appeler après toute modification des préférences. */
export async function applyReminderPrefs(): Promise<void> {
  await scheduleReminders()
  await runReminderCheck()
}

/** À appeler au démarrage et au retour au premier plan. */
export function initReminders(): void {
  const run = () => {
    void applyReminderPrefs()
  }
  run()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run()
  })
}
