// Modèle de données — §4 du cahier des charges. Ces types sont contractuels :
// le format des fichiers JSON du dépôt privé en découle directement.

/** Identifiant : ULID (ordonnable dans le temps) ou `${isoDate}-${slug}` quand
 *  l'unicité par jour suffit. */
export type Id = string

/** Date locale, format YYYY-MM-DD. Jamais d'UTC pour les dates métier : une pesée
 *  du matin appartient au jour où l'utilisateur l'a faite, quel que soit son fuseau. */
export type LocalDate = string

/** Horodatage ISO 8601 complet, en UTC, pour la résolution de conflits uniquement. */
export type Timestamp = string

/** Base commune à TOUT enregistrement synchronisé. `deletedAt` est le tombstone
 *  (§5.4) : un enregistrement supprimé reste dans le fichier, masqué dans l'interface. */
export interface SyncedRecord {
  id: Id
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

export type Sex = 'male' | 'female'

export interface Profile {
  heightCm: number
  birthYear: number
  sex: Sex
  startWeightKg: number
  targetWeightKg: number
  activityFactor: number // 1.40 par défaut, éditable
  startDate: LocalDate // fixe la semaine 1
  plan: Plan
  /** Mode « pesée stricte 7 jours » déclenché par la règle audit_journal (§6.7). */
  strictLoggingUntil?: LocalDate
  /** Passé à true quand l'utilisateur a validé l'écran de démarrage (onboarding).
   *  Tant que faux/absent, l'app affiche l'onboarding au lieu des écrans de suivi. */
  onboarded?: boolean
  updatedAt: Timestamp
}

/** Le programme. Modifiable par l'utilisateur : c'est le point 7 du besoin. */
export interface Plan {
  phases: Phase[]
  /** Objectif de pas par phase, indexé par phase.id */
  stepGoals: Record<string, number>
}

export type PhaseKind =
  | 'calibration'
  | 'deficit'
  | 'maintenance'
  | 'stabilisation'

export interface Phase {
  id: string // 'p0' | 'p1' | 'break1' | 'p2' | 'break2' | 'p3' | 'p4'
  label: string // 'Phase 1 — Lancement'
  /** Bornes en SEMAINES CALENDAIRES (pauses incluses), incluses. null = phase ouverte (§6.6). */
  startCalendarWeek: number
  endCalendarWeek: number | null
  kind: PhaseKind
  /** null en phase de calibrage : pas de cible. Ignoré si `ramp` est présent. */
  targetKcal: number | null
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
  fiberMinG: number
  /** Montée progressive de l'apport, semaine par semaine (stabilisation). Prend le pas
   *  sur targetKcal : l'apport de la semaine N de la phase vaut
   *  min(toKcal, fromKcal + stepPerWeek * (N - 1)). */
  ramp?: { fromKcal: number; toKcal: number; stepPerWeek: number }
  /** Jalon ARRONDI, à visée d'affichage uniquement. La projection du §6.6 est la seule
   *  référence testée : ne jamais comparer les deux dans un test. */
  targetWeightAtEndKg: number | null
  /** Nombre de séances de renforcement attendues par semaine. */
  workoutsPerWeek: number
  notes: string
}

export type WeightFlag =
  | 'repas_sale'
  | 'alcool'
  | 'mauvais_sommeil'
  | 'seance_veille'
  | 'constipation'
  | 'maladie'

export interface WeightEntry extends SyncedRecord {
  id: Id // `${date}-weight`
  date: LocalDate
  weightKg: number // 1 décimale
  /** Contexte utile à l'interprétation d'un pic. Facultatif. */
  flags?: WeightFlag[]
  note?: string
}

export interface BodyMeasurement extends SyncedRecord {
  id: Id // `${date}-body`
  date: LocalDate
  waistCm?: number // au nombril, debout, fin d'expiration — hebdo
  neckCm?: number
  chestCm?: number
  armCm?: number // bras dominant contracté
  thighCm?: number
  hipCm?: number
}

export type PhotoAngle = 'face' | 'profil' | 'dos'

export interface PhotoEntry extends SyncedRecord {
  id: Id // `${date}-${angle}`
  date: LocalDate
  angle: PhotoAngle
  /** Chemin dans le dépôt privé. */
  path: string
  widthPx: number
  heightPx: number
  bytes: number
  weightKgAtDate: number | null // dénormalisé pour l'affichage comparatif
}

export type WorkoutTemplateId = 'A' | 'B' | 'custom'

export interface WorkoutSession extends SyncedRecord {
  id: Id
  date: LocalDate
  templateId: WorkoutTemplateId
  /** Durée réelle en minutes, facultative. */
  durationMin?: number
  perceivedEffort?: 1 | 2 | 3 | 4 | 5
  entries: WorkoutEntry[]
  completed: boolean // true quand toutes les séries prévues sont saisies ou passées
  note?: string
}

export interface WorkoutEntry {
  exerciseId: string // référence le catalogue d'exercices (§8.2)
  sets: { reps: number; weightKg: number | null; skipped?: boolean }[]
}

export interface StepEntry extends SyncedRecord {
  id: Id // `${date}-steps`
  date: LocalDate
  steps: number
  source: 'manual' | 'shortcut' | 'health-import'
}

export type MealSlot =
  | 'petit-dej'
  | 'dejeuner'
  | 'collation'
  | 'diner'
  | 'extra'

export interface MealLog extends SyncedRecord {
  id: Id
  date: LocalDate
  slot: MealSlot
  items: MealItem[]
  /** Renseigné quand le repas vient d'une recette du catalogue, pour la traçabilité. */
  fromRecipeId?: string
  note?: string
}

export interface MealItem {
  /** Référence au catalogue d'aliments (§8.3), ou saisie libre. */
  foodId?: string
  label: string // toujours rempli, même si foodId existe (résilience)
  grams: number | null // null si l'item est saisi directement en macros
  kcal: number // valeurs finales retenues, déjà calculées
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
}

/** L'état interne déclaré au moment d'une envie (§4 bis). */
export type SnackTrigger =
  | 'ennui'
  | 'faim'
  | 'stress'
  | 'fatigue'
  | 'social'
  | 'habitude'
  | 'envie'
/** Le contexte physique (§4 bis). */
export type SnackContext =
  | 'bureau'
  | 'teletravail'
  | 'ecran-soir'
  | 'cuisine'
  | 'transport'
  | 'autre'

/**
 * Épisode d'envie (§4 bis / §7.9). Outil d'OBSERVATION : n'alimente PAS les totaux
 * caloriques du jour. Si l'utilisateur veut compter ce qu'il a mangé, il crée un MealLog
 * `extra` distinct.
 */
export interface SnackLog extends SyncedRecord {
  id: Id
  date: LocalDate
  /** Heure locale HH:MM au moment du 1er tap. Donnée la plus précieuse du modèle. */
  time: string
  trigger: SnackTrigger
  context: SnackContext
  /** null = l'envie est passée sans choix explicite (règle des 10 min, §7.9). */
  outcome: 'mange' | 'zone-libre' | 'passe' | null
  foodLabel?: string
  estimatedKcal?: number
  note?: string
}

export type Recommendation =
  | 'increase'
  | 'hold'
  | 'decrease'
  | 'diet_break'
  | 'audit_journal'

export interface Adjustment extends SyncedRecord {
  id: Id
  date: LocalDate
  /** Ce que la règle a mesuré au moment de la décision. */
  observedWeeklyLossKg: number
  weeksAnalysed: number
  recommendation: Recommendation
  /** Ce qui a effectivement été appliqué. */
  appliedKcalDelta: number
  appliedStepDelta: number
  phaseId: string
  accepted: boolean // false si l'utilisateur a lu la reco et ne l'a pas suivie
  note?: string
}

// ---- Catalogues (dépôt public, statiques, versionnés avec le code) ----

export type FoodCategory =
  | 'proteines'
  | 'laitiers'
  | 'legumes'
  | 'feculents'
  | 'fruits'
  | 'gras'
  | 'epices'
  | 'boissons'
  | 'autre'

export interface Macros {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
  fiberG: number
}

/** État dans lequel l'aliment est pesé (les grammes s'expriment dans cet état). */
export type FoodState = 'cru' | 'cuit' | 'tel-quel'

export interface Food {
  id: string // 'poulet-blanc-cru'
  label: string // 'Blanc de poulet, cru'
  category: FoodCategory
  /** État de pesée. 'cru'/'cuit' : le libellé le mentionne ; 'tel-quel' : sans cuisson
   *  pertinente (laitiers, poudres, conserves, pain, plats…). Les grammes d'une recette
   *  sont TOUJOURS dans cet état, sans conversion implicite. */
  state: FoodState
  /** Toutes les valeurs pour 100 g du produit tel que pesé, dans l'état `state`. */
  per100g: Macros
  /** Portions usuelles, pour saisir en 1 tap. */
  servings?: { label: string; grams: number }[]
  /** Uniquement si `state: 'cru'`. poids cuit = poids cru × cookedFactor
   *  (0,7 poulet qui rend de l'eau ; 2,8 riz qui en absorbe). Informatif. */
  cookedFactor?: number
  barcode?: string
}

export interface Recipe {
  id: string
  label: string
  slot: ('petit-dej' | 'dejeuner' | 'collation' | 'diner')[]
  servings: number // nombre de portions produites
  prepMin: number
  cookMin: number
  batchFriendly: boolean // préparable à l'avance : picto 🍲 dans l'onglet Recettes
  ingredients: { foodId: string; grams: number }[]
  /** Poids total obtenu APRÈS cuisson, quand il a été mesuré. Permet d'afficher
   *  « 1 portion ≈ N g cuits ». Facultatif. */
  cookedYieldG?: number
  steps: string[] // instructions, une par étape
  /** Calculé à partir des ingrédients, jamais saisi à la main. */
  tags?: string[]
}

// ---- Planning de la semaine (bundle injecté, cf. docs/injection-repas.md) ----

/** Un repas planifié : une recette, OU un aliment simple, OU une estimation libre. */
export interface PlannedMeal {
  slot: MealSlot
  recipeId?: string
  /** Nombre de portions de la recette (défaut 1, décimales acceptées). */
  portions?: number
  foodId?: string
  grams?: number
  /** Repas non décomposé (restaurant) : macros estimées, figées telles quelles. */
  estimated?: { kcal: number; proteinG: number }
  /** 'HH:MM' — ordre d'affichage et repères (ex. shaker pré-restaurant). */
  time?: string
  note?: string
}

export interface PlannedDay {
  label: string // Lundi … Dimanche
  isRestaurantDay?: boolean
  /** Plusieurs entrées peuvent partager le même créneau (2 collations, dîner + extra). */
  meals: PlannedMeal[]
}

export type ExercisePattern =
  | 'squat'
  | 'charniere'
  | 'poussee-horizontale'
  | 'poussee-verticale'
  | 'tirage-horizontal'
  | 'tirage-vertical'
  | 'fente'
  | 'gainage'

export type Equipment = 'aucun' | 'halteres' | 'elastique' | 'tapis'

export interface Exercise {
  id: string // 'squat-gobelet'
  label: string
  pattern: ExercisePattern
  equipment: Equipment[]
  defaultSets: number
  repRange: [number, number] // [8, 12]
  /** Pour le gainage : durée au lieu de répétitions. */
  unit: 'reps' | 'seconds'
  cues: string[] // 2 à 4 points d'exécution
}

/** Profil réduit nécessaire aux calculs métaboliques (§6.1/§6.2). */
export interface BmrProfile {
  heightCm: number
  ageYears: number
  sex: Sex
  activityFactor: number
}
