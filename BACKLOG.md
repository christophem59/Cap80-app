# Backlog Cap80

Idées à réaliser, par thème. Non priorisé strictement — voir notes.

## Rappels / Notifications — ✅ Fait
- Bannière in-app (Aujourd'hui) + notification OS à l'ouverture si saisie manquante ; réglages par type (pesée/repas/pas) avec heure.
- **Notifications en arrière-plan (app fermée)** via Web Push : service worker custom (push + clic), abonnement déposé dans le dépôt privé, envoi par workflow GitHub Actions (cf. `push-backend/`). Mise en place = clés VAPID + secrets + copie des 2 fichiers dans le dépôt privé.
- Clic sur la notif → ouvre/refocalise l'app (SW `injectManifest`).

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
