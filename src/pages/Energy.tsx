import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BmrProfile } from '../domain/types'
import { useProfile, setActivityFactor, setTargetDeficit, setWeekOverride } from '../repo/profile'
import { useWeights } from '../repo/weights'
import { useMealsInRange } from '../repo/meals'
import { saveProfile } from '../repo/profile'
import { todayLocal, addDays, calendarWeek, ageFromBirthYear } from '../domain/dates'
import { phaseForCalendarWeek } from '../domain/plan'
import { setPhaseTargets } from '../domain/planEdit'
import { buildWeekEnergyRows, MIN_WEIGH_INS } from '../domain/weekEnergy'
import type { WeekEnergyRow } from '../domain/weekEnergy'
import {
  observedEnergy,
  energyAlerts,
  energyTargets,
  proposeActivityFactor,
  proposePlanTargets,
  DEFAULT_TARGET_DEFICIT_KCAL,
  MIN_OBSERVATION_WEEKS,
  FACTOR_STEP,
} from '../domain/energy'
import { projectAtConstantIntake, weeksToReach } from '../domain/projection'

// §6.9 — L'écran du modèle énergétique.
//
// Il existe pour une raison précise : pendant trois semaines, la dépense théorique a
// sous-estimé la dépense réelle de ~400 kcal/jour sans que rien ne le signale. Tout ce
// qui est affiché ici sert à rendre cet écart VISIBLE — théorique et observé côte à côte,
// avec le facteur d'activité que l'observation impliquerait.

const fr1 = (n: number) => n.toFixed(1).replace('.', ',')
const fr2 = (n: number) => n.toFixed(2).replace('.', ',')
const kcal = (n: number) => `${Math.round(n)} kcal`

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Line({
  label,
  value,
  strong,
  hint,
}: {
  label: string
  value: string
  strong?: boolean
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-[var(--text-muted)]">
        {label}
        {hint && <span className="block text-[10px] leading-tight">{hint}</span>}
      </span>
      <span className={`text-right tabular-nums ${strong ? 'text-lg font-semibold' : 'text-sm'}`}>
        {value}
      </span>
    </div>
  )
}

const btn = 'rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium'
const input =
  'w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm tabular-nums'

export function Energy() {
  const navigate = useNavigate()
  const profile = useProfile()
  const weights = useWeights()
  const today = todayLocal()

  // Fenêtre de repas assez large pour couvrir tout le programme écoulé, plafonnée à un
  // an : au-delà, le modèle d'il y a douze mois ne dit plus rien du modèle d'aujourd'hui.
  const rangeStart = useMemo(() => {
    const oneYearAgo = addDays(today, -365)
    return profile.startDate > oneYearAgo ? profile.startDate : oneYearAgo
  }, [profile.startDate, today])
  const meals = useMealsInRange(rangeStart, today)

  const bmrProfile: BmrProfile = useMemo(
    () => ({
      heightCm: profile.heightCm,
      ageYears: ageFromBirthYear(profile.birthYear, new Date().getFullYear()),
      sex: profile.sex,
      activityFactor: profile.activityFactor,
    }),
    [profile],
  )

  const rows = useMemo(
    () => buildWeekEnergyRows(weights, meals, profile.startDate, profile.weekOverrides ?? []),
    [weights, meals, profile.startDate, profile.weekOverrides],
  )

  const observed = useMemo(() => observedEnergy(rows, bmrProfile), [rows, bmrProfile])

  // Poids de référence : la dernière moyenne hebdomadaire. C'est elle qui pilote tout —
  // le BMR se recalcule à chaque nouvelle moyenne, jamais une fois pour toutes.
  const refWeight = rows.length ? rows[rows.length - 1].avgWeightKg : profile.startWeightKg
  const refWeek = rows.length ? rows[rows.length - 1].week : null
  const deficit = profile.targetDeficitKcal ?? DEFAULT_TARGET_DEFICIT_KCAL
  const targets = useMemo(
    () => energyTargets(refWeight, bmrProfile, deficit),
    [refWeight, bmrProfile, deficit],
  )

  const alerts = useMemo(
    () => (observed ? energyAlerts(observed, profile.activityFactor) : []),
    [observed, profile.activityFactor],
  )
  const proposal = observed
    ? proposeActivityFactor(profile.activityFactor, observed.activityFactor)
    : null

  const week = calendarWeek(profile.startDate, today)
  const phase = phaseForCalendarWeek(profile.plan, week)
  const proposals = useMemo(
    () =>
      phase
        ? proposePlanTargets(profile.plan.phases, phase.id, refWeight, bmrProfile, deficit)
        : [],
    [profile.plan.phases, phase, refWeight, bmrProfile, deficit],
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Énergie</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Ce que le modèle prévoit, et ce que la balance dit vraiment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/programme')}
          className="text-sm text-[var(--text-muted)] underline"
        >
          Programme
        </button>
      </div>

      {alerts.length > 0 && (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.kind}
              className="rounded-xl border p-3 text-sm leading-relaxed"
              style={{
                borderColor: 'var(--warn)',
                background: 'color-mix(in srgb, var(--warn) 8%, var(--surface))',
              }}
            >
              {a.message}
            </li>
          ))}
        </ul>
      )}

      <ModelCard
        profile={profile}
        targets={targets}
        refWeight={refWeight}
        refWeek={refWeek}
        observedFactor={observed?.activityFactor}
        observedWeeks={observed?.weeks}
        proposal={proposal}
        today={today}
      />

      <ObservedCard observed={observed} theoreticalTdee={targets.tdeeKcal} />

      <TargetsCard targets={targets} deficit={deficit} />

      <PlanCard
        proposals={proposals}
        onApply={async () => {
          await saveProfile((p) => ({
            ...p,
            plan: proposals.reduce(
              (plan, pr) =>
                setPhaseTargets(plan, pr.phaseId, {
                  kcal: pr.targets.intakeKcal,
                  proteinG: pr.targets.proteinG,
                  fatG: pr.targets.fatG,
                  carbsG: pr.targets.carbsG,
                  fiberMinG: pr.targets.fiberMinG,
                }),
              p.plan,
            ),
          }))
        }}
      />

      <ProjectionCard
        startWeightKg={refWeight}
        intakeKcal={targets.intakeKcal}
        bmrProfile={bmrProfile}
        targetWeightKg={profile.targetWeightKg}
      />

      <WeeksCard rows={rows} />

      <HistoryCard profile={profile} />
    </section>
  )
}

