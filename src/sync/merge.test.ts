import { describe, it, expect } from 'vitest'
import type { WeightEntry, Profile } from '../domain/types'
import { mergeRecords, visibleRecords, mergeProfile } from './merge'
import { buildDefaultProfile } from './init'

function w(id: string, kg: number, updatedAt: string, deletedAt?: string): WeightEntry {
  return { id, date: id.slice(0, 10), weightKg: kg, updatedAt, ...(deletedAt ? { deletedAt } : {}) }
}

describe('mergeRecords (§5.4)', () => {
  it('deux appareils modifient le même jour → le plus récent gagne', () => {
    const local = [w('2026-08-17-weight', 97.4, '2026-08-17T07:00:00Z')]
    const remote = [w('2026-08-17-weight', 97.9, '2026-08-17T06:00:00Z')]
    const merged = mergeRecords(local, remote)
    expect(merged).toHaveLength(1)
    expect(merged[0].weightKg).toBe(97.4) // local plus récent
  })

  it('appareil hors-ligne 3 jours qui se resynchronise → aucune perte', () => {
    const local = [
      w('2026-08-15-weight', 98, '2026-08-15T07:00:00Z'),
      w('2026-08-16-weight', 97.8, '2026-08-16T07:00:00Z'),
      w('2026-08-17-weight', 97.6, '2026-08-17T07:00:00Z'),
    ]
    const remote = [w('2026-08-14-weight', 98.2, '2026-08-14T07:00:00Z')]
    const merged = mergeRecords(local, remote)
    expect(merged.map((r) => r.id).sort()).toEqual([
      '2026-08-14-weight',
      '2026-08-15-weight',
      '2026-08-16-weight',
      '2026-08-17-weight',
    ])
  })

  it('suppression concurrente vs modification → le plus récent gagne (tombstone conservé)', () => {
    const localDeleted = [w('2026-08-17-weight', 97.4, '2026-08-17T09:00:00Z', '2026-08-17T09:00:00Z')]
    const remoteModified = [w('2026-08-17-weight', 97.9, '2026-08-17T08:00:00Z')]
    const merged = mergeRecords(localDeleted, remoteModified)
    expect(merged[0].deletedAt).toBe('2026-08-17T09:00:00Z') // la suppression, plus récente, gagne
    expect(visibleRecords(merged)).toHaveLength(0) // masqué dans l'UI mais conservé
    expect(merged).toHaveLength(1) // toujours présent dans le fichier
  })

  it('modification plus récente qu’une suppression → l’enregistrement revit', () => {
    const localModified = [w('2026-08-17-weight', 97.4, '2026-08-17T10:00:00Z')]
    const remoteDeleted = [w('2026-08-17-weight', 97.9, '2026-08-17T08:00:00Z', '2026-08-17T08:00:00Z')]
    const merged = mergeRecords(localModified, remoteDeleted)
    expect(merged[0].deletedAt).toBeUndefined()
    expect(visibleRecords(merged)).toHaveLength(1)
  })
})

describe('mergeProfile (§5.4)', () => {
  const base: Profile = {
    heightCm: 192,
    birthYear: 1992,
    sex: 'male',
    startWeightKg: 100,
    targetWeightKg: 80,
    activityFactor: 1.4,
    startDate: '2026-08-17',
    plan: { phases: [], stepGoals: {} },
    updatedAt: '2026-08-17T07:00:00Z',
  }

  it('le fichier entier le plus récent gagne, avec drapeau remoteWon', () => {
    const local = { ...base, activityFactor: 1.45, updatedAt: '2026-08-18T07:00:00Z' }
    const remote = { ...base, activityFactor: 1.5, updatedAt: '2026-08-19T07:00:00Z' }
    const r = mergeProfile(local, remote)
    expect(r.profile.activityFactor).toBe(1.5)
    expect(r.remoteWon).toBe(true)
  })

  it('profil local plus récent conservé', () => {
    const local = { ...base, updatedAt: '2026-08-20T07:00:00Z' }
    const remote = { ...base, updatedAt: '2026-08-19T07:00:00Z' }
    expect(mergeProfile(local, remote).remoteWon).toBe(false)
  })
})

describe('le profil placeholder ne masque jamais le vrai profil', () => {
  // Régression vécue : sur un appareil fraîchement installé, buildDefaultProfile()
  // horodatait à `nowIso()`. Le placeholder était donc plus RÉCENT que le profil du
  // dépôt, la fusion le gardait, l'app affichait l'écran de démarrage et le programme
  // réel finissait écrasé à la première poussée. Le placeholder est daté de l'époque.
  it('un profil distant, même ancien, gagne contre le placeholder', () => {
    const placeholder = buildDefaultProfile()
    const reel: Profile = {
      ...placeholder,
      startDate: '2026-08-24',
      onboarded: true,
      updatedAt: '2026-08-17T19:43:15.613Z',
    }
    const r = mergeProfile(placeholder, reel)
    expect(r.remoteWon).toBe(true)
    expect(r.profile.startDate).toBe('2026-08-24')
    expect(r.profile.onboarded).toBe(true)
  })

  it('le placeholder est daté de l’époque, jamais de maintenant', () => {
    expect(buildDefaultProfile().updatedAt).toBe('1970-01-01T00:00:00.000Z')
    expect(new Date(buildDefaultProfile().updatedAt).getTime()).toBe(0)
  })

  it('mais un profil local RÉEL n’est pas écrasé par un profil distant plus ancien', () => {
    const local: Profile = { ...buildDefaultProfile(), updatedAt: '2026-08-28T09:00:00.000Z' }
    const remote: Profile = { ...buildDefaultProfile(), updatedAt: '2026-08-17T19:43:15.613Z' }
    expect(mergeProfile(local, remote).remoteWon).toBe(false)
  })
})
