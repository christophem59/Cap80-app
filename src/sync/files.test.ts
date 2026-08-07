import { describe, it, expect } from 'vitest'
import {
  parseRecordsEnvelope,
  serializeRecordsEnvelope,
  NewerSchemaError,
} from './files'

describe('enveloppe de fichier (§3.1)', () => {
  it('parse et renvoie les enregistrements', () => {
    const text = JSON.stringify({ schemaVersion: 1, records: [{ id: 'a' }, { id: 'b' }] })
    expect(parseRecordsEnvelope(text)).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('refuse un schemaVersion plus récent que le code', () => {
    const text = JSON.stringify({ schemaVersion: 99, records: [] })
    expect(() => parseRecordsEnvelope(text)).toThrow(NewerSchemaError)
  })

  it('rejette un tableau nu ou une enveloppe invalide', () => {
    expect(() => parseRecordsEnvelope('[]')).toThrow()
    expect(() => parseRecordsEnvelope('{"records":[]}')).toThrow()
  })

  it('sérialise avec clés triées et indentation 2 espaces (diffs git lisibles)', () => {
    const out = serializeRecordsEnvelope([{ weightKg: 97.4, date: '2026-08-17', id: 'x' }])
    // schemaVersion avant records (tri alphabétique), et clés de record triées.
    expect(out).toBe(
      `{
  "records": [
    {
      "date": "2026-08-17",
      "id": "x",
      "weightKg": 97.4
    }
  ],
  "schemaVersion": 1
}
`,
    )
  })
})