// ---- Le modèle en place, et son seul paramètre libre ----

function ModelCard({
  profile,
  targets,
  refWeight,
  refWeek,
  observedFactor,
  observedWeeks,
  proposal,
  today,
}: {
  profile: ReturnType<typeof useProfile>
  targets: ReturnType<typeof energyTargets>
  refWeight: number
  refWeek: number | null
  observedFactor?: number
  observedWeeks?: number
  proposal: number | null
  today: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(profile.activityFactor))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save(next: number, why: string, observed?: number) {
    const n = Math.round(next * 100) / 100
    if (!Number.isFinite(n) || n < 1.1 || n > 2.2) {
      setError('Un facteur d’activité plausible se situe entre 1,1 et 2,2.')
      return
    }
    if (!why.trim()) {
      setError('Dis pourquoi tu le changes : dans six mois, c’est la seule chose qui restera.')
      return
    }
    setError(null)
    await setActivityFactor(n, { date: today, reason: why, observedFactor: observed })
    setEditing(false)
    setReason('')
  }

  return (
    <Card
      title="Le modèle en place"
      subtitle={`Mifflin-St Jeor recalculé à ${fr1(refWeight)} kg${refWeek ? ` (moyenne S${refWeek})` : ' (poids de départ)'}, puis multiplié par le facteur d’activité.`}
    >
      <Line label="Métabolisme de base" value={kcal(targets.bmrKcal)} />
      <Line
        label="Facteur d’activité"
        value={fr2(profile.activityFactor)}
        hint="le seul paramètre réglable du modèle"
      />
      <Line label="Dépense théorique" value={kcal(targets.tdeeKcal)} strong />

      {proposal != null && observedFactor != null && (
        <button
          type="button"
          onClick={() =>
            void save(
              proposal,
              `Recalage sur ${observedWeeks ?? MIN_OBSERVATION_WEEKS} semaines d’observation : facteur observé ${fr2(observedFactor)}.`,
              observedFactor,
            )
          }
          className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Recaler le facteur à {fr2(proposal)}
        </button>
      )}
      {proposal != null && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
          On ne va pas jusqu’au facteur observé : trois semaines restent trois semaines. La
          proposition parcourt 80 % de l’écart, et se réévalue à chaque nouvelle moyenne.
        </p>
      )}

      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[10px] text-[var(--text-muted)]">
            Facteur
            <input
              className={input}
              inputMode="decimal"
              step={FACTOR_STEP}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label className="block text-[10px] text-[var(--text-muted)]">
            Pourquoi ce changement
            <input
              className={input}
              value={reason}
              placeholder="ex. reprise du vélo, ou perte trop lente sur 4 semaines"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error && (
            <p className="text-xs" style={{ color: 'var(--alert)' }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => void save(parseFloat(value.replace(',', '.')), reason)}
            >
              Enregistrer
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${btn} mt-3`} onClick={() => setEditing(true)}>
          Changer le facteur à la main
        </button>
      )}
    </Card>
  )
}

// ---- La confrontation aux faits ----

function ObservedCard({
  observed,
  theoreticalTdee,
}: {
  observed: ReturnType<typeof observedEnergy>
  theoreticalTdee: number
}) {
  if (!observed) {
    return (
      <Card title="Ce que la balance dit">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          Il faut <strong>{MIN_OBSERVATION_WEEKS} semaines consécutives</strong> avec un poids
          moyen ET un apport saisi pour mesurer la dépense réelle. Sur une seule semaine, le
          calcul donne n’importe quoi — de la rétention d’eau prise pour de la graisse.
        </p>
      </Card>
    )
  }

  const gap = observed.tdeeKcal - theoreticalTdee
  return (
    <Card
      title="Ce que la balance dit"
      subtitle={`S${observed.firstWeek} → S${observed.lastWeek} · ${observed.days} jours · apport moyen ${kcal(observed.avgIntakeKcal)}${observed.estimated ? ' (partiellement estimé)' : ''}`}
    >
      <Line
        label="Poids"
        value={`${fr1(observed.fromWeightKg)} → ${fr1(observed.toWeightKg)} kg`}
      />
      <Line
        label="Perte hebdomadaire"
        value={`${Math.round(observed.weeklyLossKg * 1000)} g · ${fr2(observed.weeklyLossPct)} %`}
      />
      <div className="my-2 border-t border-[var(--border)]" />
      <Line label="Dépense théorique" value={kcal(theoreticalTdee)} />
      <Line label="Dépense observée" value={kcal(observed.tdeeKcal)} strong />
      <Line
        label="Écart"
        value={`${gap >= 0 ? '+' : '−'}${Math.abs(Math.round(gap))} kcal/jour`}
      />
      <Line label="Facteur d’activité impliqué" value={fr2(observed.activityFactor)} />
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Dépense observée = apport moyen + (perte × 7 700 / jours). L’apport retenu est celui
        des semaines pendant lesquelles le poids a bougé, donc toutes sauf la première.
      </p>
    </Card>
  )
}

// ---- Les cibles, qui découlent de tout ce qui précède ----

function TargetsCard({
  targets,
  deficit,
}: {
  targets: ReturnType<typeof energyTargets>
  deficit: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(deficit))

  return (
    <Card
      title="Cibles calculées"
      subtitle="Poids → métabolisme → dépense → apport → macros. Aucune de ces valeurs n’est saisie à la main."
    >
      <Line label="Déficit visé" value={`${deficit} kcal/jour`} />
      <Line label="Apport cible" value={kcal(targets.intakeKcal)} strong />
      <Line
        label="Déficit réel"
        value={`${Math.round(targets.deficitKcal)} kcal/jour`}
        hint="après arrondi de l’apport à 50 kcal"
      />
      <Line
        label="Perte attendue"
        value={`${Math.round(targets.expectedWeeklyLossKg * 1000)} g/semaine`}
      />
      {targets.floored && (
        <p className="mt-1 text-xs" style={{ color: 'var(--warn)' }}>
          Plancher de 1 800 kcal atteint : le déficit demandé n’est pas applicable en entier.
        </p>
      )}

      <div className="my-2 border-t border-[var(--border)]" />
      <Line
        label="Protéines"
        value={`${targets.proteinG} g`}
        hint={`${fr2(targets.proteinG / targets.weightKg)} g/kg · plancher ${targets.proteinFloorG} g`}
      />
      <Line
        label="Lipides"
        value={`${targets.fatG} g`}
        hint={`${fr2(targets.fatG / targets.weightKg)} g/kg · plancher dur ${targets.fatFloorG} g`}
      />
      <Line label="Glucides" value={`${targets.carbsG} g`} hint="le solde de l’apport" />
      <Line label="Fibres" value={`≥ ${targets.fiberMinG} g`} />

      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="block text-[10px] text-[var(--text-muted)]">
            Déficit quotidien visé (kcal)
            <input
              className={input}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => {
                const n = parseInt(draft, 10)
                if (Number.isFinite(n) && n >= 0 && n <= 1200) {
                  void setTargetDeficit(n).then(() => setEditing(false))
                }
              }}
            >
              Enregistrer
            </button>
            <button type="button" className={btn} onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${btn} mt-3`} onClick={() => setEditing(true)}>
          Changer le déficit visé
        </button>
      )}
    </Card>
  )
}

