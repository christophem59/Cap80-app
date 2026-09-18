# Backlog Cap80

Idées à réaliser, par thème. Non priorisé strictement — voir notes.

## Rappels / Notifications — ⏸️ Mis de côté (2026-08-21)
- Tenté puis **retiré** : bannière in-app + notif à l'ouverture + Web Push (SW custom + workflow GitHub Actions du dépôt privé).
- Bloqueur : le **web push ne s'affichait pas** sur le Pixel 8 Pro alors que tout était correct (permission, SW à jour, endpoint frais, VAPID cohérent, FCM 201, ping nu KO, autres sites OK). Cause non tranchée (budget push silencieux Chrome / spécificité WebAPK ?) — nécessiterait un débogage USB `chrome://inspect`.
- Telegram/e-mail écartés (l'utilisateur ne veut pas de nouvelle app ; rappel e-mail non retenu pour l'instant).
- À reprendre seulement si le besoin se confirme à l'usage. Piste native = débogage USB du web push ; sinon canal e-mail.

## Scanner de code-barres
- Scan produit → log rapide, via base ouverte **OpenFoodFacts** (pas de marques en dur).
- Priorité à confirmer : l'utilisateur pèse déjà ses aliments, intérêt réel à valider avant de développer.

## Vue « Ta semaine » — ✅ Fait (2026-08-21, v0.9.6)
- Écran `/semaine` (accès via la carte « Semaine » de l'écran Aujourd'hui), navigation semaine ‹/›.
- Carte « critères du programme remplis cette semaine ? » : calories/protéines (moyennes des jours saisis), séances, pas — avec code couleur + compteur X/Y.
- Détail jour par jour (poids, kcal, protéines, séance, pas) + jours pesés /7.
- Reste possible : mensurations dans le récap, variation de poids hebdo vs semaine précédente.

## Recettes & semaine — ✅ Fait (2026-08-24, v0.9.11 → v0.9.17)
- Journal : édition des macros d'un item + saisie libre (ajustement one-shot).
- Onglet « Batch » → « Recettes » : toutes les recettes, picto 🍲 = préparable à l'avance.
- Onglet « Semaine » : format `days[].meals[]` (plusieurs repas/créneau, `time`, `extra`,
  `estimated` resto), « + auj. » par repas et « + tout le jour ».
- Courses : sélection multiple depuis Recettes avec portions ; « semaine type » retirée.
- Aliments : `state` (cru/cuit/tel-quel) sur les 498 + `foodsVersion` (empreinte de base).
- Injection : `docs/injection-repas.md` (format v3 + prompt Cowork) et
  `scripts/validate-bundle.mjs` (refus si base différente / totaux hors tolérance ;
  `target` et fibres contrôlés) + `scripts/foods-version.mjs --stamp`.
- Plus tard (optionnel) : éditeur de recettes in-app ; import du bundle directement dans
  l'app ; planning éditable à la main dans l'app.

## TDEE adaptatif — ✅ Fait (2026-09-18, v1.4.0)
- Écran `/energie` (accès depuis Programme) : dépense **théorique** et **observée** côte à
  côte, facteur d'activité impliqué par l'observation, écart en kcal/jour.
- Le facteur d'activité est un paramètre éditable et **historisé** (date + raison) ;
  BMR, TDEE, apport cible et macros en découlent, plus rien n'est saisi à la main.
- TDEE observé sur fenêtre glissante ≥ 3 semaines ; garde-fous perte > 1 %, perte < 0,3 %,
  dérive du facteur > 0,10 ; proposition de recalage amortie à 80 % de l'écart.
- Projection à apport constant, itérative (la perte ralentit), + recalcul des cibles de
  toutes les phases à venir au poids qu'elles verront.
- Corrections manuelles des observations hebdomadaires (forfait resto estimé).
- Détail : `docs/modele-energetique.md`.
- Reste possible : exploiter la **semaine de calibrage** (S0, aujourd'hui purement
  observationnelle) pour fixer la cible de départ ; fusionner le moteur d'ajustement §6.7
  (paliers ±100/150 kcal sur la seule tendance de poids) avec ce modèle, qui le double
  partiellement.
