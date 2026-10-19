@AGENTS.md

## Qualité : à lancer avant chaque commit

Toujours exécuter `npm run check` (typecheck, ESLint, tests unitaires, `npm audit`) avant de committer ; le hook `.githooks/pre-commit` le fait automatiquement (activé par `npm install` via le script `prepare`). Ne jamais le contourner avec `--no-verify`.
Avant de pousser, lancer aussi les tests fonctionnels : `npm run test:e2e` (CI : `.github/workflows/ci.yml`).