// ---- Le programme dérivé du modèle ----

function PlanCard({
  proposals,
  onApply,
}: {
  proposals: ReturnType<typeof proposePlanTargets>
  onApply: () => Promise<void>
}) {
  const [msg, setMsg] = useState<string | null>(null)
  if (proposals.length === 0) return null
  const changed = proposals.filter((p) => p.changed)

  return (
    <Card
      title="Les phases à venir"
      subtitle="Chaque phase recalculée au poids qu’elle verra vraiment. Sans ça, recaler le facteur laisserait les phases suivantes sur les cibles de l’ancien modèle — un déficit bien plus creux que voulu."
    >
      <table className="w-full text-sm">
        <thead className="text-xs text-[var(--text-muted)]">
          <tr>
            <th className="py-1 text-left font-normal">Phase</th>
            <th className="py-1 text-right font-normal">Poids projeté</th>
            <th className="py-1 text-right font-normal">Actuel</th>
            <th className="py-1 text-right font-normal">Calculé</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => (
            <tr key={p.phaseId} className="border-t border-[var(--border)]">
              <td className="py-1 pr-2">{p.label}</td>
              <td className="py-1 text-right tabular-nums text-[var(--text-muted)]">
                {fr1(p.weightKg)} kg
              </td>
              <td className="py-1 text-right tabular-nums text-[var(--text-muted)]">
                {p.currentKcal}
              </td>
              <td
                className="py-1 text-right font-medium tabular-nums"
                style={p.changed ? { color: 'var(--accent)' } : undefined}
              >
                {p.targets.intakeKcal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {changed.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--ok)' }}>
          Le programme est déjà aligné sur le modèle.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void onApply().then(() => setMsg('Programme recalculé.'))}
            className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Écrire ces cibles dans le programme
          </button>
          {msg && (
            <p className="mt-2 text-xs" style={{ color: 'var(--ok)' }}>
              {msg}
            </p>
          )}
        </>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Les phases déjà passées ne sont pas touchées : ce sont des faits. Une phase à rampe
        (stabilisation) garde la sienne, et arrête le calcul.
      </p>
    </Card>
  )
}

// ---- La trajectoire, qui ralentit ----

function ProjectionCard({
  startWeightKg,
  intakeKcal,
  bmrProfile,
  targetWeightKg,
}: {
  startWeightKg: number
  intakeKcal: number
  bmrProfile: BmrProfile
  targetWeightKg: number
}) {
  const points = useMemo(
    () => projectAtConstantIntake(startWeightKg, intakeKcal, bmrProfile, 104),
    [startWeightKg, intakeKcal, bmrProfile],
  )
  const reach = weeksToReach(points, targetWeightKg)
  const shown = points.filter((p) => p.week % 4 === 0 && p.week <= (reach ?? 52) + 4)

  return (
    <Card
      title="Si tu restes à cet apport"
      subtitle={`À ${intakeKcal} kcal constants. La perte ralentit toute seule : le poids baisse, donc le métabolisme baisse, donc le déficit se réduit.`}
    >
      {reach != null ? (
        <p className="mb-3 text-sm">
          <strong>{fr1(targetWeightKg)} kg atteints en {reach} semaines</strong>
          {', soit environ '}
          {Math.round((reach / 52) * 12)} mois.
        </p>
      ) : (
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          {fr1(targetWeightKg)} kg n’est pas atteint en deux ans à cet apport.
        </p>
      )}
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-[var(--text-muted)]">
            <tr>
              <th className="py-1 text-left font-normal">Sem.</th>
              <th className="py-1 text-right font-normal">Poids</th>
              <th className="py-1 text-right font-normal">Dépense</th>
              <th className="py-1 text-right font-normal">Déficit</th>
              <th className="py-1 text-right font-normal">Perte</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.week} className="border-t border-[var(--border)]">
                <td className="py-1 tabular-nums text-[var(--text-muted)]">{p.week}</td>
                <td className="py-1 text-right tabular-nums">{fr1(p.weightKg)} kg</td>
                <td className="py-1 text-right tabular-nums">{p.tdeeKcal}</td>
                <td className="py-1 text-right tabular-nums">{Math.round(p.deficitKcal)}</td>
                <td className="py-1 text-right tabular-nums">
                  {Math.round(p.lossKg * 1000)} g
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
        Une trajectoire théorique, pas une promesse. Elle se recalcule à chaque nouvelle
        moyenne hebdomadaire, avec le facteur du moment.
      </p>
    </Card>
  )
}

