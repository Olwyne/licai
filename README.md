# Lǐcái — finances personnelles du foyer

Application Next.js (App Router) + SQLite (Drizzle) : comptes, transactions, budgets, crédits, immobilier, placements, impôts, prévoyance, assistant IA.

## Développement (Docker)

```bash
make init   # crée .env (secret généré) et les certificats locaux (mkcert requis)
make up     # https://licai.localhost — e-mails de dev sur https://mail.licai.localhost
```

Il n'y a pas de conteneur de base de données : SQLite est un simple fichier (`data/licai.db`) lu par l'application.

## Production

```bash
cp .env.example .env     # puis renseigner NEXTAUTH_SECRET (openssl rand -base64 32), NEXTAUTH_URL, SMTP…
make prod-up             # docker compose -f docker-compose.prod.yaml up -d --build
```

- **Secret obligatoire** : en production, l'application refuse de démarrer si `NEXTAUTH_SECRET` est absent, vaut `change-me` ou fait moins de 32 caractères. Il chiffre aussi les clés API IA enregistrées : le changer les rend illisibles (l'app le signale et demande de les ressaisir).
- **Utilisateur non root**, système de fichiers en lecture seule, `no-new-privileges`, contrôle d'état `GET /api/health`.
- **Sauvegardes** : le service `backup` copie la base (API de sauvegarde SQLite, cohérente même en cours d'écriture) toutes les 24 h dans `/app/data/backups`, en gardant les 14 dernières (`BACKUP_INTERVAL_HOURS`, `BACKUP_KEEP`). Sauvegarde immédiate : `make backup`. Restauration : `make restore FILE=/app/data/backups/licai-AAAAMMJJ-HHMMSS.db`.
- Pensez à copier le dossier de sauvegardes **hors de la machine** (le volume `licai_data` contient la base et ses sauvegardes).
- **Inscriptions** : ouvertes par défaut ; `ALLOW_SIGNUP=false` les ferme une fois votre foyer créé (la page « Créer un compte » l'indique, l'API refuse en 403).
- L'application écoute sur `127.0.0.1:3000` : placez-la derrière un reverse proxy HTTPS.

## Import des relevés bancaires

*Transactions → Importer CSV* : chaque banque a son format d'export. Après lecture du fichier (UTF-8 ou Windows-1252, guillemets, lignes d'en-tête de la banque ignorées), l'étape « Colonnes » associe date, libellé et montant (colonne unique, avec option d'inversion du signe, ou débit/crédit séparés) et règle séparateur, format de date et décimale. Le réglage peut être **enregistré comme modèle** (stocké pour le foyer, éventuellement rattaché à une banque) : les exports suivants du même format sont reconnus automatiquement. Les lignes illisibles sont signalées avec leur numéro, et chaque ligne reste modifiable avant l'import. L'onglet **Saisie manuelle** permet de coller des lignes depuis un tableur ou de les saisir à la main.

## Application installable (PWA)

Le service worker (`public/sw.js`, écrit à la main) met en cache uniquement les fichiers statiques et une page hors ligne (`/offline.html`). Les pages et les réponses de l'API ne sont **jamais** stockées par le navigateur : aucune donnée financière sur l'appareil. Il n'est enregistré qu'en production.

## Qualité

```bash
npm run check      # typecheck + ESLint + tests unitaires + npm audit (lancé automatiquement avant chaque commit)
npm run test:e2e   # tests fonctionnels Playwright (lancés en CI, à lancer avant de pousser)
```

La CI (`.github/workflows/ci.yml`) exécute les mêmes contrôles puis les tests e2e.
