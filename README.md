# Cap80

PWA de suivi d'un programme de perte de poids (cap sur 80 kg) : poids, mensurations,
photos, séances de renforcement, pas, repas, envies (grignotage) et adaptation du
programme. **Mono-utilisateur, sans compte, hors-ligne d'abord.** Cible : **Chrome sur
Android** (installée en PWA). En ligne : <https://christophem59.github.io/Cap80-app/>

## Deux dépôts (§1.2)

| Dépôt | Visibilité | Contenu |
|---|---|---|
| **Cap80-app** (ce dépôt) | **public** | application + catalogues (aliments, recettes, programme type) + CI |
| **Cap80** | **privé** | uniquement les données personnelles : mesures, séances, repas, photos, pas… |

**Aucune donnée personnelle, aucun token, aucun nom de dépôt privé en dur dans ce dépôt
public.** Le nom du dépôt de données et le token sont saisis dans l'app (Réglages) et
stockés **uniquement sur l'appareil** (localStorage). IndexedDB est la source de vérité
de l'UI ; le dépôt privé sert de sauvegarde, de synchro entre appareils et d'historique.

## Développement

Prérequis : Node ≥ 20.19 (ou ≥ 22.12), npm.

```bash
npm install
npm run dev       # serveur de dev (http://localhost:5173) — pas de service worker
npm run build     # vérification TypeScript + build de production
npm run preview   # sert le build (teste service worker, manifest, installation)
npm test          # tests unitaires Vitest (règles métier §6)
npm run icons     # régénère les icônes PWA (public/icon-*.png)
```

Le service worker n'est **pas** actif en `npm run dev` : pour tester l'installation, le
hors-ligne et la mise à jour, passer par `npm run build` puis `npm run preview`.

## Tester sur le téléphone Android — port forwarding (indispensable)

Un service worker exige un **contexte sécurisé** ; la seule exception est `localhost`.
Une adresse IP privée (`http://192.168.x.x:5173`) **n'en est pas une** : pas de SW, pas
d'installation, pas de stockage persistant. Solution : le **port forwarding USB de
`chrome://inspect`** — le trafic passe par le câble, le téléphone voit un vrai
`localhost`, sans certificat :

1. **Téléphone** : Options développeur → Débogage USB, puis branchement USB.
2. **Mac** : `chrome://inspect/#devices` → cocher « Discover USB devices ».
3. **Port forwarding** → mapper `localhost:5173` → `localhost:5173`
   (et `localhost:4173` pour le `preview`).
4. **Téléphone** : ouvrir `http://localhost:5173` — c'est le Vite du Mac, en origine sûre.
5. Le bouton « inspect » ouvre un DevTools complet (Application : SW, manifest, IndexedDB).

> Ne pas utiliser `--unsafely-treat-insecure-origin-as-secure` (exige un appareil rooté
> sur Android). Un tunnel HTTPS (ngrok, Cloudflare Tunnel) est un repli acceptable.

## Déploiement — GitHub Pages

Automatique via GitHub Actions ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
à chaque push sur `main`. Réglage initial une fois : **Settings → Pages → Source :
GitHub Actions**. Le site est servi sous `/Cap80-app/` ; le base path est configuré dans
[vite.config.ts](vite.config.ts) et `public/.nojekyll` évite le traitement Jekyll.

## Créer le dépôt de données et les deux tokens

1. Créer un dépôt **privé** `Cap80`.
2. Créer **deux** fine-grained personal access tokens
   ([github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)),
   portée limitée au seul dépôt `Cap80`, permission **Contents : Read and write**,
   **expiration 1 an** (noter la date de renouvellement) :
   - un pour l'**application** (saisi dans Réglages) ;
   - un **distinct** pour l'**automatisation des pas** (ci-dessous), afin de pouvoir le
     révoquer seul sans casser l'app.
3. Dans l'app : **Réglages → Dépôt de données** → owner, `Cap80`, token →
   **Enregistrer et vérifier**, puis **Initialiser le dépôt** (crée `profile.json` et les
   fichiers vides ; indispensable au premier lancement, §5.2).

## Sauvegarde et restauration

- **Synchro git** : chaque saisie part dans l'`outbox` puis est poussée dans `Cap80`
  (un commit par lot, coalescé). Au démarrage l'app tire et réconcilie (fusion
  enregistrement par enregistrement, tombstones pour les suppressions).
- **Export/import JSON** : **Réglages → Sauvegarde locale** → *Exporter* produit un JSON
  complet (profil, mesures, repas, séances, pas, vignettes…) ; *Importer* le restitue sur
  une installation vierge. *Réinitialiser* efface le stockage local (les données restent
  dans `Cap80`).

## Automatisation des pas (Android) — optionnelle, 100 % automatique

Il n'existe aucune API web pour lire le podomètre Android (Health Connect est natif ;
Google Fit REST est fermé aux nouveaux développeurs). Trois niveaux :

1. **Saisie manuelle** (Aujourd'hui ou écran Pas) — le socle.
2. **Import d'un export** Google Health / Fitbit (Takeout `.zip`) : **Réglages → Pas —
   import** (agrège par jour, déduplique par source, conserve les saisies manuelles).
3. **Automatisation quotidienne** qui pousse elle-même les pas → l'app les récupère seule.
   À configurer une fois côté téléphone (Tasker ou Automate) :

   > Tâche quotidienne (ex. 22 h 30) → lire les pas du jour → sérialiser
   > `{"date":"AAAA-MM-JJ","steps":9421}` → **encoder en base64 sans saut de ligne** →
   > requête **PUT** sur
   > `https://api.github.com/repos/<owner>/Cap80/contents/steps-inbox/<date>.json`,
   > en-têtes `Authorization: Bearer <TOKEN_AUTOMATISATION>` et
   > `Accept: application/vnd.github+json`, corps
   > `{"message":"pas du jour","content":"<base64>"}`.

   Utiliser le **second** token. À chaque synchro, l'app lit `steps-inbox/`, intègre les
   fichiers dans `steps.json` (source *shortcut*) puis les supprime.

> Sécurité : le token de l'automatisation a un accès en écriture au dépôt de données —
> d'où l'intérêt d'en avoir un distinct, révocable seul.

## Rappels (notifications)

Hors périmètre : pas de Web Push (nécessiterait un serveur), la Notification Triggers API
est abandonnée par Chrome, et Periodic Background Sync ne vise pas une heure précise. À la
place : une **alarme quotidienne dans l'horloge du téléphone** pour penser à se peser.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · react-router-dom (hash) · vite-plugin-pwa
(Workbox) · recharts · idb · zod · fflate · Vitest. Polices auto-hébergées (Inter, Outfit).
