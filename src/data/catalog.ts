// Chargement typé des catalogues statiques (dépôt public). Les ajouts personnels de
// l'utilisateur (custom-foods, custom-recipes) viendront du dépôt privé et seront
// fusionnés au chargement dans un lot ultérieur.
import type { Plan, Exercise, WorkoutTemplateId, Food, Recipe } from '../domain/types'
import planJson from './plan.default.json'
import exercisesJson from './exercises.json'
import foodsJson from './foods.json'
import recipesJson from './recipes.json'

export const defaultPlan = planJson as Plan

export const exercises = exercisesJson.exercises as Exercise[]

export const workoutTemplates = exercisesJson.templates as Record<
  Exclude<WorkoutTemplateId, 'custom'>,
  string[]
>

export function exerciseById(id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id)
}

// Catalogues alimentaires de base (dépôt public). Fusionnés avec les ajouts perso
// (dépôt privé) au runtime — voir repo/catalogFood.ts.
export const baseFoods = foodsJson.foods as Food[]
export const baseRecipes = recipesJson.recipes as Recipe[]
