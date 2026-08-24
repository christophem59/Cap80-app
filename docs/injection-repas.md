# Cap80 — injection recettes & semaine (format v2)

Chaque semaine : tu prépares le contenu **avec Cowork**, tu me pousses le **bundle JSON**
produit, je le passe au validateur (`node scripts/validate-bundle.mjs <fichier>`) et,
s'il est accepté, je l'applique aux fichiers publics
(`src/data/foods.json`, `recipes.json`, `week.default.json`) en **un seul commit**.

> **Le validateur refuse tout bundle incohérent.** Il n'y a pas de « importer quand même ».
> Si un écart est signalé, c'est le bundle qu'il faut corriger.

---

## 1. Le bundle

```jsonc
{
  "foods":   [ /* aliments à ajouter/remplacer — optionnel */ ],
  "recipes": [ /* recettes à ajouter/remplacer — optionnel */ ],
  "week":    { "days": [ /* les 7 jours — optionnel */ ] },
  "expectedTotals": { /* OBLIGATOIRE dès que `week` est présent */ }
}
```

Règles d'application :
- **`foods`** / **`recipes`** : fusion **par `id`** (id connu = remplacé, nouvel id = ajouté).
- **`week`** : **remplacement complet** du planning.
- **Idempotence** : réappliquer un bundle identique ne réécrit rien.

---

## 2. `foods` — aliments

À n'inclure que si l'aliment **manque**. Valeurs **pour 100 g dans l'état déclaré**.

```jsonc
{
  "id": "haricots-verts-crus",
  "label": "Haricots verts, crus",
  "category": "legumes",          // legumes|fruits|proteines|laitiers|feculents|gras|epices|boissons|autre
  "state": "cru",                 // OBLIGATOIRE : cru | cuit | tel-quel
  "per100g": { "kcal": 31, "proteinG": 1.8, "fatG": 0.1, "carbsG": 5, "fiberG": 3.2 },
  "cookedFactor": 0.9,            // UNIQUEMENT si state = "cru" ; poids cuit = poids cru × facteur
  "servings": [{ "label": "1 portion (150 g)", "grams": 150 }]   // optionnel
}
```

- **`cru`** : pesé avant cuisson — le libellé doit contenir « cru/crue/crus/crues ».
- **`cuit`** : pesé après cuisson — le libellé doit contenir « cuit/cuite/cuits/cuites ».
- **`tel-quel`** : pas de cuisson en jeu (laitiers, poudres, pain, conserves, huiles, fruits frais, plats).
- `cookedFactor` est **interdit** sur `cuit` et `tel-quel`.
- **Pas de marques**, ni dans `id` ni dans `label`.

---

## 3. `recipes` — recettes

Les macros **ne sont jamais stockées** : l'app les recalcule depuis les ingrédients.

```jsonc
{
  "id": "diner-cabillaud-courgettes-quinoa",
  "label": "Cabillaud, courgettes, quinoa",
  "slot": ["diner"],              // petit-dej | dejeuner | collation | diner (1 ou +)
  "servings": 1,                  // portions produites (entier > 0)
  "prepMin": 10,
  "cookMin": 15,
  "batchFriendly": true,          // préparable à l'avance → picto 🍲 dans l'app
  "cookedYieldG": 620,            // optionnel : poids total APRÈS cuisson, si mesuré
  "ingredients": [
    { "foodId": "cabillaud-cru", "grams": 250 },
    { "foodId": "courgette",     "grams": 250 },
    { "foodId": "quinoa-cru",    "grams": 90 }
  ],
  "steps": ["Quinoa 15 min.", "Cabillaud 12-15 min à 200 °C — sel, poivre, herbes."]
}
```

Règles :
- **`grams` s'exprime dans l'état déclaré (`state`) de l'aliment** — jamais de conversion implicite.
  (Un aliment `cuit` se pèse cuit : `pois-chiches-cuits` 150 g = 150 g égouttés.)
- **`foodId` doit exister** (catalogue ou section `foods` du même bundle).
- **Épices, aromates, sel, poivre, citron, bouillon : PAS dans `ingredients`** → dans `steps`.
  En dessous de ~5 kcal/portion, c'est du bruit.

---

## 4. `week` — le planning

```jsonc
{ "days": [
  { "label": "Mercredi",
    "isRestaurantDay": true,
    "meals": [
      { "slot": "petit-dej", "recipeId": "shaker-matin" },
      { "slot": "dejeuner",  "recipeId": "gamelle-poulet-riz-legumes", "portions": 1 },
      { "slot": "collation", "recipeId": "shaker-eau", "time": "18:30",
        "note": "avant de partir au restaurant" },
      { "slot": "diner", "estimated": { "kcal": 1200, "proteinG": 45 },
        "note": "Resto — estimation, dessert compris" },
      { "slot": "extra", "foodId": "kiwi", "grams": 75, "note": "dessert" }
    ] }
] }
```

- 7 jours, `label` de **Lundi** à **Dimanche**.
- `meals` est un **tableau** : plusieurs entrées peuvent partager le même `slot`
  (2 collations, un `diner` + un `extra` pour le dessert).
- `slot` ∈ `petit-dej | dejeuner | collation | diner | extra`.
- Chaque repas porte **exactement un** de : `recipeId` (+ `portions`, défaut 1, décimales OK),
  `foodId` + `grams`, ou `estimated` `{kcal, proteinG}`.
- `time` (`"HH:MM"`) facultatif : sert au tri d'affichage.

