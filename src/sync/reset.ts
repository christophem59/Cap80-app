import { GitHubClient } from './github'
import { getRepoConfig, getToken, isConfigured } from './config'
import { serializeRecordsEnvelope, serializeProfileEnvelope } from './files'
import { utf8ToBase64 } from './base64'
import { clearAllLocal } from '../db/db'
import { setProfileLocal } from '../repo/profile'
import type { Profile } from '../domain/types'

// Réinitialisation « repartir de zéro ». Vide les données de SUIVI (local + dépôt
// privé) et réécrit profile.json, en CONSERVANT la config de synchro (dépôt + token,
// stockés en localStorage) et les catalogues perso (custom-foods/-recipes, qui sont
// des données de référence, pas du suivi).

/** Fichiers d'enregistrements « plats » à remettre à une enveloppe vide. */
const RECORD_FILES = [
  'weights.json',
  'measurements.json',
  'steps.json',
  'workouts.json',
  'adjustments.json',
]

/** Dossiers dont tout le contenu est supprimé (repas, grignotage, photos, boîte pas). */
const DIRS = ['meals', 'snacks', 'photos', 'steps-inbox']

function getClient(): GitHubClient | null {
  const cfg = getRepoConfig()
  const token = getToken()
  if (!cfg || !token) return null
  return new GitHubClient({ ...cfg, token })
}

/** Écrit une enveloppe d'enregistrements vide (crée le fichier s'il n'existe pas). */
async function putEmptyRecords(client: GitHubClient, file: string): Promise<void> {
  const body = utf8ToBase64(serializeRecordsEnvelope([]))
  const cur = await client.getFile(file)
  if (cur.status === 'present') {
    await client.putFile(file, body, `reset : ${file}`, cur.sha)
  } else {
    await client.putFile(file, body, `reset : ${file}`)
  }
}

/**
 * Vide les données de suivi du dépôt privé et y réécrit `profile`. Nécessite d'être
 * en ligne (sinon lève). Ne touche pas à custom-foods.json / custom-recipes.json.
 */
export async function wipeRemoteData(profile: Profile): Promise<void> {
  const client = getClient()
  if (!client) return // pas de synchro configurée : rien à vider côté distant.
  if (!navigator.onLine) {
    throw new Error('Connexion requise pour vider le dépôt privé. Reconnecte-toi et réessaie.')
  }

  // 1) Fichiers d'enregistrements → enveloppe vide.
  for (const file of RECORD_FILES) {
    await putEmptyRecords(client, file)
  }

  // 2) Dossiers → suppression de chaque fichier listé (repas, snacks, photos, pas).
  for (const dir of DIRS) {
    const entries = await client.listDir(dir)
    for (const entry of entries) {
      await client.deleteFile(entry.path, entry.sha, `reset : ${entry.path}`)
    }
  }

  // 3) Index photos remis à vide (recréé après la suppression du dossier).
  await putEmptyRecords(client, 'photos/index.json')

  // 4) profile.json réécrit avec le profil fourni.
  const prof = await client.getFile('profile.json')
  const profBody = utf8ToBase64(serializeProfileEnvelope(profile))
  if (prof.status === 'present') {
    await client.putFile('profile.json', profBody, 'reset : profile.json', prof.sha)
  } else {
    await client.putFile('profile.json', profBody, 'reset : profile.json')
  }
}

/**
 * Reset complet : vide le dépôt privé (si configuré et en ligne), efface tout le
 * local, puis réinstalle `profile` en local. Le rechargement est laissé à l'appelant.
 * La config de synchro (dépôt + token) est conservée.
 */
export async function hardReset(profile: Profile): Promise<void> {
  if (isConfigured()) {
    await wipeRemoteData(profile) // lève si hors-ligne : on n'efface pas le local à tort.
  }
  await clearAllLocal()
  await setProfileLocal(profile)
}
