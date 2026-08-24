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

## Recettes & semaine (en cours)
- ✅ Onglet « Batch » renommé « Recettes » : liste toutes les recettes, picto 🍲 = préparable à l'avance.
- ✅ Format d'injection + flux Cowork : `docs/injection-repas.md` (bundle foods/recipes/week, appliqué au dépôt public par Claude Code).
- À faire : onglet « Semaine » = affichage du planning injecté + « + auj. » par repas ET par jour (remplacer la semaine type statique).
- À faire : Courses depuis les recettes (bouton « ajouter aux courses » + portions), retirer « générer depuis la semaine type ».
- Plus tard (optionnel) : éditeur de recettes in-app ; import du bundle directement dans l'app (au lieu de passer par Claude Code).

## TDEE adaptatif (à décider)
- Estimer l'entretien RÉEL à partir des données (apport moyen + tendance de poids), pas seulement de la formule Mifflin × facteur d'activité.
- Exploiter la **semaine de calibrage** (aujourd'hui purement observationnelle, non exploitée par le calcul) pour fixer la cible de départ personnalisée.
- Complèterait le moteur d'ajustement §6.7 (aujourd'hui réactif sur la seule tendance de poids, par paliers ±100/150 kcal).
- Prérequis : saisie des repas fiable (sinon estimation faussée).
