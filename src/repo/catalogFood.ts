import { useEffect, useState } from 'react'
import type { Food, Recipe } from '../domain/types'
import { baseFoods, baseRecipes } from '../data/catalog'
import { kvGet } from '../db/db'
import { onRecordsChanged } from '../db/events'

// Catalogues effectifs = base publique + ajouts perso (dépôt privé), les entrées perso
// écrasant celles de la base à identifiant égal (§4). Prévu pour l'enrichissement futur
// (édition de custom-foods.json / custom-recipes.json, ou ajout in-app).

const CUSTOM_FOODS_FILE = 'custom-foods.json'
const CUSTOM_RECIPES_FILE = 'custom-recipes.json'

function mergeById<T extends { id: string }>(base: T[], custom: T[]): T[] {
  const byId = new Map(base.map((x) => [x.id, x]))
  for (const c of custom) byId.set(c.id, c) // le perso écrase la base
  return [...byId.values()]
}

export async function getFoods(): Promise<Food[]> {
  const custom = (await kvGet<Food[]>('customFoods')) ?? []
  return mergeById(baseFoods, custom)
}

export async function getRecipes(): Promise<Recipe[]> {
  const custom = (await kvGet<Recipe[]>('customRecipes')) ?? []
  return mergeById(baseRecipes, custom)
}

export async function getFoodsById(): Promise<Map<string, Food>> {
  return new Map((await getFoods()).map((f) => [f.id, f]))
}

function useMerged<T>(load: () => Promise<T>, file: string): T | undefined {
  const [data, setData] = useState<T>()
  useEffect(() => {
    let alive = true
    const run = () => {
      void load().then((d) => {
        if (alive) setData(d)
      })
    }
    run()
    const off = onRecordsChanged(file, run)
    return () => {
      alive = false
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return data
}

export function useFoods(): Food[] {
  return useMerged(getFoods, CUSTOM_FOODS_FILE) ?? baseFoods
}

export function useRecipes(): Recipe[] {
  return useMerged(getRecipes, CUSTOM_RECIPES_FILE) ?? baseRecipes
}
