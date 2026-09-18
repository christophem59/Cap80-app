import type { BmrProfile, Phase } from './types'
import { bmr, tdee } from './metabolism'
import { KCAL_PER_KG } from './projection'
import { MIN_KCAL } from './adjustment'

// §6.9 — Le modèle énergétique OBSERVÉ.
//
// Le §6.2 calcule une dépense THÉORIQUE (Mifflin × facteur d'activité). Cette théorie
// se trompe : sur les trois premières semaines de déficit, elle a sous-estimé la dépense
// réelle d'environ 400 kcal/jour, systématiquement. Rien dans l'app ne le signalait,
// parce que rien ne confrontait jamais le modèle aux faits.
//
// Ce module fait cette confrontation. Il ne remplace pas le §6.2 : il le mesure, et
// propose de corriger le SEUL paramètre libre du modèle — le facteur d'activité.

/** Déficit quotidien visé par défaut. L'apport cible en découle, il n'est jamais saisi. */
export const DEFAULT_TARGET_DEFICIT_KCAL = 600

/** Cibles macro par kg de poids corporel, et leurs planchers durs. */
export const PROTEIN_G_PER_KG = 1.95
export const PROTEIN_FLOOR_G_PER_KG = 1.6
export const FAT_G_PER_KG = 0.83
export const FAT_FLOOR_G_PER_KG = 0.7
export const FIBER_MIN_G = 30

/** Fenêtre minimale d'observation. Une semaine isolée donne des valeurs absurdes :
 *  sur les données de septembre 2026, la S2 impliquait un TDEE de 3930 et la S3 de 2390.
 *  Aucune des deux n'est exploitable — c'est la moyenne longue qui fait sens. */
export const MIN_OBSERVATION_WEEKS = 3

/** Au-delà de cet écart entre facteur observé et facteur en place, on propose un
 *  réajustement (§6.9 garde-fous). */
export const DRIFT_THRESHOLD = 0.1

/** On ne va pas jusqu'au facteur observé : trois semaines restent trois semaines, et
 *  on réévalue chaque vendredi. 0,8 amortit sans traîner (1,40 → 1,55 sur un observé
 *  à 1,60 : exactement l'arbitrage rendu le 18/09/2026). */
export const FACTOR_DAMPING = 0.8

/** Granularité d'un facteur d'activité affiché ou proposé. */
export const FACTOR_STEP = 0.05

/** Seuils de vitesse, en % du poids corporel par semaine (§6.9 garde-fous). */
export const LOSS_FAST_PCT = 1.0
export const LOSS_SLOW_PCT = 0.3

const round = (x: number, step: number) => Math.round(x / step) * step

/** Une semaine telle qu'on l'a vécue : le poids moyen constaté, et ce qui a été mangé. */
export interface WeekObservation {
  week: number
  avgWeightKg: number
  /** null quand aucun jour de la semaine n'a été saisi. */
  avgIntakeKcal: number | null
  /** true quand l'apport est une estimation (forfait restaurant, jours incomplets). */
  estimated?: boolean
}

export interface ObservedEnergy {
  /** Semaines de la fenêtre effectivement retenues. */
  weeks: number
  /** Durée réelle sur laquelle le poids a bougé : (weeks − 1) × 7. */
  days: number
  firstWeek: number
  lastWeek: number
  /** Poids au début et à la fin de la fenêtre (moyennes hebdomadaires). */
  fromWeightKg: number
  toWeightKg: number
  /** Positive quand le poids baisse. */
  lossKg: number
  /** Apport moyen des semaines PENDANT lesquelles le poids a bougé. */
  avgIntakeKcal: number
  tdeeKcal: number
  /** TDEE observé rapporté au métabolisme de base du poids d'arrivée. */
  activityFactor: number
  bmrKcal: number
  weeklyLossKg: number
  /** Perte hebdomadaire en % du poids d'arrivée. */
  weeklyLossPct: number
  /** true si au moins une semaine retenue porte un apport estimé. */
  estimated: boolean
}

/**
 * §6.9 — Dépense réellement observée.
 *
 *   TDEE_observé = apport_moyen + (perte_kg × 7700 / jours)
 *
 * L'apport retenu est celui des semaines PENDANT lesquelles le poids a bougé, donc
 * toutes sauf la première : ce qui a été mangé avant la première pesée moyenne n'explique
 * pas la variation qui la suit.
 *
 * Renvoie null tant que `minWeeks` semaines consécutives portant un apport ne sont pas
 * disponibles — refus dur, jamais d'estimation sur une semaine isolée.
 */
