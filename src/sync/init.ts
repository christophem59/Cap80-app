import type { Profile } from '../domain/types'
import { defaultPlan } from '../data/catalog'
import { todayLocal } from '../domain/dates'
import { serializeProfileEnvelope, serializeRecordsEnvelope } from './files'
import { utf8ToBase64 } from './base64'
import type { GitHubClient } from './github'

// Fichiers de données créés vides à l'initialisation (§3 / §5.2).
const EMPTY_RECORD_FILES = [
  'weights.json',
  'measurements.json',
  'steps.json',
  'workouts.json',
  'adjustments.json',
  'custom-foods.json',
  'custom-recipes.json',
]

/**
 * Horodatage du profil PLACEHOLDER. Volontairement l'époque, et non `nowIso()`.
 *
 * §5.4 résout les conflits de profile.json par « le fichier le plus récent gagne ». Or
 * ce placeholder est construit au CHARGEMENT DU MODULE : avec `nowIso()`, un appareil
 * fraîchement installé se retrouvait avec un profil daté de maintenant, donc plus récent
 * que le vrai profil du dépôt — qui n'était alors JAMAIS appliqué. L'app affichait
 * l'écran de démarrage, l'utilisateur ressaisissait tout, et son programme réel se
 * faisait écraser à la première poussée.
 *
 * Avec l'époque, n'importe quel profil distant réel gagne, ce qui est le seul
 * comportement correct : un placeholder n'a rien à défendre.
 */
export const PLACEHOLDER_UPDATED_AT = '1970-01-01T00:00:00.000Z'

/**
 * Profil par défaut GÉNÉRIQUE (placeholder). Aucune donnée personnelle en dur : ce
 * dépôt est public (§1.2). Les vraies valeurs de l'utilisateur sont saisies dans l'app,
 * stockées sur l'appareil et dans le dépôt PRIVÉ (profile.json), puis tirées au
 * démarrage via le fine-grained token — elles remplacent ce placeholder.
 */
export function buildDefaultProfile(): Profile {
  return {
    heightCm: 175,
    birthYear: 1990,
    sex: 'male',
    startWeightKg: 90,
    targetWeightKg: 80,
    activityFactor: 1.4,
    startDate: todayLocal(),
    plan: defaultPlan,
    onboarded: false,
    updatedAt: PLACEHOLDER_UPDATED_AT,
  }
}

export interface InitReport {
  created: string[]
  skipped: string[]
}

/**
 * §5.2 — Initialise le dépôt de données. Sur un dépôt sans aucun commit, le premier
 * PUT (profile.json, sans sha) produit le commit initial ; les fichiers suivants sont
 * ensuite créés sans sha (ils n'existent pas). Idempotent : un fichier déjà présent
 * est laissé tel quel.
 */
export async function initializeDataRepo(
  client: GitHubClient,
  profile: Profile = buildDefaultProfile(),
): Promise<InitReport> {
  const report: InitReport = { created: [], skipped: [] }

  // 1) profile.json en premier — crée le commit initial si le dépôt est vide.
  const prof = await client.getFile('profile.json')
  if (prof.status === 'present') {
    report.skipped.push('profile.json')
  } else {
    await client.putFile(
      'profile.json',
      utf8ToBase64(serializeProfileEnvelope(profile)),
      'init : profile.json',
    )
    report.created.push('profile.json')
  }

  // 2) Fichiers d'enregistrements vides.
  const emptyBody = utf8ToBase64(serializeRecordsEnvelope([]))
  for (const file of EMPTY_RECORD_FILES) {
    const existing = await client.getFile(file)
    if (existing.status === 'present') {
      report.skipped.push(file)
    } else {
      await client.putFile(file, emptyBody, `init : ${file}`)
      report.created.push(file)
    }
  }

  return report
}
