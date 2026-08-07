# Cap80

PWA de suivi d'un programme de perte de poids (cap sur 80 kg) : poids, mensurations,
photos, séances de renforcement, pas, repas et adaptation du programme.
**Mono-utilisateur, sans compte, hors-ligne d'abord.** Cible : **Chrome sur Android**
(installée en PWA).

Deux dépôts (§1.2) :

- **Cap80-app** (ce dépôt, **public**) : application + catalogues de contenu + CI.
- **Cap80** (dépôt séparé, **privé**) : mesures, séances, repas, photos. Son nom et le
  token GitHub sont saisis dans l'app au premier lancement et stockés **uniquement sur
  l'appareil** — jamais dans ce dépôt public.

> État : **lots 1 à 3**. Socle installable, règles métier testées, couche de
> synchronisation GitHub ; les écrans métier arrivent dans les lots suivants.

## Développement

Prérequis : Node ≥ 20.19 (ou ≥ 22.12), npm.

```bash
npm install
npm run dev       # serveur de dev Vite (http://localhost:5173)
npm run build     # vérification TypeScript + build de production
npm run preview   # sert le build de production (teste le service worker et le manifest)
npm test          # tests unitaires Vitest (règles métier — arrivent au lot 2)
npm run icons     # régénère les icônes PWA (public/icon-*.png)
```

Le service worker n'est **pas** actif en `npm run dev` ; pour tester l'installation,
le hors-ligne et la mise à jour, il faut passer par `npm run build` puis `npm run preview`.

## Tester sur le téléphone Android — port forwarding (indispensable)

Un service worker exige un **contexte sécurisé**. La seule exception est `localhost`.
Une adresse IP privée (`http://192.168.x.x:5173`) **n'est pas** une origine sûre : sur le
téléphone, pas de SW, pas d'installation, pas de stockage persistant. La solution est le
**port forwarding USB de `chrome://inspect`** — le trafic passe par le câble, donc le
téléphone voit un vrai `localhost`, sans certificat à générer :

1. **Téléphone** : Options développeur → Débogage USB activé, puis branchement USB.
2. **Mac** : ouvrir `chrome://inspect/#devices`, cocher « Discover USB devices ».
3. Activer **Port forwarding** et mapper `localhost:5173` → `localhost:5173`
   (et `localhost:4173` → `localhost:4173` pour tester le build en `preview`).
4. **Téléphone** : ouvrir `http://localhost:5173` — c'est le Vite du Mac, en origine sûre.
5. Le bouton « inspect » ouvre un DevTools complet sur l'onglet du téléphone (panneau
   Application : service workers, manifest, IndexedDB, quota de stockage).

> Ne pas utiliser `--unsafely-treat-insecure-origin-as-secure` : sur Android ce flag exige
> un appareil rooté. Un tunnel HTTPS (ngrok, Cloudflare Tunnel) est un repli acceptable si
> l'USB n'est pas praticable.

## Déploiement — GitHub Pages

Le déploiement est automatique via GitHub Actions
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) à chaque push sur `main`.

Réglage initial, une seule fois : **Settings → Pages → Build and deployment →
Source : GitHub Actions**.

Le site est servi sous `https://christophem59.github.io/Cap80-app/`. Le chemin de base
`/Cap80-app/` est configuré dans [vite.config.ts](vite.config.ts) (base, scope, start_url,
navigateFallback) et un fichier `public/.nojekyll` évite que Pages n'ignore les fichiers.

## Dépôt de données privé et tokens

> Détail complet et configuration in-app : **lot 3**. Résumé de la cible :

- Dépôt **privé** `Cap80` (contient uniquement les données personnelles).
- Créer **deux** fine-grained personal access tokens, portée limitée à ce seul dépôt,
  permission **Contents: Read and write**, avec une date d'expiration (1 an) :
  - un pour l'**application** (saisi dans les réglages) ;
  - un **distinct** pour l'**automatisation des pas** (§9 du cahier des charges), afin de
    pouvoir le révoquer seul.
- Initialiser le dépôt de données depuis l'app (création de `profile.json` et des fichiers
  vides) — étape explicite de l'écran de configuration.

## Feuille de route (lots)

1. **Socle** — Vite + TS + Tailwind + PWA, navigation, thème, base path Pages ✅
2. **Domaine et tests** — règles métier (§6), catalogues, Vitest ✅
3. **Persistance et synchronisation** — IndexedDB, outbox, client GitHub, fusion ✅
4. Suivi (poids, moyenne mobile, mensurations, photos, écran Aujourd'hui)
5. Séances
6. Repas (aliments, recettes, journal, liste de courses, batch cooking)
   - 6 bis. Suivi du grignotage (« Envie », déclencheurs)
7. Programme et ajustement
8. Pas (saisie manuelle, import Health Connect, boîte de réception git)
9. Finitions (installation, export/import, Background Sync, accessibilité)

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · react-router-dom (hash) · vite-plugin-pwa
(Workbox) · Vitest. Les dépendances métier (`idb`, `zod`, `recharts`, `fflate`) sont
ajoutées dans les lots qui les utilisent.
