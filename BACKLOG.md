# Backlog Cap80

Idées à réaliser, par thème. Non priorisé strictement — voir notes.

## Rappels / Notifications — ✅ Fait
- Bannière in-app (Aujourd'hui) + notification OS à l'ouverture si saisie manquante ; réglages par type (pesée/repas/pas) avec heure ; planification arrière-plan best-effort (Notification Triggers).
- Reste possible plus tard : vraies notifications en arrière-plan garanties (nécessite un serveur de push web / VAPID) ; gestion du clic sur la notif (focus app) via SW `injectManifest`.

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
