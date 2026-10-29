---
name: Lǐcái
description: Finances personnelles du foyer : un livre de comptes calme, sombre par défaut, vert pour seule voix.
colors:
  primary: "#1D9E75"
  primary-strong: "#178860"
  primary-deep: "#0F6E56"
  accent-amber: "#EF9F27"
  warning: "#f59e0b"
  danger-ember: "#D85A30"
  success-olive: "#639922"
  info-blue: "#378ADD"
  rose: "#D4537E"
  violet: "#7C6BD6"
  night-bg: "#0c0c0e"
  night-surface: "#131316"
  night-card: "#18181c"
  night-card-hover: "#1e1e23"
  night-border: "#27272c"
  night-fg: "#f4f4f5"
  night-fg-secondary: "#a1a1aa"
  night-fg-muted: "#6a6a73"
  day-bg: "#f4f5f7"
  day-card: "#ffffff"
  day-border: "#e7e7ec"
  day-fg: "#15151b"
  day-fg-secondary: "#5b5b66"
  day-fg-muted: "#9a9aa6"
  sidebar-bg: "#0f1117"
  sidebar-fg: "#8b909c"
typography:
  headline:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "14.5px"
    fontWeight: 600
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  figure:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, monospace"
    fontSize: "22px"
    fontWeight: 600
rounded:
  sm: "8px"
  md: "11px"
  lg: "16px"
  xl: "22px"
  pill: "99px"
spacing:
  card-padding: "20px"
  topbar-gap: "26px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-ghost:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.night-fg}"
    rounded: "{rounded.sm}"
    padding: "9px 15px"
  card:
    backgroundColor: "{colors.night-card}"
    rounded: "{rounded.lg}"
    padding: "20px"
  chip:
    backgroundColor: "{colors.night-card}"
    textColor: "{colors.night-fg-secondary}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
  input:
    backgroundColor: "#1a1a1e"
    textColor: "{colors.night-fg}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Lǐcái

## Overview

**Creative North Star: "Le livre de comptes calme"**

