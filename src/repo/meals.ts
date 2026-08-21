import { useEffect, useState } from 'react'
import type { MealLog, MealItem, MealSlot, LocalDate } from '../domain/types'
import { nowIso, addDays } from '../domain/dates'
import { getRecordsByFile } from '../db/db'
import { onRecordsChanged } from '../db/events'
import { enqueueRecord } from '../db/outboxStore'
import { visibleRecords } from '../sync/merge'
import { refreshPending, sync } from '../sync/manager'

export const SLOTS: MealSlot[] = ['petit-dej', 'dejeuner', 'collation', 'diner', 'extra']
export const SLOT_LABELS: Record<MealSlot, string> = {
  'petit-dej': 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  collation: 'Collation',
  diner: 'Dîner',
  extra: 'Extra',
}

/** Repas partitionnés par mois (§3) : meals/YYYY-MM.json. */
export function mealFile(date: LocalDate): string {
  return `meals/${date.slice(0, 7)}.json`
}
const mealId = (date: LocalDate, slot: MealSlot) => `${date}-${slot}`

async function slotLog(date: LocalDate, slot: MealSlot): Promise<MealLog | undefined> {
  const all = (await getRecordsByFile(mealFile(date))) as MealLog[]
  return all.find((m) => m.id === mealId(date, slot) && !m.deletedAt)
}

/** Repas du jour (un MealLog par créneau présent), visibles. */
export async function getDayMeals(date: LocalDate): Promise<MealLog[]> {
  const all = (await getRecordsByFile(mealFile(date))) as MealLog[]
  return visibleRecords(all).filter((m) => m.date === date)
}

async function saveSlot(
  date: LocalDate,
  slot: MealSlot,
  items: MealItem[],
  extra?: { fromRecipeId?: string; note?: string },
): Promise<void> {
  const existing = await slotLog(date, slot)
  const log: MealLog = {
    ...existing,
    id: mealId(date, slot),
    date,
    slot,
    items,
    ...(extra?.fromRecipeId ? { fromRecipeId: extra.fromRecipeId } : {}),
    ...(extra?.note ? { note: extra.note } : {}),
    updatedAt: nowIso(),
  }
  await enqueueRecord(mealFile(date), log)
  await refreshPending()
  void sync()
}

/** Ajoute un item à un créneau (crée le MealLog du créneau si besoin). */
export async function addMealItem(
  date: LocalDate,
  slot: MealSlot,
  item: MealItem,
  fromRecipeId?: string,
): Promise<void> {
  const existing = await slotLog(date, slot)
  await saveSlot(date, slot, [...(existing?.items ?? []), item], { fromRecipeId })
}

/** Remplace tous les items d'un créneau (duplication d'un repas, suppression d'item). */
export async function setSlotItems(
  date: LocalDate,
  slot: MealSlot,
  items: MealItem[],
  fromRecipeId?: string,
): Promise<void> {
  await saveSlot(date, slot, items, { fromRecipeId })
}

export async function removeMealItem(
  date: LocalDate,
  slot: MealSlot,
  index: number,
): Promise<void> {
  const existing = await slotLog(date, slot)
  if (!existing) return
  const items = existing.items.filter((_, i) => i !== index)
  await saveSlot(date, slot, items)
}

/**
 * §7.3 — Repas récents d'un créneau, pour « refaire un repas d'hier / de la semaine
 * dernière ». Cherche dans le mois courant et le précédent, hors date du jour.
 */
export async function getRecentMealsForSlot(
  today: LocalDate,
  slot: MealSlot,
  limit = 5,
): Promise<MealLog[]> {
  const months = [...new Set([mealFile(today), mealFile(addDays(today, -31))])]
  const rows: MealLog[] = []
  for (const file of months) rows.push(...((await getRecordsByFile(file)) as MealLog[]))
  return visibleRecords(rows)
    .filter((m) => m.slot === slot && m.date !== today && m.items.length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
}

/** Repas visibles entre deux dates incluses (au plus 2 fichiers mensuels). */
export async function getMealsInRange(start: LocalDate, end: LocalDate): Promise<MealLog[]> {
  const files = [...new Set([mealFile(start), mealFile(end)])]
  const rows: MealLog[] = []
  for (const f of files) rows.push(...((await getRecordsByFile(f)) as MealLog[]))
  return visibleRecords(rows).filter((m) => m.date >= start && m.date <= end)
}

export function useMealsInRange(start: LocalDate, end: LocalDate): MealLog[] {
  const [data, setData] = useState<MealLog[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getMealsInRange(start, end).then((m) => {
        if (alive) setData(m)
      })
    }
    load()
    const files = [...new Set([mealFile(start), mealFile(end)])]
    const offs = files.map((f) => onRecordsChanged(f, load))
    return () => {
      alive = false
      offs.forEach((off) => off())
    }
  }, [start, end])
  return data
}

export function useDayMeals(date: LocalDate): MealLog[] {
  const [data, setData] = useState<MealLog[]>([])
  useEffect(() => {
    let alive = true
    const load = () => {
      void getDayMeals(date).then((m) => {
        if (alive) setData(m)
      })
    }
    load()
    const off = onRecordsChanged(mealFile(date), load)
    return () => {
      alive = false
      off()
    }
  }, [date])
  return data
}
