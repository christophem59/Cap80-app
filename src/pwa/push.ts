import { GitHubClient } from '../sync/github'
import { getRepoConfig, getToken, isConfigured } from '../sync/config'
import { utf8ToBase64 } from '../sync/base64'
import { getReminderPrefs } from './reminders'

// Web Push (§ backlog « notifications app fermée »). Le front s'abonne au push et
// dépose l'abonnement + les préférences dans le dépôt PRIVÉ (push/subscription.json).
// Un workflow GitHub Actions (cf. push-backend/) lit ce fichier et envoie les rappels.

const VAPID_KEY = 'cap80.push.vapidPublic'
const SUB_FILE = 'push/subscription.json'

export function getVapidPublicKey(): string {
  return localStorage.getItem(VAPID_KEY)?.trim() ?? ''
}
export function setVapidPublicKey(key: string): void {
  localStorage.setItem(VAPID_KEY, key.trim())
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

function getClient(): GitHubClient | null {
  const cfg = getRepoConfig()
  const token = getToken()
  if (!cfg || !token) return null
  return new GitHubClient({ ...cfg, token })
}

// La clé VAPID (base64url) doit être convertie en Uint8Array pour applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function isPushActive(): Promise<boolean> {
  return (await currentSubscription()) != null
}

/** Écrit l'abonnement + les préférences courantes dans le dépôt privé. */
export async function uploadSubscription(sub: PushSubscription): Promise<void> {
  const client = getClient()
  if (!client) throw new Error('Synchronisation non configurée : impossible de déposer l’abonnement.')
  const p = getReminderPrefs()
  const body = {
    subscription: sub.toJSON(),
    prefs: {
      enabled: p.enabled,
      weigh: p.weigh,
      weighTime: p.weighTime,
      meals: p.meals,
      mealsTime: p.mealsTime,
      steps: p.steps,
      stepsTime: p.stepsTime,
    },
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
    updatedAt: new Date().toISOString(),
  }
  const content = utf8ToBase64(JSON.stringify(body, null, 2) + '\n')
  const existing = await client.getFile(SUB_FILE)
  if (existing.status === 'present') {
    await client.putFile(SUB_FILE, content, 'push : abonnement', existing.sha)
  } else {
    await client.putFile(SUB_FILE, content, 'push : abonnement')
  }
}

/**
 * Active le push : s'abonne (avec la clé VAPID) et dépose l'abonnement dans le dépôt
 * privé. Renvoie un libellé d'erreur explicite, ou null si succès.
 */
export async function enablePush(): Promise<string | null> {
  if (!pushSupported()) return 'Push non pris en charge par ce navigateur.'
  if (Notification.permission !== 'granted') return 'Autorise d’abord les notifications.'
  if (!isConfigured()) return 'Configure d’abord la synchronisation GitHub (dépôt privé + token).'
  const vapid = getVapidPublicKey()
  if (!vapid) return 'Renseigne la clé publique VAPID (voir la mise en place du back).'

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      })
    } catch {
      return 'Abonnement push refusé ou clé VAPID invalide.'
    }
  }
  try {
    await uploadSubscription(sub)
  } catch (err) {
    return err instanceof Error ? err.message : 'Échec du dépôt de l’abonnement.'
  }
  return null
}

/** Met à jour l'abonnement déposé (ex. après changement d'horaires), si actif. */
export async function refreshSubscriptionUpload(): Promise<void> {
  const sub = await currentSubscription()
  if (sub) {
    try {
      await uploadSubscription(sub)
    } catch {
      // silencieux : la prochaine activation renverra l'abonnement.
    }
  }
}

/** Désactive le push : désabonnement + suppression du fichier du dépôt privé. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (sub) await sub.unsubscribe().catch(() => {})
  const client = getClient()
  if (!client) return
  const existing = await client.getFile(SUB_FILE)
  if (existing.status === 'present') {
    await client.deleteFile(SUB_FILE, existing.sha, 'push : désabonnement').catch(() => {})
  }
}
