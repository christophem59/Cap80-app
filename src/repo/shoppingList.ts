import { useEffect, useState } from 'react'
import type { ShoppingFreeItem, ShoppingSelection } from '../domain/shopping'
import { kvGet, kvSet } from '../db/db'
import { emitRecordsChanged, onRecordsChanged } from '../db/events'

// Sélection de recettes + articles libres + état de cochage, persistés en kv (local à
// l'appareil : la liste de courses est éphémère, pas synchronisée sur git).
const SEL_KEY = 'shoppingSelection'
const FREE_KEY = 'shoppingFreeItems'
const CHECK_KEY = 'shoppingChecked'
const EVT = 'shopping'

export async function getSelection(): Promise<ShoppingSelection[]> {
  return (await kvGet<ShoppingSelection[]>(SEL_KEY)) ?? []
}

export async function addSelection(recipeId: string, servings: number): Promise<void> {
  const list = await getSelection()
  const existing = list.find((s) => s.recipeId === recipeId)
  if (existing) existing.servings += servings
  else list.push({ recipeId, servings })
  await kvSet(SEL_KEY, list)
  emitRecordsChanged(EVT)
}

export async function setSelection(list: ShoppingSelection[]): Promise<void> {
  await kvSet(SEL_KEY, list)
  emitRecordsChanged(EVT)
}

/** Change le nombre de portions d'une recette déjà sélectionnée (min 1). */
export async function setServings(recipeId: string, servings: number): Promise<void> {
  const list = await getSelection()
  const found = list.find((s) => s.recipeId === recipeId)
  if (!found) return
  found.servings = Math.max(1, servings)
  await kvSet(SEL_KEY, list)
  emitRecordsChanged(EVT)
}

export async function clearSelection(): Promise<void> {
  await kvSet(SEL_KEY, [])
  await kvSet(FREE_KEY, [])
  await kvSet(CHECK_KEY, [])
  emitRecordsChanged(EVT)
}

// ---- Articles libres (ce qui n'est dans aucune recette : café, lait, PQ…) ----

export async function getFreeItems(): Promise<ShoppingFreeItem[]> {
  return (await kvGet<ShoppingFreeItem[]>(FREE_KEY)) ?? []
}

export async function addFreeItem(item: ShoppingFreeItem): Promise<void> {
  const list = await getFreeItems()
  list.push(item)
  await kvSet(FREE_KEY, list)
  emitRecordsChanged(EVT)
}

export async function removeFreeItem(index: number): Promise<void> {
  const list = await getFreeItems()
  list.splice(index, 1)
  await kvSet(FREE_KEY, list)
  emitRecordsChanged(EVT)
}

// ---- Cochage ----

export async function getChecked(): Promise<string[]> {
  return (await kvGet<string[]>(CHECK_KEY)) ?? []
}

export async function toggleChecked(key: string): Promise<void> {
  const set = new Set(await getChecked())
  if (set.has(key)) set.delete(key)
  else set.add(key)
  await kvSet(CHECK_KEY, [...set])
  emitRecordsChanged(EVT)
}

export async function clearChecked(): Promise<void> {
  await kvSet(CHECK_KEY, [])
  emitRecordsChanged(EVT)
}

export interface ShoppingState {
  selection: ShoppingSelection[]
  freeItems: ShoppingFreeItem[]
  checked: Set<string>
}

export function useShopping(): ShoppingState {
  const [state, setState] = useState<ShoppingState>({
    selection: [],
    freeItems: [],
    checked: new Set(),
  })
  useEffect(() => {
    let alive = true
    const load = () => {
      void Promise.all([getSelection(), getFreeItems(), getChecked()]).then(
        ([selection, freeItems, checked]) => {
          if (alive) setState({ selection, freeItems, checked: new Set(checked) })
        },
      )
    }
    load()
    const off = onRecordsChanged(EVT, load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
