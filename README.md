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
- L'application écoute sur `127.0.0.1:3000` : placez-la derrière un reverse proxy HTTPS.

## Qualité

```bash
npm run check      # typecheck + ESLint + tests unitaires + npm audit (lancé automatiquement avant chaque commit)
npm run test:e2e   # tests fonctionnels Playwright (lancés en CI, à lancer avant de pousser)
```

La CI (`.github/workflows/ci.yml`) exécute les mêmes contrôles puis les tests e2e.
