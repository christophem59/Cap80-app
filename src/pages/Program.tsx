import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Phase, Plan, Profile, Sex } from '../domain/types'
import { useProfile, saveProfile } from '../repo/profile'
import { useWeights } from '../repo/weights'
import { todayLocal, calendarWeek, ageFromBirthYear } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'
import { projectTrajectory } from '../domain/projection'
import { trailingAvg } from '../domain/weight'
import { MIN_KCAL } from '../domain/adjustment'
import { tdee } from '../domain/metabolism'

const SEXE_LABELS: Record<Sex, string> = { male: 'Homme', female: 'Femme' }

function fmtKg(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function frDate(d: string): string {
  return `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

/**
 * Les données de départ, EN LECTURE SEULE.
 *
 * Elles ne servaient jusqu'ici qu'aux calculs (métabolisme, projection, ligne d'objectif)
 * sans jamais être affichées : un profil erroné pouvait donc prendre la main sans que
 * rien ne le signale — c'est exactement ce qui est arrivé après une réinstallation, et
 * seule la semaine affichée l'a trahi. Les montrer ici rend le contrôle immédiat.
 *
 * Pour les modifier, c'est « Modifier » ; pour les récupérer depuis le dépôt, c'est
 * Réglages → Profil et programme.
 */
function ProfileHeader({
  profile,
  week,
  currentWeightKg,
}: {
  profile: Profile
  week: number
  /** Moyenne mobile 7 j si elle existe, sinon null. */
  currentWeightKg: number | null
}) {
  const age = ageFromBirthYear(profile.birthYear, new Date().getFullYear())
  // La dépense est calculée au poids ACTUEL quand on le connaît : à 101 kg et à 95 kg
  // ce n'est pas le même chiffre, et c'est le chiffre du jour qui sert de repère.
  const poidsRef = currentWeightKg ?? profile.startWeightKg
  const entretien = tdee(poidsRef, {
    heightCm: profile.heightCm,
    ageYears: age,
    sex: profile.sex,
    activityFactor: profile.activityFactor,
  })

  const rows: [string, string][] = [
    ['Taille', `${profile.heightCm} cm`],
    ['Âge', `${age} ans (${profile.birthYear})`],
    ['Sexe', SEXE_LABELS[profile.sex]],
    ['Poids de départ', `${fmtKg(profile.startWeightKg)} kg`],
    ['Poids cible', `${fmtKg(profile.targetWeightKg)} kg`],
    ['Facteur d’activité', String(profile.activityFactor).replace('.', ',')],
    ['Départ', `${frDate(profile.startDate)} · S${week}`],
  ]

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Tes données de départ
      </h2>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="col-span-2 flex items-baseline justify-between gap-3">
            <dt className="text-[var(--text-muted)]">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--text-muted)]">
        Dépense estimée {currentWeightKg == null ? 'au poids de départ' : 'à ton poids actuel'}{' '}
        ({fmtKg(poidsRef)} kg) : <strong>{entretien} kcal/jour</strong>, Mifflin-St Jeor ×{' '}
        {String(profile.activityFactor).replace('.', ',')}. C’est la référence dont découlent
        les cibles des phases.
      </p>
    </section>
  )
}

function fmtWeeks(p: Phase): string {
  return p.endCalendarWeek == null
    ? `S${p.startCalendarWeek}+`
    : `S${p.startCalendarWeek}–${p.endCalendarWeek}`
}
function fmtKcal(p: Phase): string {
  if (p.ramp) return `${p.ramp.fromKcal} → ${p.ramp.toKcal} (+${p.ramp.stepPerWeek}/sem)`
  return p.targetKcal == null ? 'calibrage' : `${p.targetKcal} kcal`
}

export function Program() {
  const profile = useProfile()
  const weights = useWeights()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)

  const today = todayLocal()
  const week = calendarWeek(profile.startDate, today)
  const current = phaseForCalendarWeek(profile.plan, week)

  const trajectory = useMemo(() => {
    const startW = trailingAvg(weights, today) ?? profile.startWeightKg
    const bmr = {
      heightCm: profile.heightCm,
      ageYears: ageFromBirthYear(profile.birthYear, new Date().getFullYear()),
      sex: profile.sex,
      activityFactor: profile.activityFactor,
    }
    try {
      return projectTrajectory(startW, profile.plan, bmr, 42)
    } catch {
      return []
    }
  }, [weights, profile, today])

  if (editing) {
    return <ProgramEdit onDone={() => setEditing(false)} />
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programme</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Semaine {week} en cours{current ? ` · ${current.label}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
        >
          Modifier
        </button>
      </div>

      <ProfileHeader
        profile={profile}
        week={week}
        currentWeightKg={trailingAvg(weights, today) ?? null}
      />

      <button
        type="button"
        onClick={() => navigate('/ajustement')}
        className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm"
      >
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
        Voir l'ajustement selon ma progression
      </button>

      {/* Phases. */}
      {profile.plan.phases.map((p) => {
        const isCurrent = current?.id === p.id
        return (
          <section
            key={p.id}
            className="rounded-xl border p-4"
            style={{
              borderColor: isCurrent ? 'var(--accent)' : 'var(--border)',
              background: isCurrent
                ? 'color-mix(in srgb, var(--accent) 8%, var(--surface))'
                : 'var(--surface)',
            }}
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">
                {p.label}
                {isCurrent && (
                  <span className="ml-2 text-[10px] uppercase" style={{ color: 'var(--accent)' }}>
                    en cours · sem. {week}
                  </span>
                )}
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{fmtWeeks(p)}</span>
            </div>
            <p className="mt-1 text-sm tabular-nums">{fmtKcal(p)}</p>
            {p.proteinG != null && (
              <p className="text-xs text-[var(--text-muted)] tabular-nums">
                P {p.proteinG} / L {p.fatG} / G {p.carbsG} g · fibres ≥ {p.fiberMinG} g
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)] tabular-nums">
              {profile.plan.stepGoals[p.id] ?? '—'} pas/j · {p.workoutsPerWeek} séance
              {p.workoutsPerWeek > 1 ? 's' : ''}/sem
              {p.targetWeightAtEndKg != null && ` · jalon ${p.targetWeightAtEndKg} kg`}
            </p>
          </section>
        )
      })}

      {/* Trajectoire projetée (§6.6). Distincte du « jalon » arrondi ci-dessus. */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <h2 className="mb-1 text-sm font-semibold">Trajectoire projetée</h2>
        <p className="mb-2 text-xs text-[var(--text-muted)]">
          Projection semaine par semaine depuis ta moyenne actuelle (§6.6) — à distinguer des
          jalons arrondis des phases.
        </p>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-[var(--text-muted)]">
              <tr>
                <th className="py-1 text-left font-normal">Sem. déficit</th>
                <th className="py-1 text-left font-normal">Sem. réelle</th>
                <th className="py-1 text-right font-normal">Poids projeté</th>
              </tr>
            </thead>
            <tbody>
              {trajectory.map((pt) => (
                <tr key={pt.deficitWeek} className="border-t border-[var(--border)]">
                  <td className="py-1 tabular-nums">{pt.deficitWeek}</td>
                  <td className="py-1 tabular-nums text-[var(--text-muted)]">S{pt.calendarWeek}</td>
                  <td className="py-1 text-right tabular-nums">
                    {pt.weightKg.toFixed(1).replace('.', ',')} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

// ---- Mode édition (§7.6) ----

type DraftPhase = {
  kcal: string
  prot: string
  fat: string
  carbs: string
  steps: string
  workouts: string
  start: string
  end: string
}

function ProgramEdit({ onDone }: { onDone: () => void }) {
  const profile = useProfile()
  const weights = useWeights()
  const currentWeight = trailingAvg(weights, todayLocal()) ?? profile.startWeightKg
  const minProtein = Math.round(1.6 * currentWeight)

  const [draft, setDraft] = useState<Record<string, DraftPhase>>(() => {
    const d: Record<string, DraftPhase> = {}
    for (const p of profile.plan.phases) {
      d[p.id] = {
        kcal: p.ramp || p.targetKcal == null ? '' : String(p.targetKcal),
        prot: p.proteinG == null ? '' : String(p.proteinG),
        fat: p.fatG == null ? '' : String(p.fatG),
        carbs: p.carbsG == null ? '' : String(p.carbsG),
        steps: String(profile.plan.stepGoals[p.id] ?? ''),
        workouts: String(p.workoutsPerWeek),
        start: String(p.startCalendarWeek),
        end: p.endCalendarWeek == null ? '' : String(p.endCalendarWeek),
      }
    }
    return d
  })
  const [error, setError] = useState<string | null>(null)

  const num = (s: string): number | null => {
    const n = parseFloat(s.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const warnings = useMemo(() => {
    const w: string[] = []
    for (const p of profile.plan.phases) {
      const dr = draft[p.id]
      const kcal = num(dr.kcal)
      const prot = num(dr.prot)
      const fat = num(dr.fat)
      const carbs = num(dr.carbs)
      if (kcal != null && prot != null && fat != null && carbs != null) {
        const macroKcal = prot * 4 + carbs * 4 + fat * 9
        if (Math.abs(macroKcal - kcal) > 50)
          w.push(`${p.label} : les macros totalisent ${Math.round(macroKcal)} kcal (cible ${kcal}).`)
      }
      if (prot != null && prot < minProtein && p.targetKcal != null)
        w.push(`${p.label} : protéines sous 1,6 g/kg (${minProtein} g conseillés).`)
    }
    return w
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, minProtein])

  async function save() {
    for (const p of profile.plan.phases) {
      const kcal = num(draft[p.id].kcal)
      if (!p.ramp && p.targetKcal != null && kcal != null && kcal < MIN_KCAL) {
        setError(`${p.label} : l'apport ne peut pas descendre sous ${MIN_KCAL} kcal/j.`)
        return
      }
    }
    const stepGoals = { ...profile.plan.stepGoals }
    for (const p of profile.plan.phases) {
      const steps = num(draft[p.id].steps)
      if (steps != null) stepGoals[p.id] = steps
    }
    const plan: Plan = {
      ...profile.plan,
      stepGoals,
      phases: profile.plan.phases.map((p): Phase => {
        const dr = draft[p.id]
        return {
          ...p,
          targetKcal: p.ramp || p.targetKcal == null ? p.targetKcal : (num(dr.kcal) ?? p.targetKcal),
          proteinG: num(dr.prot) ?? p.proteinG,
          fatG: num(dr.fat) ?? p.fatG,
          carbsG: num(dr.carbs) ?? p.carbsG,
          workoutsPerWeek: num(dr.workouts) ?? p.workoutsPerWeek,
          startCalendarWeek: num(dr.start) ?? p.startCalendarWeek,
          endCalendarWeek: dr.end === '' ? null : (num(dr.end) ?? p.endCalendarWeek),
        }
      }),
    }
    await saveProfile((pr) => ({ ...pr, plan }))
    onDone()
  }

  const input = 'w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm tabular-nums'

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le programme</h1>
        <button type="button" onClick={onDone} className="text-sm text-[var(--text-muted)] underline">
          Annuler
        </button>
      </div>

      {profile.plan.phases.map((p) => {
        const dr = draft[p.id]
        const set = (k: keyof DraftPhase, v: string) =>
          setDraft((d) => ({ ...d, [p.id]: { ...d[p.id], [k]: v } }))
        return (
          <section key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <h2 className="mb-2 text-sm font-semibold">{p.label}</h2>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] text-[var(--text-muted)]">
                Sem. début
                <input className={input} inputMode="numeric" value={dr.start} onChange={(e) => set('start', e.target.value)} />
              </label>
              <label className="text-[10px] text-[var(--text-muted)]">
                Sem. fin
                <input className={input} inputMode="numeric" placeholder="∞" value={dr.end} onChange={(e) => set('end', e.target.value)} />
              </label>
              <label className="text-[10px] text-[var(--text-muted)]">
                Pas/j
                <input className={input} inputMode="numeric" value={dr.steps} onChange={(e) => set('steps', e.target.value)} />
              </label>
              {!p.ramp && p.targetKcal != null && (
                <label className="text-[10px] text-[var(--text-muted)]">
                  kcal
                  <input className={input} inputMode="numeric" value={dr.kcal} onChange={(e) => set('kcal', e.target.value)} />
                </label>
              )}
              {p.proteinG != null && (
                <>
                  <label className="text-[10px] text-[var(--text-muted)]">
                    Prot. (g)
                    <input className={input} inputMode="numeric" value={dr.prot} onChange={(e) => set('prot', e.target.value)} />
                  </label>
                  <label className="text-[10px] text-[var(--text-muted)]">
                    Lip. (g)
                    <input className={input} inputMode="numeric" value={dr.fat} onChange={(e) => set('fat', e.target.value)} />
                  </label>
                  <label className="text-[10px] text-[var(--text-muted)]">
                    Gluc. (g)
                    <input className={input} inputMode="numeric" value={dr.carbs} onChange={(e) => set('carbs', e.target.value)} />
                  </label>
                </>
              )}
              <label className="text-[10px] text-[var(--text-muted)]">
                Séances/sem
                <input className={input} inputMode="numeric" value={dr.workouts} onChange={(e) => set('workouts', e.target.value)} />
              </label>
            </div>
            {p.ramp && (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Apport progressif {p.ramp.fromKcal}→{p.ramp.toKcal} (non éditable ici).
              </p>
            )}
          </section>
        )
      })}

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-[var(--surface-2)] p-3 text-xs" style={{ color: 'var(--warn)' }}>
          {warnings.map((w, i) => (
            <li key={i}>⚠ {w}</li>
          ))}
        </ul>
      )}
      {error && (
        <p className="rounded-lg p-2 text-sm" style={{ color: 'var(--alert)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        className="w-full rounded-xl py-3 text-base font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        Enregistrer le programme
      </button>
    </section>
  )
}
