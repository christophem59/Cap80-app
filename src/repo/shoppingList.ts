import { useEffect, useState } from 'react'
import type { ShoppingSelection } from '../domain/shopping'
import { kvGet, kvSet } from '../db/db'
import { emitRecordsChanged, onRecordsChanged } from '../db/events'

// Sélection de recettes pour la liste de courses + état de cochage, persistés en kv
// (local à l'appareil : la liste de courses est éphémère, pas synchronisée sur git).
const SEL_KEY = 'shoppingSelection'
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

export async function clearSelection(): Promise<void> {
  await kvSet(SEL_KEY, [])
  await kvSet(CHECK_KEY, [])
  emitRecordsChanged(EVT)
}

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

export function useShopping(): { selection: ShoppingSelection[]; checked: Set<string> } {
  const [state, setState] = useState<{ selection: ShoppingSelection[]; checked: Set<string> }>({
    selection: [],
    checked: new Set(),
  })
  useEffect(() => {
    let alive = true
    const load = () => {
      void Promise.all([getSelection(), getChecked()]).then(([selection, checked]) => {
        if (alive) setState({ selection, checked: new Set(checked) })
      })
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