Lǐcái se lit comme un registre moderne : des cartes sobres posées sur un fond profond, des bordures d'un pixel plutôt que des ombres, des chiffres qui portent l'information. Le vert (#1D9E75) est la seule voix de la marque ; les autres teintes ne servent qu'à dire un état (alerte, danger, succès) ou à distinguer une série dans un graphique.

Le ton visuel est celui d'une fintech calme : typographie Geist serrée, sidebar toujours sombre qui ancre l'interface dans les deux thèmes. La retenue est la règle : peu d'ornements, hiérarchie par le poids et par les gris, jamais de gamification.

**Key Characteristics:**
- Sombre par défaut (`data-theme="dark"`), thème clair équivalent, sidebar sombre dans les deux.
- Surfaces plates en couches tonales, séparées par des bordures fines.
- Un seul accent (vert) ; couleurs sémantiques réservées au sens.
- Densité confortable : texte courant 13,5 px, base 15 px.

## Colors

Une palette à un accent sur des neutres froids légèrement bleutés.

### Primary
- **Vert jade du foyer** (#1D9E75) : actions principales, lien actif, chip sélectionné, courbes et remplissages de graphique. Survol en **jade profond** (#178860) ; **jade sombre** (#0F6E56) pour les aplats secondaires.

### Secondary
- **Ambre** (#EF9F27) : badges d'avertissement et seconde série de graphique.
- **Braise** (#D85A30) : danger, dépassement de budget, suppression.
- **Olive** (#639922) : succès. **Bleu** (#378ADD) : information. **Rose** (#D4537E) et **Violet** (#7C6BD6) : séries de graphique seulement.

### Neutral
- **Nuit** (#0c0c0e) fond, (#131316) surface, (#18181c) carte, (#1e1e23) carte survolée, (#27272c) bordure ; texte (#f4f4f5), secondaire (#a1a1aa), discret (#6a6a73).
- **Jour** (#f4f5f7) fond, (#ffffff) carte, (#e7e7ec) bordure ; texte (#15151b), secondaire (#5b5b66), discret (#9a9aa6).
- **Encre de sidebar** (#0f1117), texte (#8b909c), actif (#f9fafb) sur fond vert à 14 %.

### Named Rules
**The One Voice Rule.** Le vert est la seule couleur de marque ; il marque l'action et la sélection, jamais la décoration. Les teintes sémantiques n'apparaissent que pour dire un état.

**The Both Themes Rule.** Toute couleur est lue depuis un token qui existe dans les deux thèmes ; aucune valeur claire ou sombre en dur dans un composant.

## Typography

**Display/Body Font:** Geist (repli system-ui, -apple-system)
**Figures/Mono:** Geist Mono (repli ui-monospace, SF Mono)

**Character:** une grotesque géométrique neutre, serrée aux grands corps (−0,4 px), qui laisse parler les montants.

### Hierarchy
- **Headline** (600, 21 px, −0,4 px) : titre d'écran dans la barre supérieure.
- **Title** (600, 14,5 px, −0,2 px) : titre de carte.
- **Body** (400–500, 13,5 px) : contenu, boutons, champs.
- **Label** (500, 12 px, secondaire) : libellés de champ, métadonnées ; notes à 11,5 px en gris discret.
- **Figure** (600, jusqu'à 22 px, Geist Mono) : montants saisis et indicateurs clés.

### Named Rules
**The Numbers Lead Rule.** Les montants sont les plus lourds de la carte ; le reste s'efface en gris.

## Layout

Application à deux colonnes : sidebar fixe sombre (14 px de gouttière) et zone de contenu à cartes. Barre supérieure avec titre, sous-titre secondaire et actions (marge basse 26 px). Les grilles de cartes passent en une colonne sous 768–920 px ; la sidebar cède la place à une barre mobile (PWA). Rythme : cartes à 20 px de padding, espacements de 8 à 16 px à l'intérieur.

## Elevation & Depth

Profondeur par couches tonales : fond → surface → carte, délimitées par une bordure de 1 px. L'ombre de carte est quasi absente (`0 1px 2px rgba(0,0,0,.5), 0 12px 28px -18px rgba(0,0,0,.7)` en sombre) ; l'ombre franche (`0 12px 40px -12px rgba(0,0,0,.45)`) est réservée aux popovers et menus flottants.

### Named Rules
**The Flat-By-Default Rule.** Une carte au repos n'a pas d'ombre visible ; seules les surfaces flottantes en portent.

## Shapes

Coins généreux mais disciplinés : 8 px (boutons, champs), 11 px, 16 px (cartes), 22 px (grandes surfaces), pastille complète 99 px (chips, badges). Bordures de 1 px partout ; aucun trait épais ni décor.

## Components

### Buttons
- **Shape:** coins de 8 px, 9×15 px de padding, texte 13,5 px / 500, icône 17 px.
- **Primary:** fond vert, texte blanc ; survol jade profond ; appui −0,5 px.
- **Ghost:** fond carte, bordure fine ; survol carte survolée. **Danger:** fond braise.
- **Small:** 12,5 px, 7×11 px.

### Chips
- Pastille 99 px, bordure fine, texte secondaire ; survol : bordure et texte renforcés. Sélectionné : fond vert, texte blanc.

### Cards / Containers
- Fond carte, bordure 1 px, rayon 16 px, padding 20 px, pas d'ombre au repos. En-tête : titre 14,5 px à gauche, lien vert 12,5 px à droite.

### Inputs / Fields
- Fond champ (#1a1a1e sombre / #f5f6f8 clair), bordure 1 px, rayon 8 px, 10×12 px. Focus : la bordure passe au vert (aucun halo). Libellé 12 px au-dessus, aide 11,5 px en dessous. Montants en 22 px / 600 avec devise à droite.

### Badges
- Pastille avec fond teinté à 10 % et bordure à 40 % de la teinte sémantique (avertissement, info, danger, succès, neutre).

### Navigation
- Sidebar sombre : items 19 px d'icône (Tabler), texte gris ; survol voilé blanc 4,5 % ; actif : fond vert 14 % et filet vert à gauche. Raccourci ⌘K affiché en pastille mono.

## Do's and Don'ts

### Do:
- **Do** lire chaque couleur depuis un token présent dans les deux thèmes.
- **Do** réserver le vert à l'action et à la sélection.
- **Do** afficher les montants en chiffres lourds, le reste en gris secondaire.
- **Do** séparer les surfaces par une bordure de 1 px.

### Don't:
- **Don't** ajouter d'ombres de carte au repos.
- **Don't** introduire une seconde couleur de marque ou un dégradé décoratif.
- **Don't** utiliser le rouge/braise pour autre chose qu'un état négatif.
- **Don't** utiliser de gamification (badges de réussite, confettis) : l'outil reste sobre.
