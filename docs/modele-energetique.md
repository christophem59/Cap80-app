# Le modèle énergétique (§6.9)

Comment l'app décide de la dépense, de l'apport cible et des macros — et comment elle
vérifie qu'elle ne se trompe pas.

## Le problème que ça résout

Le §6.2 calcule une dépense **théorique** : `Mifflin-St Jeor × facteur d'activité`. Cette
théorie peut se tromper lourdement, et rien dans l'app ne le signalait. Sur les trois
premières semaines de déficit du programme, elle a sous-estimé la dépense réelle
d'environ **400 kcal/jour**, de façon systématique — pas du bruit. L'apport cible qui en
découlait était donc trop haut de 400 kcal, et la perte plus lente que prévu, sans qu'on
sache pourquoi.

Le correctif n'est pas de remplacer un nombre par un autre. C'est de rendre ce nombre
**mesurable, éditable et historisé**.

## Les quatre briques

### 1. Le facteur d'activité est un paramètre, jamais une constante

`Profile.activityFactor`. Il se change dans **Énergie → Le modèle en place**, avec une
raison obligatoire, et chaque changement est consigné dans `Profile.activityFactorHistory`
(date, avant, après, facteur observé, raison). Sans cette trace, personne ne peut relire
la trajectoire du modèle six mois plus tard.

### 2. Le BMR se recalcule à chaque nouvelle moyenne hebdomadaire

Jamais figé au poids de départ. Le poids de référence est la **dernière moyenne
hebdomadaire** disponible ; tout en découle : BMR → TDEE → apport → macros. Aucune de ces
valeurs n'est saisie à la main. Le seul arbitrage restant est le **déficit visé**
(`Profile.targetDeficitKcal`, 600 kcal par défaut).

Macros : protéines 1,95 g/kg (plancher dur 1,6), lipides 0,83 g/kg (plancher dur 0,7 —
en dessous, la production hormonale se dégrade), glucides en solde, fibres ≥ 30 g.
L'apport est arrondi à 50 kcal et ne descend jamais sous le plancher de 1 800 kcal (§6.7).

### 3. Le TDEE observé — la brique qui manquait

```
TDEE_observé   = apport_moyen + (perte_kg × 7700 / jours)
facteur_observé = TDEE_observé / BMR
```

L'apport retenu est celui des semaines **pendant** lesquelles le poids a bougé, donc
toutes sauf la première : ce qui a été mangé avant la première moyenne n'explique pas la
variation qui la suit.

Calculé sur une **fenêtre glissante d'au moins 3 semaines consécutives**, jamais sur une
seule. Une semaine isolée donne des valeurs absurdes — sur les données de septembre 2026,
deux semaines voisines impliquaient un TDEE de 3 930 puis de 2 390. Aucune des deux
n'était exploitable. Une semaine sans apport saisi **coupe** la fenêtre au lieu de la
polluer.

L'écran affiche théorique et observé **côte à côte**. C'est tout l'objet : rendre l'écart
visible le jour où il apparaît, pas trois semaines plus tard.

### 4. Les garde-fous

| Signal | Seuil | Ce que ça veut dire |
|---|---|---|
| Perte trop rapide | > 1,0 % du poids / semaine | risque réel de perte de masse maigre |
| Perte trop lente | < 0,3 % du poids / semaine, sur ≥ 3 semaines | le facteur est trop haut |
| Dérive du modèle | \|facteur observé − facteur en place\| > 0,10 | le modèle ne décrit plus la réalité |

Sur dérive, l'app **propose** un recalage. Elle ne recopie pas le facteur observé : elle
parcourt **80 % de l'écart**, arrondi à 0,05. Trois semaines restent trois semaines, et on
réévalue à chaque nouvelle moyenne.

## La projection ralentit toute seule

À apport constant, la perte décroît mécaniquement : le poids baisse → le BMR baisse → le
déficit se réduit. Une projection linéaire est fausse, et toujours trop optimiste.
`projectAtConstantIntake` itère semaine par semaine en recalculant la dépense à chaque pas.

## Les phases suivent le modèle, pas l'inverse

Recaler le facteur sans toucher aux phases produirait une incohérence silencieuse : la
phase en cours passerait à 2 500 kcal pendant que les suivantes garderaient les cibles
saisies sous l'ancien modèle — un déficit bien plus creux que voulu, et une trajectoire
projetée qui plonge sous le poids cible.

`proposePlanTargets` recalcule donc **chaque phase à venir au poids qu'elle verra
vraiment**, en projetant de phase en phase. Les phases d'entretien visent la dépense
elle-même. Les phases déjà passées ne sont pas touchées : ce sont des faits. Une phase à
rampe (stabilisation) garde la sienne et arrête le parcours.

L'écriture dans le programme reste **un geste explicite** : le bouton « Écrire ces cibles
dans le programme ». Rien n'est modifié dans le dos de l'utilisateur.

## Corriger une observation

Certaines semaines ne sont pas mesurables : un forfait restaurant estimé à 1 500 kcal
quand la réalité était 1 200 fausse le TDEE observé de 40 kcal/jour, et l'app n'a aucun
moyen de le deviner. **Énergie → Semaines observées** permet de corriger le poids moyen ou
l'apport d'une semaine (`Profile.weekOverrides`), de la marquer comme estimée, et de la
rendre au calcul. La valeur calculée reste affichée à côté de la correction.

## Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `src/domain/energy.ts` | TDEE observé, garde-fous, cibles dérivées, cibles de phases |
| `src/domain/weekEnergy.ts` | reconstitution des observations hebdomadaires (poids + repas + corrections) |
| `src/domain/projection.ts` | `projectAtConstantIntake` / `weeksToReach` |
| `src/domain/planEdit.ts` | `setPhaseTargets` (cibles absolues sur une phase) |
| `src/repo/profile.ts` | `setActivityFactor` (avec historisation), `setTargetDeficit`, `setWeekOverride` |
| `src/pages/Energy.tsx` | l'écran `/energie` |
