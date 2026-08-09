import { useEffect, useState } from 'react'
import type { Adjustment, Phase, LocalDate } from '../domain/types'
import type { AdjustmentAdvice } from '../domain/adjustment'
import { nowIso, addDays } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'
import { adjustPlanKcal, adjustPlanSteps } from '../domain/planEdit'
import { saveProfile } from './profile'

const FILE = 'adjustments.json'

export async function getAdjustments(): Promise<Adjustment[]> {
  const all = (await getRecordsByFile(FILE)) as Adjustment[]
  return visibleRecords(all).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

async function saveAdjustment(adj: Adjustment): Promise<void> {
  await enqueueRecord(FILE, { ...adj, updatedAt: nowIso() })
  await refreshPending()
  void sync()
}

export type ApplyMode = 'kcal' | 'steps' | 'ignore'

/**
 * §6.7 / §7.7 — Applique une recommandation : crée un Adjustment ET modifie le Plan
 * (phase en cours + suivantes), ou l'ignore. Respecte le plancher 1 800 kcal via planEdit.
 */
export async function applyAdjustment(
  advice: AdjustmentAdvice,
  mode: ApplyMode,
  phase: Phase,
  today: LocalDate,
): Promise<void> {
  let appliedKcalDelta = 0
  let appliedStepDelta = 0
  let note: string | undefined

  if (mode !== 'ignore') {
    if (mode === 'kcal' && (advice.recommendation === 'increase' || advice.recommendation === 'decrease')) {
      appliedKcalDelta = advice.kcalDelta
      await saveProfile((p) => ({ ...p, plan: adjustPlanKcal(p.plan, phase.id, advice.kcalDelta) }))
    } else if (mode === 'steps') {
      appliedStepDelta = advice.stepDelta
      await saveProfile((p) => ({ ...p, plan: adjustPlanSteps(p.plan, phase.id, advice.stepDelta) }))
    } else if (advice.recommendation === 'audit_journal') {
      // Active la pesée stricte 7 jours (aucune coupe calorique).
      await saveProfile((p) => ({ ...p, strictLoggingUntil: addDays(today, 7) }))
      note = 'Pesée stricte 7 jours activée.'
    } else if (advice.recommendation === 'diet_break') {
      note = 'Semaine à l’entretien recommandée (à suivre manuellement).'
    }
    // 'hold' appliqué = décision consciente de ne rien changer.
  }

  const adj: Adjustment = {
    id: `${today}-adj-${Math.floor(Math.random() * 1e6)}`,
    date: today,
    observedWeeklyLossKg: advice.observedWeeklyLossKg,
    weeksAnalysed: advice.weeksAnalysed,
    recommendation: advice.recommendation,
    appliedKcalDelta,
    appliedStepDelta,
    phaseId: phase.id,
    accepted: mode !== 'ignore',
    ...(note ? { note } : {}),
    updatedAt: nowIso(),
  }
  await saveAdjustment(adj)
}

export function useAdjustments(): Adjustment[] {
  const [data, setData] = useState<Adjustment[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getAdjustments().then((a) => {
        if (alive) setData(a)
      })
    }
    load()
    const off = onRecordsChanged(FILE, load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return data
}
