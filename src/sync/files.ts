import { z } from 'zod'

// §3.1 — Enveloppe imposée pour tous les fichiers de données. Aucun tableau nu.
//   { "schemaVersion": 1, "records": [ … ] }
// (profile.json est l'exception : { "schemaVersion": 1, "profile": { … } })

export const SCHEMA_VERSION = 1

/** Levée quand un fichier vient d'une version plus récente de l'app (§3.1) : on
 *  refuse d'écrire pour ne pas écraser des champs inconnus. */
export class NewerSchemaError extends Error {
  constructor(public readonly found: number) {
    super(
      `Ces données viennent d'une version plus récente de l'app (schéma v${found}). Mettez l'app à jour avant de synchroniser.`,
    )
    this.name = 'NewerSchemaError'
  }
}

const recordsEnvelope = z.object({
  schemaVersion: z.number().int().positive(),
  records: z.array(z.unknown()),
})

/**
 * Valide l'enveloppe et renvoie les enregistrements bruts. Un schemaVersion
 * supérieur à celui connu du code lève NewerSchemaError (jamais d'écriture qui
 * écraserait des champs inconnus).
 */
export function parseRecordsEnvelope(text: string): unknown[] {
  const parsed = recordsEnvelope.parse(JSON.parse(text))
  if (parsed.schemaVersion > SCHEMA_VERSION) throw new NewerSchemaError(parsed.schemaVersion)
  return parsed.records
}

const profileEnvelope = z.object({
  schemaVersion: z.number().int().positive(),
  profile: z.record(z.string(), z.unknown()),
})

export function parseProfileEnvelope(text: string): unknown {
  const parsed = profileEnvelope.parse(JSON.parse(text))
  if (parsed.schemaVersion > SCHEMA_VERSION) throw new NewerSchemaError(parsed.schemaVersion)
  return parsed.profile
}

/** Tri récursif des clés, pour des diffs git lisibles (§3.1). */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k])
    }
    return out
  }
  return value
}

/** Sérialise en JSON, indentation 2 espaces et clés triées (§3.1). */
export function serializeRecordsEnvelope(records: unknown[]): string {
  return JSON.stringify(sortKeys({ records, schemaVersion: SCHEMA_VERSION }), null, 2) + '\n'
}

export function serializeProfileEnvelope(profile: unknown): string {
  return JSON.stringify(sortKeys({ profile, schemaVersion: SCHEMA_VERSION }), null, 2) + '\n'
}