export function observedEnergy(
  observations: WeekObservation[],
  profile: BmrProfile,
  minWeeks = MIN_OBSERVATION_WEEKS,
): ObservedEnergy | null {
  // Fenêtre glissante : la plus longue série de semaines consécutives, terminant à la
  // dernière observation, dont l'apport est connu.
  const sorted = [...observations].sort((a, b) => a.week - b.week)
  const window: WeekObservation[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const o = sorted[i]
    if (o.avgIntakeKcal == null) break
    if (window.length && window[0].week !== o.week + 1) break
    window.unshift(o)
  }
  if (window.length < minWeeks) return null

  const first = window[0]
  const last = window[window.length - 1]
  const days = (window.length - 1) * 7
  if (days <= 0) return null

  const lossKg = first.avgWeightKg - last.avgWeightKg
  const during = window.slice(1)
  const avgIntakeKcal =
    during.reduce((s, o) => s + (o.avgIntakeKcal ?? 0), 0) / during.length
  const tdeeKcal = avgIntakeKcal + (lossKg * KCAL_PER_KG) / days
  const bmrKcal = bmr(last.avgWeightKg, profile.heightCm, profile.ageYears, profile.sex)
  const weeklyLossKg = (lossKg * 7) / days

  return {
    weeks: window.length,
    days,
    firstWeek: first.week,
    lastWeek: last.week,
    fromWeightKg: first.avgWeightKg,
    toWeightKg: last.avgWeightKg,
    lossKg,
    avgIntakeKcal,
    tdeeKcal,
    activityFactor: tdeeKcal / bmrKcal,
    bmrKcal,
    weeklyLossKg,
    weeklyLossPct: (weeklyLossKg / last.avgWeightKg) * 100,
    estimated: during.some((o) => o.estimated),
  }
}

/**
 * Facteur d'activité à proposer face à un facteur observé. On ne recopie pas
 * l'observation : on se déplace de `FACTOR_DAMPING` de l'écart, arrondi à 0,05.
 * null quand l'écart ne dépasse pas le seuil de dérive — le modèle tient, on n'y touche pas.
 */
export function proposeActivityFactor(current: number, observed: number): number | null {
  if (Math.abs(observed - current) <= DRIFT_THRESHOLD) return null
  const damped = current + FACTOR_DAMPING * (observed - current)
  const proposed = round(damped, FACTOR_STEP)
  if (Math.abs(proposed - current) < FACTOR_STEP / 2) return null
  return Math.round(proposed * 100) / 100
}

export type EnergyAlertKind = 'loss_too_fast' | 'loss_too_slow' | 'model_drift'

export interface EnergyAlert {
  kind: EnergyAlertKind
  severity: 'warn' | 'info'
  message: string
}

/**
 * §6.9 — Garde-fous. Trois signaux, tous calculés sur la même fenêtre d'au moins
 * 3 semaines : perte trop rapide (masse maigre en jeu), perte trop lente (facteur trop
 * haut), dérive du modèle (le facteur en place ne décrit plus la réalité).
 */
export function energyAlerts(
  observed: ObservedEnergy,
  currentFactor: number,
): EnergyAlert[] {
  const alerts: EnergyAlert[] = []
  const pct = observed.weeklyLossPct
  const grams = Math.round(observed.weeklyLossKg * 1000)

  if (pct > LOSS_FAST_PCT) {
    alerts.push({
      kind: 'loss_too_fast',
      severity: 'warn',
      message: `Perte de ${grams} g/semaine, soit ${pct.toFixed(2).replace('.', ',')} % du poids corporel : au-delà de ${LOSS_FAST_PCT} %, le risque de perdre de la masse maigre devient réel. Remonte l’apport.`,
    })
  } else if (pct < LOSS_SLOW_PCT) {
    alerts.push({
      kind: 'loss_too_slow',
      severity: 'warn',
      message: `Perte de ${grams} g/semaine, soit ${pct.toFixed(2).replace('.', ',')} % du poids corporel, sur ${observed.weeks} semaines : sous ${LOSS_SLOW_PCT} %, c’est le signe que le facteur d’activité est trop haut.`,
    })
  }

  const gap = observed.activityFactor - currentFactor
  if (Math.abs(gap) > DRIFT_THRESHOLD) {
    alerts.push({
      kind: 'model_drift',
      severity: 'warn',
      message: `Le facteur observé (${observed.activityFactor.toFixed(2).replace('.', ',')}) s’écarte de ${Math.abs(gap).toFixed(2).replace('.', ',')} du facteur en place (${currentFactor.toFixed(2).replace('.', ',')}) sur ${observed.weeks} semaines. Le modèle ${gap > 0 ? 'sous-estime' : 'surestime'} ta dépense d’environ ${Math.abs(Math.round(gap * observed.bmrKcal))} kcal/jour.`,
    })
  }

  return alerts
}

export interface EnergyTargets {
  weightKg: number
  bmrKcal: number
  activityFactor: number
  tdeeKcal: number
  /** Déficit demandé, avant arrondi de l'apport. */
  requestedDeficitKcal: number
  /** Apport cible : TDEE − déficit, arrondi à 50 kcal, plancher 1 800 (§6.7). */
  intakeKcal: number
  /** Déficit réellement obtenu après arrondi. */
  deficitKcal: number
  expectedWeeklyLossKg: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberMinG: number
  proteinFloorG: number
  fatFloorG: number
  /** true si le plancher de 1 800 kcal a bridé la cible. */
  floored: boolean
}

