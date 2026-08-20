# Notifications en arrière-plan (Web Push) — mise en place

Objectif : recevoir les rappels **même app fermée**, via un workflow GitHub Actions
qui tourne dans ton **dépôt privé** (celui de la synchro, là où sont `weights.json`,
`meals/`, etc.) et envoie une notification push quand une saisie du jour manque.

Le code de l'app (dépôt public) gère déjà : l'abonnement push et l'affichage des
notifications (service worker). Reste à installer le « déclencheur » côté dépôt privé.

## 1) Générer les clés VAPID (une seule fois)

Sur ton ordinateur :

```bash
npx web-push generate-vapid-keys
```

Tu obtiens une **Public Key** et une **Private Key** (chaînes base64url).

## 2) Copier les 2 fichiers dans le dépôt PRIVÉ

Depuis ce dossier `push-backend/` du dépôt public, copie :

- `reminders.yml`        → dans le privé : `.github/workflows/reminders.yml`
- `send-reminders.mjs`   → dans le privé : `.github/scripts/send-reminders.mjs`

Committe/pusse ces deux fichiers dans le dépôt privé.

## 3) Renseigner les secrets/variables du dépôt PRIVÉ

Dépôt privé → **Settings → Secrets and variables → Actions** :

- Secret `VAPID_PRIVATE_KEY` = la Private Key
- Secret `VAPID_PUBLIC_KEY`  = la Public Key
- Secret `VAPID_SUBJECT`     = `mailto:christophe.morelle@lyaprotect.com`
- Variable `APP_URL`         = `https://christophem59.github.io/Cap80-app/`

## 4) Activer côté app

Dans l'app : **Réglages → Rappels**
- Active les rappels (autorise les notifications).
- Colle la **Public Key** dans « Clé publique VAPID ».
- **Activer l'arrière-plan** → l'app dépose `push/subscription.json` dans le dépôt privé.

## 5) Tester

Dépôt privé → onglet **Actions → Rappels Cap80 → Run workflow**. Coche **« Test forcé »**
pour ignorer l'heure et l'anti-doublon (envoie tant qu'un item du jour n'est pas saisi).
Le log détaille, pour chaque item, pourquoi il a été envoyé ou sauté.

## Notes

- Le cron tourne toutes les 30 min de 05h à 21h UTC (~06h–23h France). Ajuste la ligne
  `cron:` si besoin. GitHub peut décaler l'exécution de quelques minutes.
- Anti-doublon : `push/sent.json` mémorise ce qui a déjà été envoyé aujourd'hui.
- Confidentialité : l'abonnement et les clés restent dans ton dépôt privé / tes secrets.
  La Public Key n'est pas sensible ; la Private Key ne doit jamais quitter les secrets.
- Si tu changes d'appareil/navigateur, réactive l'arrière-plan (nouvel abonnement).