---

## 5. `expectedTotals` — le contrôle croisé (obligatoire avec `week`)

Le bundle **déclare** ce que chaque jour doit totaliser ; l'app **recalcule** depuis ses tables.
Si ça diverge au-delà de la tolérance, **l'import est refusé** en désignant le jour fautif.

```jsonc
"expectedTotals": {
  "perDay": [
    { "label": "Lundi",  "kcal": 2240, "proteinG": 186 },
    { "label": "Mardi",  "kcal": 2210, "proteinG": 191 }
    // … les 7 jours
  ],
  "weekAvgKcal": 2265,
  "weekAvgProteinG": 188,
  "toleranceKcal": 20,        // optionnel (défaut 20)
  "toleranceProteinG": 3      // optionnel (défaut 3)
}
```

---

## 6. Checklist avant envoi
- [ ] JSON valide, un seul objet englobant.
- [ ] `state` présent et valide sur **chaque** aliment ajouté ; `cookedFactor` seulement sur `cru`.
- [ ] Tous les `foodId` / `recipeId` existent (catalogue ou bundle).
- [ ] `week` ⇒ `expectedTotals` avec **les 7 jours** + moyennes.
- [ ] Grammages exprimés **dans l'état de l'aliment**.
- [ ] Aucune épice/aromate dans `ingredients`.
- [ ] Aucune marque.

---

## 7. Le prompt à donner à Cowork

Copie ce bloc dans Cowork, **et joins-lui le `foods.json` à jour** :
`https://raw.githubusercontent.com/christophem59/Cap80-app/main/src/data/foods.json`

```text
Rôle. Tu produis un « bundle » JSON hebdomadaire pour mon app de suivi Cap80 : mes recettes et le planning des 7 jours.

SORTIE : un SEUL objet JSON, sans texte autour :
{ "foods"?: [...], "recipes"?: [...], "week"?: { "days": [...] }, "expectedTotals": {...} }

ALIMENTS (foods) — n'en ajoute que si nécessaire, en utilisant en priorité les id du foods.json fourni.
Chaque aliment ajouté : id (kebab-case, sans marque), label (sans marque), category parmi
legumes|fruits|proteines|laitiers|feculents|gras|epices|boissons|autre,
state OBLIGATOIRE parmi cru|cuit|tel-quel,
per100g {kcal, proteinG, fatG, carbsG, fiberG} dans l'état déclaré,
cookedFactor UNIQUEMENT si state="cru" (poids cuit = poids cru × facteur),
servings optionnel.
- state "cru"/"cuit" => le libellé doit contenir « cru… »/« cuit… ».
- "tel-quel" pour tout ce qui ne se cuisine pas (laitiers, poudres, pain, conserves, huiles, fruits frais).

RECETTES (recipes) : id, label, slot (petit-dej|dejeuner|collation|diner), servings (portions produites),
prepMin, cookMin, batchFriendly, ingredients [{foodId, grams}], steps, cookedYieldG optionnel
(poids total après cuisson si mesuré).
- RÈGLE CLÉ : les grammes sont exprimés DANS L'ÉTAT DÉCLARÉ de l'aliment (state), jamais convertis.
  Un aliment "cuit" se pèse cuit ; un aliment "cru" se pèse cru.
- Les épices, aromates, sel, poivre, jus de citron et bouillons NE FIGURENT PAS dans ingredients :
  mets-les dans steps.
- Ne calcule aucune macro dans la recette : l'app les recalcule depuis les ingrédients.

SEMAINE (week.days) : 7 jours, label Lundi→Dimanche, chacun avec "meals" = TABLEAU de repas.
Plusieurs repas peuvent partager le même slot (2 collations, dîner + extra pour le dessert).
Chaque repas : slot parmi petit-dej|dejeuner|collation|diner|extra, et EXACTEMENT un de :
  - recipeId (+ portions, défaut 1, décimales acceptées)
  - foodId + grams
  - estimated {kcal, proteinG}   (repas non décomposé, ex. restaurant)
time "HH:MM" et note sont facultatifs ; isRestaurantDay: true sur un jour de restaurant.

CONTRÔLE CROISÉ (expectedTotals) — OBLIGATOIRE dès que week est présent :
{ "perDay": [{label, kcal, proteinG} × 7], "weekAvgKcal": n, "weekAvgProteinG": n,
  "toleranceKcal"?: 20, "toleranceProteinG"?: 3 }
Calcule ces totaux TOI-MÊME depuis les grammages et le foods.json fourni. Mon app recalcule de son
côté et REFUSE l'import si un jour dépasse la tolérance. Sois rigoureux : c'est une somme de contrôle.

CIBLES : environ 2200 kcal/j, ~180 g de protéines/j, fibres ≥ 30 g/j. Un jour de restaurant peut
être plus élevé.

AVANT DE FINIR, vérifie : JSON valide ; state sur chaque aliment ajouté ; cookedFactor seulement sur
"cru" ; tous les foodId/recipeId existent (catalogue ou bundle) ; expectedTotals couvre les 7 jours ;
aucune épice dans ingredients ; aucune marque.
```

---

## 8. Ce qui ne change pas
Aucune macro n'est stockée sur une `Recipe` — tout se recalcule depuis `foods.json`.
Seule exception : `MealItem`, qui **fige** ses valeurs à la saisie pour qu'un repas déjà mangé
ne change pas rétroactivement. **Le catalogue calcule, le journal fige.**