/**
 * §6.9 — Les cibles DÉCOULENT du modèle : poids → BMR → TDEE → apport → macros.
 * Aucune de ces valeurs n'est saisie à la main ; le seul paramètre libre en amont est
 * le facteur d'activité, et le seul arbitrage est le déficit visé.
 *
 * Le plancher lipidique de 0,7 g/kg est une contrainte dure (production hormonale) ;
 * la cible est posée plus haut, à 0,83, pour garder de la marge. Les glucides sont le
 * solde : ils absorbent toute la variation de l'apport.
 */
export function energyTargets(
  weightKg: number,
  profile: BmrProfile,
  requestedDeficitKcal: number = DEFAULT_TARGET_DEFICIT_KCAL,
): EnergyTargets {
  const bmrKcal = bmr(weightKg, profile.heightCm, profile.ageYears, profile.sex)
  const tdeeKcal = tdee(weightKg, profile)
  const raw = round(tdeeKcal - requestedDeficitKcal, 50)
  const floored = raw < MIN_KCAL
  const intakeKcal = floored ? MIN_KCAL : raw
  const deficitKcal = tdeeKcal - intakeKcal

  const proteinFloorG = Math.round(PROTEIN_FLOOR_G_PER_KG * weightKg)
  const fatFloorG = Math.round(FAT_FLOOR_G_PER_KG * weightKg)
  const proteinG = Math.max(round(PROTEIN_G_PER_KG * weightKg, 5), proteinFloorG)
  const fatG = Math.max(round(FAT_G_PER_KG * weightKg, 5), fatFloorG)
  const carbsG = Math.max(0, Math.round((intakeKcal - proteinG * 4 - fatG * 9) / 4))

  return {
    weightKg,
    bmrKcal,
    activityFactor: profile.activityFactor,
    tdeeKcal,
    requestedDeficitKcal,
    intakeKcal,
    deficitKcal,
    expectedWeeklyLossKg: (deficitKcal * 7) / KCAL_PER_KG,
    proteinG,
    fatG,
    carbsG,
    fiberMinG: FIBER_MIN_G,
    proteinFloorG,
    fatFloorG,
    floored,
  }
}

/** Ce que le modèle propose pour une phase, et le poids auquel il l'a calculé. */
export interface PhaseTargetProposal {
  phaseId: string
  label: string
  /** Poids projeté au début de la phase. */
  weightKg: number
  targets: EnergyTargets
  /** Cible actuellement inscrite dans la phase. */
  currentKcal: number
  changed: boolean
}

/**
 * §6.9 — Dérive les cibles de TOUTES les phases à venir, pas seulement de la phase en cours.
 *
 * Sans cela, recaler le facteur produit une incohérence silencieuse : la phase en cours
 * passe à 2 500 kcal pendant que les suivantes gardent les 2 150 et 2 100 saisis sous
 * l'ancien modèle — un déficit de 1 000 kcal qui n'a jamais été voulu, et une trajectoire
 * projetée qui plonge sous le poids cible.
 *
 * On avance phase par phase en projetant le poids, et on recalcule la cible de chacune au
 * poids qu'elle verra vraiment. Les phases d'entretien visent la dépense elle-même ; une
 * phase à rampe ou de calibrage n'a pas de cible chiffrée et arrête le parcours.
 * Les phases déjà passées ne sont pas touchées : ce sont des faits.
 */
export function proposePlanTargets(
  phases: Phase[],
  fromPhaseId: string,
  startWeightKg: number,
  profile: BmrProfile,
  deficitKcal: number = DEFAULT_TARGET_DEFICIT_KCAL,
): PhaseTargetProposal[] {
  const ordered = [...phases].sort((a, b) => a.startCalendarWeek - b.startCalendarWeek)
  const from = ordered.findIndex((p) => p.id === fromPhaseId)
  if (from < 0) return []

  const out: PhaseTargetProposal[] = []
  let weightKg = startWeightKg

  for (const phase of ordered.slice(from)) {
    if (phase.ramp || phase.targetKcal == null) break
    const isMaintenance = phase.kind === 'maintenance'
    const targets = energyTargets(weightKg, profile, isMaintenance ? 0 : deficitKcal)
    out.push({
      phaseId: phase.id,
      label: phase.label,
      weightKg,
      targets,
      currentKcal: phase.targetKcal,
      changed: phase.targetKcal !== targets.intakeKcal,
    })

    // Projection jusqu'au début de la phase suivante, à l'apport qu'on vient de fixer.
    if (phase.endCalendarWeek == null) break
    const weeks = phase.endCalendarWeek - phase.startCalendarWeek + 1
    for (let i = 0; i < weeks; i++) {
      const deficit = tdee(weightKg, profile) - targets.intakeKcal
      weightKg = weightKg - (deficit * 7) / KCAL_PER_KG
    }
  }
  return out
}
