import type { SnackLog, SnackContext, LocalDate } from './types'

// Grignotage — analyses (§6 bis). Fonctions pures, testées.
//
// IMPORTANT DST : l'heure est stockée en HH:MM LOCAL au moment du tap (champ `time`),
// et le jour dans `date` (YYYY-MM-DD local). On ne convertit JAMAIS en UTC pour ces
// analyses : la carte de chaleur lit directement `time` et le jour de semaine de `date`.
// Un épisode à 2 h 30 la nuit du changement d'heure est donc compté une seule fois,
// dans son bucket, sans double comptage ni disparition.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = lundi … 6 = dimanche
/** 12 tranches de 2 h : 0 → [0h,2h[, 1 → [2h,4h[, … 11 → [22h,24h[. */
export type HourBucket = number

const alive = (l: SnackLog) => !l.deletedAt

/** Jour de semaine (lundi=0) d'une date locale, sans effet de fuseau. */
export function weekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = date.split('-').map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = dimanche
  return (((js + 6) % 7) as Weekday) // → lundi = 0
}

/** Bucket de 2 h à partir d'une heure "HH:MM". */
export function hourBucket(time: string): HourBucket {
  const h = Number(time.slice(0, 2))
  return Math.min(11, Math.max(0, Math.floor(h / 2)))
}

function daysBetween(a: LocalDate, b: LocalDate): number {
  const toNum = (s: LocalDate) => {
    const [y, m, d] = s.split('-').map(Number)
    return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  }
  return toNum(b) - toNum(a)
}

/**
 * §6 bis — Fréquence par (jour de semaine × tranche de 2 h) sur les `weeks` dernières
 * semaines. Alimente la carte de chaleur.
 */
export function snackHeatmap(
  logs: SnackLog[],
  weeks: number,
  today: LocalDate,
): Record<Weekday, Record<HourBucket, number>> {
  const out = {} as Record<Weekday, Record<HourBucket, number>>
  for (let wd = 0 as Weekday; wd <= 6; wd = (wd + 1) as Weekday) out[wd] = {}
  const horizon = weeks * 7
  for (const l of logs) {
    if (!alive(l)) continue
    const age = daysBetween(l.date, today)
    if (age < 0 || age >= horizon) continue
    const wd = weekdayOf(l.date)
    const b = hourBucket(l.time)
    out[wd][b] = (out[wd][b] ?? 0) + 1
  }
  return out
}

/**
 * §6 bis / §7.10 — Part des épisodes résolus sans manger hors zone libre (`passe` ou
 * `zone-libre`) parmi les épisodes DÉCIDÉS (outcome non nul) sur [from, to].
 * Renvoie null sous 5 épisodes décidés (chiffre trompeur sinon).
 */
export function dissipationRate(logs: SnackLog[], from: LocalDate, to: LocalDate): number | null {
  const decided = logs.filter(
    (l) => alive(l) && l.outcome != null && l.date >= from && l.date <= to,
  )
  if (decided.length < 5) return null
  const dissipated = decided.filter((l) => l.outcome === 'passe' || l.outcome === 'zone-libre')
  return dissipated.length / decided.length
}

/**
 * §6 bis — Le créneau de 2 h le plus chargé (jour de semaine × bucket), avec son
 * effectif. null sous 10 épisodes au total.
 */
export function peakWindow(
  logs: SnackLog[],
): { weekday: Weekday; hourBucket: HourBucket; count: number } | null {
  const live = logs.filter(alive)
  if (live.length < 10) return null
  const counts = new Map<string, number>()
  for (const l of live) {
    const key = `${weekdayOf(l.date)}:${hourBucket(l.time)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: { weekday: Weekday; hourBucket: HourBucket; count: number } | null = null
  for (const [key, count] of counts) {
    const [wd, b] = key.split(':').map(Number)
    if (!best || count > best.count) {
      best = { weekday: wd as Weekday, hourBucket: b, count }
    }
  }
  return best
}

/**
 * §6 bis — Déduction du contexte pour la pré-sélection du tap 1, à partir de l'heure et
 * du jour : d'abord le contexte le plus fréquent de l'historique sur le même bucket,
 * sinon une heuristique horaire.
 */
export function inferContext(at: Date, history: SnackLog[]): SnackContext {
  const b = Math.min(11, Math.floor(at.getHours() / 2))
  const sameBucket = history.filter((l) => alive(l) && hourBucket(l.time) === b)
  if (sameBucket.length > 0) {
    const counts = new Map<SnackContext, number>()
    for (const l of sameBucket) counts.set(l.context, (counts.get(l.context) ?? 0) + 1)
    let best: SnackContext = sameBucket[0].context
    for (const [ctx, n] of counts) if (n > (counts.get(best) ?? 0)) best = ctx
    return best
  }
  const h = at.getHours()
  const day = at.getDay() // 0 = dimanche
  const weekend = day === 0 || day === 6
  if (h >= 20) return 'ecran-soir'
  if (h >= 18) return 'cuisine'
  if (!weekend && h >= 9 && h < 18) return 'teletravail'
  return 'autre'
}
