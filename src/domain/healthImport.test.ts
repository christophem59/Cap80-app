import { describe, it, expect } from 'vitest'
import { parseStepsCsv, aggregateDaily } from './healthImport'

const utcDate = (iso: string) => iso.slice(0, 10)

describe('parseStepsCsv', () => {
  it('ignore l\'en-tête et parse timestamp/steps/source', () => {
    const csv = 'timestamp,steps,data source\n2026-08-01T07:29:37Z,2,MobileTrack\n2026-08-01T07:30:37Z,36,MobileTrack\n'
    const rows = parseStepsCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ timestamp: '2026-08-01T07:29:37Z', steps: 2, source: 'MobileTrack' })
  })
})

describe('aggregateDaily (§9 point 3 — dédup par source)', () => {
  it('somme les incréments par jour', () => {
    const rows = parseStepsCsv(
      'timestamp,steps,data source\n2026-08-01T07:29:37Z,2,MobileTrack\n2026-08-01T09:00:00Z,36,MobileTrack\n',
    )
    expect(aggregateDaily(rows, utcDate)).toEqual([
      { date: '2026-08-01', steps: 38, source: 'MobileTrack' },
    ])
  })

  it('ne double pas : garde la source la plus élevée du jour', () => {
    // Deux sources sur les mêmes plages : MobileTrack=5000, Montre=3000 → on garde 5000.
    const rows = [
      { timestamp: '2026-08-01T08:00:00Z', steps: 5000, source: 'MobileTrack' },
      { timestamp: '2026-08-01T08:00:00Z', steps: 3000, source: 'Montre' },
    ]
    const out = aggregateDaily(rows, utcDate)
    expect(out).toEqual([{ date: '2026-08-01', steps: 5000, source: 'MobileTrack' }])
  })

  it('sépare les jours et trie', () => {
    const rows = [
      { timestamp: '2026-08-02T08:00:00Z', steps: 100, source: 'A' },
      { timestamp: '2026-08-01T08:00:00Z', steps: 200, source: 'A' },
    ]
    const out = aggregateDaily(rows, utcDate)
    expect(out.map((d) => d.date)).toEqual(['2026-08-01', '2026-08-02'])
  })
})