// ---- Les semaines observées, corrigeables ----

function WeeksCard({ rows }: { rows: WeekEnergyRow[] }) {
  const [editWeek, setEditWeek] = useState<number | null>(null)
  const recent = rows.slice(-12).reverse()

  return (
    <Card
      title="Semaines observées"
      subtitle="La matière première du calcul. Corrige un apport quand la saisie ne reflète pas la réalité — un forfait restaurant, par exemple."
    >
      {recent.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Aucune semaine pesée pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {recent.map((r) => (
            <li key={r.week} className="py-2">
              <button
                type="button"
                onClick={() => setEditWeek(editWeek === r.week ? null : r.week)}
                className="flex w-full items-baseline justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-sm">Semaine {r.week}</span>
                  <span className="block text-xs text-[var(--text-muted)]">
                    {r.weighIns} pesée{r.weighIns > 1 ? 's' : ''}
                    {r.weighIns < MIN_WEIGH_INS && ' ⚠'} · {r.loggedDays} j saisis
                    {r.overridden && ' · corrigé'}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {fr1(r.avgWeightKg)} kg ·{' '}
                  {r.avgIntakeKcal == null ? '—' : `${Math.round(r.avgIntakeKcal)} kcal`}
                  {r.estimated && r.avgIntakeKcal != null && ' ≈'}
                </span>
              </button>
              {editWeek === r.week && <WeekOverrideForm row={r} onDone={() => setEditWeek(null)} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function WeekOverrideForm({ row, onDone }: { row: WeekEnergyRow; onDone: () => void }) {
  const [intake, setIntake] = useState(
    row.avgIntakeKcal == null ? '' : String(Math.round(row.avgIntakeKcal)),
  )
  const [weight, setWeight] = useState(fr1(row.avgWeightKg))
  const [estimated, setEstimated] = useState(row.estimated ?? false)
  const [note, setNote] = useState(row.note ?? '')

  const num = (s: string): number | undefined => {
    const n = parseFloat(s.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-[var(--surface-2)] p-3">
      <p className="text-[10px] leading-tight text-[var(--text-muted)]">
        Calculé par l’app : {row.computedWeightKg == null ? '—' : `${fr1(row.computedWeightKg)} kg`} ·{' '}
        {row.computedIntakeKcal == null ? 'aucun repas saisi' : `${Math.round(row.computedIntakeKcal)} kcal`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-[var(--text-muted)]">
          Poids moyen (kg)
          <input className={input} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Apport moyen (kcal)
          <input className={input} inputMode="numeric" value={intake} onChange={(e) => setIntake(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <input type="checkbox" checked={estimated} onChange={(e) => setEstimated(e.target.checked)} />
        Apport estimé, pas mesuré
      </label>
      <label className="block text-[10px] text-[var(--text-muted)]">
        Note
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={() =>
            void setWeekOverride(row.week, {
              ...(num(weight) != null ? { avgWeightKg: num(weight) } : {}),
              ...(num(intake) != null ? { avgIntakeKcal: num(intake) } : {}),
              estimated,
              ...(note.trim() ? { note: note.trim() } : {}),
            }).then(onDone)
          }
        >
          Enregistrer
        </button>
        {row.overridden && (
          <button
            type="button"
            className={btn}
            onClick={() => void setWeekOverride(row.week, null).then(onDone)}
          >
            Rendre au calcul
          </button>
        )}
        <button type="button" className={btn} onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  )
}

// ---- La trajectoire du modèle lui-même ----

function HistoryCard({ profile }: { profile: ReturnType<typeof useProfile> }) {
  const history = profile.activityFactorHistory ?? []
  if (history.length === 0) return null
  return (
    <Card
      title="Historique du facteur"
      subtitle="Chaque recalage, daté et motivé. C’est la seule façon de relire la trajectoire du modèle dans six mois."
    >
      <ul className="space-y-2">
        {[...history].reverse().map((c, i) => (
          <li key={`${c.date}-${i}`} className="text-sm">
            <p className="tabular-nums">
              <span className="text-[var(--text-muted)]">
                {c.date.slice(8)}/{c.date.slice(5, 7)}
              </span>{' '}
              · {fr2(c.from)} → <strong>{fr2(c.to)}</strong>
              {c.observedFactor != null && (
                <span className="text-[var(--text-muted)]">
                  {' '}
                  (observé {fr2(c.observedFactor)})
                </span>
              )}
            </p>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">{c.reason}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
