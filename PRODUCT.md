# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Foyers français (couple, famille) qui gèrent leurs finances à plusieurs, sur leur propre instance auto-hébergée (Docker). Usage quotidien (saisie, import CSV, suivi du budget) et revue mensuelle (rapport PDF, trajectoire, patrimoine). Utilisation sur ordinateur et sur téléphone (PWA installable).

## Product Purpose
Lǐcái centralise les finances d'un foyer : comptes, transactions, budgets, crédits, immobilier, placements, impôts (barème IR), prévoyance, objectifs, prévisions et partage entre membres. Succès : le foyer comprend où il en est et où il va, sans confier ses données à un tiers.

## Positioning
- Données chez soi : SQLite en fichier, auto-hébergement, import CSV de relevés (pas d'agrégation bancaire tierce), aucune donnée financière stockée sur l'appareil par la PWA.
- Vue foyer complète : budget, patrimoine, crédits, placements, impôts, prévoyance et trajectoire dans un seul outil.
- Assistant IA avec le contexte financier du foyer, clé API propre au foyer.

## Operating Context
Instance Docker derrière un reverse proxy HTTPS ; inscriptions fermables une fois le foyer créé ; sauvegardes automatiques de la base ; e-mails (réinitialisation de mot de passe) via SMTP. Onboarding du foyer avec carte « Premiers pas » et préchoix de catégories/budgets. Démo publique possible (foyer de démonstration).

## Capabilities and Constraints
- Interface en français, devise principale euro (conversion multi-devises disponible), fiscalité française.
- Thèmes sombre (par défaut) et clair ; barre latérale toujours sombre.
- Next.js App Router, SQLite/Drizzle, NextAuth, Chart.js. Écrans : dashboard, transactions, budget, comptes, récurrent, alertes, patrimoine, crédits, placements, impôts, prévoyance, trajectoire, prévisions, objectifs, partage, rapport, paramètres, recherche ⌘K.

## Brand Commitments
Nom « Lǐcái » (理财, gestion financière) avec diacritique. Vert primaire #1D9E75 déjà en place dans le produit. Prototype d'origine : `licai/project/licai-app` (design system porté tel quel dans `app/globals.css`).

## Evidence on Hand
Application complète et testée (Vitest, Playwright e2e). Aucun témoignage, client ou chiffre de marché : ne rien inventer.

## Product Principles
1. La confiance avant tout : les chiffres sont exacts, lisibles et sourcés ; aucune donnée ne quitte le foyer sans que ce soit dit.
2. Du coup d'œil à la décision : chaque écran répond d'abord à « où en sommes-nous ? » puis à « que faire ? ».
3. Le foyer est le sujet, pas l'individu : tout se lit à plusieurs.
4. Sobriété : outil du quotidien, calme, sans gamification ni incitation à dépenser.

## Accessibility & Inclusion
Viser WCAG AA (contraste dans les deux thèmes, navigation clavier, cibles tactiles sur mobile).
