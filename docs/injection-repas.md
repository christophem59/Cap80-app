# Cap80 — injection recettes & semaine

Ce document décrit le **fichier unique** (« bundle ») qui permet d'alimenter, enrichir ou
remplacer les **aliments**, les **recettes** et la **semaine** de Cap80, sans coder.

Flux prévu : tu prépares le contenu **avec Cowork**, tu me pousses le fichier JSON produit,
je l'applique au dépôt public (`src/data/foods.json`, `recipes.json`, `week.default.json`),
je commit + push, et l'app se met à jour au prochain rechargement.

---

## 1. Le bundle

Un seul objet JSON. Les trois sections sont **facultatives** — n'inclus que ce que tu veux
changer.

```json
{
  "foods":   [ /* aliments à ajouter/remplacer (optionnel) */ ],
  "recipes": [ /* recettes à ajouter/remplacer (optionnel) */ ],
  "week":    { "days": [ /* la semaine, remplace TOUT (optionnel) */ ] }
}
```

### Règles d'application (ce que je fais à la réception)
- **`foods`** : fusion **par `id`**. Un id déjà présent est **remplacé**, un nouvel id est **ajouté**. Les autres aliments ne bougent pas.
- **`recipes`** : fusion **par `id`**, même logique.
- **`week`** : **remplacement complet** de la semaine (c'est un planning, pas un cumul).

> Donc : « enrichir » = envoyer seulement les nouveautés ; « remplacer une recette » = renvoyer le même `id` ; « refaire la semaine » = envoyer une section `week` complète.

---

## 2. Schéma des `foods` (aliments)

N'ajoute un aliment **que s'il manque** dans `foods.json`. Valeurs **pour 100 g du produit tel que pesé**.

```json
{
  "id": "kebab-maison",                 // kebab-case, unique, stable
  "label": "Kebab maison",              // sans marque
  "category": "proteines",              // legumes|fruits|proteines|laitiers|feculents|gras|epices|boissons|autre
  "per100g": { "kcal": 215, "proteinG": 12, "fatG": 9, "carbsG": 22, "fiberG": 2 },
  "servings": [{ "label": "1 portion (250 g)", "grams": 250 }]  // optionnel : portions usuelles
}
```
Contraintes : **pas de marques**, `kcal`/macros cohérents (≈ 4·prot + 4·gluc + 9·lip), `fiberG` ≥ 0.

---

## 3. Schéma des `recipes` (recettes)

Une recette = une **composition d'aliments** pesés **crus** (poids mis dans la casserole),
pour un **nombre de portions produites** (`servings`). Les macros sont **recalculées par l'app**
depuis les ingrédients — ne les mets pas à la main.

```json
{
  "id": "diner-cabillaud-courgettes-quinoa",   // kebab-case, unique
  "label": "Cabillaud, courgettes, quinoa",
  "slot": ["diner"],                            // 1+ créneaux : petit-dej | dejeuner | collation | diner
  "servings": 1,                                // nb de portions produites par la recette
  "prepMin": 10,
  "cookMin": 15,
  "batchFriendly": true,                        // true = préparable à l'avance (picto 🍲 dans l'app)
  "ingredients": [
    { "foodId": "cabillaud-cru", "grams": 250 },   // foodId DOIT exister dans foods.json
    { "foodId": "courgette",     "grams": 250 },
    { "foodId": "quinoa-cru",    "grams": 90 }
  ],
  "steps": ["Quinoa 15 min.", "Cabillaud 12-15 min à 200 °C — ne pas trop cuire."]
}
```

Contraintes clés :
- **`foodId` doit exister** dans `foods.json` (sinon l'ingrédient est ignoré et les macros sont fausses). Si un aliment manque, ajoute-le dans la section `foods`.
- **`grams` = poids CRU**, tel que pesé avant cuisson.
- `servings` = portions produites (une recette « batch » en produit plusieurs ; un plat individuel = 1).

---

## 4. Schéma de la `week` (semaine)

7 jours, **un id de recette par créneau**. Les recettes référencées doivent exister
(dans `recipes.json` ou dans la section `recipes` du même bundle).

```json
{
  "days": [
    { "label": "Lundi", "slots": {
        "petit-dej": "shaker-matin",
        "dejeuner":  "gamelle-poulet-riz-legumes",
        "collation": "oeufs-durs",
        "diner":     "diner-cabillaud-courgettes-quinoa" } },
    { "label": "Mardi", "slots": { "petit-dej": "…", "dejeuner": "…", "collation": "…", "diner": "…" } }
    // … Mercredi → Dimanche
  ]
}
```
Un créneau peut être omis (rien de prévu). Un seul plat par créneau (une recette peut elle-même
être une composition).

---

## 5. Checklist de validation (avant de me l'envoyer)
- [ ] JSON valide (une seule accolade englobante).
- [ ] Tous les `foodId` des recettes existent dans `foods.json` **ou** sont fournis dans `foods`.
- [ ] Tous les `recipeId` de `week` existent dans `recipes.json` **ou** dans `recipes`.
- [ ] `slot` uniquement parmi : `petit-dej`, `dejeuner`, `collation`, `diner`.
- [ ] `category` (foods) parmi la liste autorisée. Pas de marque dans les libellés.
- [ ] Grammages des recettes = **crus**.

À la réception je revérifie tout ça et je te signale toute référence manquante avant d'appliquer.

---

## 6. Exemple minimal complet

```json
{
  "recipes": [
    {
      "id": "diner-omelette-champignons",
      "label": "Omelette aux champignons",
      "slot": ["diner"], "servings": 1, "prepMin": 5, "cookMin": 10, "batchFriendly": false,
      "ingredients": [
        { "foodId": "oeuf-entier",   "grams": 220 },
        { "foodId": "champignons",   "grams": 250 },
        { "foodId": "salade-verte",  "grams": 100 },
        { "foodId": "pain-complet",  "grams": 100 },
        { "foodId": "huile-olive",   "grams": 5 }
      ],
      "steps": ["Champignons à sec d'abord (évacuer l'eau), puis l'huile.", "4 œufs."]
    }
  ],
  "week": {
    "days": [
      { "label": "Lundi", "slots": { "petit-dej": "shaker-matin", "dejeuner": "salade-complete", "collation": "oeufs-durs", "diner": "diner-omelette-champignons" } }
    ]
  }
}
```

---

## 7. Flux à donner à Cowork

Copie-colle ce prompt dans Cowork (et joins-lui le contenu à jour de
`foods.json` — brut : `https://raw.githubusercontent.com/christophem59/Cap80-app/main/src/data/foods.json`) :

> **Rôle.** Tu prépares un « bundle » JSON pour mon app de suivi Cap80. Objectif : définir mes
> recettes de la semaine à venir et le planning des 7 jours.
>
> **Source de vérité des aliments.** Utilise **uniquement** les `id` présents dans le `foods.json`
> que je te fournis. Si un aliment nécessaire manque, ajoute-le dans une section `foods`
> (valeurs pour 100 g, catégorie parmi legumes|fruits|proteines|laitiers|feculents|gras|epices|boissons|autre,
> **sans marque**).
>
> **Sortie.** Un **seul** objet JSON, sans texte autour, de la forme :
> `{ "foods"?: [...], "recipes"?: [...], "week"?: { "days": [...] } }`.
>
> **Recettes.** Chaque recette : `id` (kebab-case), `label`, `slot` (parmi petit-dej|dejeuner|collation|diner),
> `servings` (portions produites), `prepMin`, `cookMin`, `batchFriendly` (true si préparable à
> l'avance), `ingredients` (`{foodId, grams}` avec **grammes CRUS** et `foodId` existant), `steps`.
> Ne calcule pas les calories : l'app le fait depuis les ingrédients.
>
> **Semaine.** `week.days` = 7 jours (`label` Lundi→Dimanche), chaque jour `slots` avec
> `petit-dej`, `dejeuner`, `collation`, `diner` → un `id` de recette (existant ou défini dans `recipes`).
>
> **Contexte nutritionnel** (à respecter au mieux) : perte de poids, environ **2200 kcal/j** et
> **~180 g de protéines/j**, fibres ≥ 30 g. Un jour peut être plus haut (repas au restaurant).
>
> **Avant de finir**, vérifie : JSON valide, tous les `foodId` existent (ou sont dans `foods`),
> tous les `recipeId` de `week` existent (ou sont dans `recipes`), pas de marque.

Le fichier produit par Cowork, tu me le pousses tel quel : je le valide et je l'applique.
