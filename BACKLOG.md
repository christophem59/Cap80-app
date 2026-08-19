# Backlog Cap80

Idées à réaliser, par thème. Non priorisé strictement — voir notes.

## Rappels / Notifications
- Notifications PWA (service worker) pour soutenir la régularité (levier d'adhésion #1).
- Rappel **pesée du matin**.
- Rappel **saisie des repas** si non renseignés.
- Rappel **saisie des pas** si non renseignés (relance en fin de journée).

## Scanner de code-barres
- Scan produit → log rapide, via base ouverte **OpenFoodFacts** (pas de marques en dur).
- Priorité à confirmer : l'utilisateur pèse déjà ses aliments, intérêt réel à valider avant de développer.

## Vue « Ta semaine »
- Récapitulatif hebdo en un coup d'œil : repas, mensurations, pas.
- Indicateur clair « critères du programme remplis cette semaine ? » (calories, protéines, séances, pas atteints/objectifs).
- S'appuie sur l'existant : tableau de bord « aujourd'hui vs objectifs », projection, écran d'ajustement.

## TDEE adaptatif (à décider)
- Estimer l'entretien RÉEL à partir des données (apport moyen + tendance de poids), pas seulement de la formule Mifflin × facteur d'activité.
- Exploiter la **semaine de calibrage** (aujourd'hui purement observationnelle, non exploitée par le calcul) pour fixer la cible de départ personnalisée.
- Complèterait le moteur d'ajustement §6.7 (aujourd'hui réactif sur la seule tendance de poids, par paliers ±100/150 kcal).
- Prérequis : saisie des repas fiable (sinon estimation faussée).
