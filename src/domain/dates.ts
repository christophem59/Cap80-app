import type { LocalDate } from './types'

// Les dates métier sont des LocalDate (YYYY-MM-DD) sans notion d'heure ni de fuseau.
// Pour compter des jours sans être piégé par les changements d'heure (DST), on
// convertit chaque date en un numéro de jour via Date.UTC : l'UTC n'a pas de DST,
// donc la différence de deux numéros de jour est toujours exacte.

/** Numéro de jour absolu (jours depuis l'époque) pour une LocalDate. */
export function toDayNumber(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000)
}

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return toDayNumber(b) - toDayNumber(a)
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Ajoute `n` jours (n peut être négatif) et renvoie une LocalDate. */
export function addDays(d: LocalDate, n: number): LocalDate {
  const dt = new Date((toDayNumber(d) + n) * 86_400_000)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/**
 * §6.3 — Semaine de programme.
 * calendarWeek = floor(daysBetween(startDate, date) / 7) + 1.
 * Semaine 1 = les 7 premiers jours à partir de startDate. Le calibrage porte la
 * semaine 0 (les 7 jours précédant startDate). Gère les semaines nulles ou négatives
 * sans planter.
 */
export function calendarWeek(startDate: LocalDate, date: LocalDate): number {
  return Math.floor(daysBetween(startDate, date) / 7) + 1
}

/** Âge en années à partir de l'année de naissance. */
export function ageFromBirthYear(birthYear: number, atYear: number): number {
  return atYear - birthYear
}

/** Date locale d'aujourd'hui (jamais UTC : la journée métier est locale, §4). */
export function todayLocal(): LocalDate {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Horodatage ISO 8601 en UTC, pour la résolution de conflits (§4, updatedAt). */
export function nowIso(): string {
  return new Date().toISOString()
}
