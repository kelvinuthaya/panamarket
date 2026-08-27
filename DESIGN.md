---
name: Panam'arket
description: PWA de caisse et gestion de stock pour une épicerie urbaine, ambiance claire "ticket de caisse"
colors:
  paname-100: "#DCE7FF"
  paname-500: "#2557FF"
  paname-700: "#0040DD"
  paname-900: "#001F8C"
  eiffel: "#F5C518"
  pavillon: "#FF2D2D"
  signal: "#00D670"
  signal-dark: "#009955"
  calcaire: "#F5F4EE"
  bitume: "#0A0A0F"
  bitume-2: "#14141C"
  bitume-3: "#1F1F2C"
typography:
  display:
    fontFamily: "Bricolage Grotesque, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.paname-700}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.paname-900}"
  button-gold:
    backgroundColor: "{colors.eiffel}"
    textColor: "#422006"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.pavillon}"
    textColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bitume}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  card-default:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-rupture:
    backgroundColor: "{colors.pavillon}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  badge-ok:
    backgroundColor: "{colors.signal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
---

# Design System: Panam'arket

## Overview

**Creative North Star: "Le Ticket de Caisse"**

Net et fonctionnel : l'app doit se lire comme un reçu de caisse bien imprimé, pas comme un tableau de bord SaaS générique. Fond clair calcaire partout, chiffres tabulaires parfaitement alignés (prix, stocks, totaux), petites étiquettes mono en majuscules façon code de caisse (`tag-street`), et une seule vraie zone de couleur : les statuts (rupture, faible, ok) et les actions principales.

**Rejet visuel confirmé** : plus d'écran plein sombre en dehors de la Sidebar (Login, Caisse et Historique quittent leur ancien traitement dark "PANAME OS" pour rejoindre cette ambiance claire, cf. `PRODUCT.md`). Pas de gradients ou d'ombres colorées "glow" qui ne s'appuient pas sur les tokens ci-dessus.

**Key Characteristics:**
- Fond calcaire (#F5F4EE) quasi-partout ; blanc pur réservé aux cards/surfaces posées dessus.
- Une seule exception dark assumée : la Sidebar (NavRail 88px), pour la lisibilité du logo.
- Couleur = signal fonctionnel avant tout (statut, action), jamais décoratif pur.
- Typo mono uppercase serrée (`tag-street`) pour tous les libellés secondaires/contextuels.
- Chiffres (prix, stock, quantités) toujours en `tabular-nums` (classe `.tabular`).

## Colors

Palette franche et contrastée, façon étiquettes de prix sur un étal — chaque couleur porte un rôle unique, jamais interchangeable.

### Primary
- **Bleu Marché** (`#0040DD`, `paname-700`) : couleur d'action principale — boutons primaires, liens actifs, nav active, focus des champs. Le `paname-500` (`#2557FF`) sert aux dégradés/hover, le `paname-900` (`#001F8C`) au hover des boutons pleins, le `paname-100` (`#DCE7FF`) aux fonds légers d'info.

### Secondary
- **Or Signal** (`#F5C518`, `eiffel`) : alerte "stock faible" et accent doré rare (badge gérant, CTA doré ponctuel). Utilisé avec du texte quasi-noir (`#422006`) dessus, jamais du blanc.

### Tertiary
- **Rouge Rupture** (`#FF2D2D`, `pavillon`) : rupture de stock, danger, suppression. Réservé aux vrais états critiques.
- **Vert Validé** (`#00D670`, `signal`) : statut "ok"/succès uniquement.

### Neutral
- **Calcaire** (`#F5F4EE`) : fond de page par défaut (`body`), partout sauf Sidebar.
- **Bitume** (`#0A0A0F`) : texte par défaut sur fond clair *et* fond de la Sidebar (seule zone dark assumée). Ne pas réutiliser comme fond plein écran ailleurs.
- **Blanc** (`#FFFFFF`) : surface des cards, inputs, modales posées sur le calcaire.

### Named Rules
**La Règle de la Couleur Rare.** Une seule couleur d'accent forte par écran à la fois (bleu OU or OU rouge OU vert selon le contexte) — ne jamais empiler plusieurs accents saturés côte à côte hors contexte de statut.

**La Règle du Glow Assumé.** Les ombres colorées (`shadow-paname`, `shadow-or`, `shadow-rouge`) sont réservées aux actions principales (CTA héros, bouton de validation) — jamais posées sur un élément décoratif sans fonction.

## Typography

**Display Font:** Bricolage Grotesque (avec fallback `sans-serif`)
**Body Font:** Geist (avec fallback `sans-serif`)
**Label/Mono Font:** JetBrains Mono (avec fallback `monospace`)

**Character:** Un display à forte présence pour les titres et les gros chiffres (prix, totaux, stock), un texte courant en Geist neutre et lisible, et un mono serré en majuscules pour tout ce qui est étiquette/statut — l'effet recherché est celui d'un ticket de caisse imprimé, pas d'une interface éditoriale.

### Hierarchy
- **Display** (700, `text-3xl`/`text-4xl` selon contexte, 1.2) : titres de page, gros chiffres (CA, stock, prix), toujours avec `.tabular` sur les chiffres.
- **Body** (400, `text-sm`/`text-base`, 1.5) : texte courant, listes, descriptions.
- **Label** (600, `text-[10px]`, tracking `0.08em`, UPPERCASE — classe `.tag-street`) : sur-titres de section, badges, tabs, libellés contextuels (gamme, DLC, code-barres).

### Named Rules
**La Règle du Chiffre Aligné.** Tout chiffre monétaire ou de quantité affiché dans l'UI utilise `.tabular` (`font-variant-numeric: tabular-nums`) — jamais de chiffres proportionnels sur un prix ou un stock.

## Layout

Grille mobile-first en une colonne (cards empilées), qui passe en mode POS tactile au-delà du breakpoint `lg:` (1024px) : Sidebar fixe 88px + contenu principal. Spacing interne dominant en pas de 12-16px (`p-3`/`p-4`, `gap-3`), pages avec `p-6`/`gap-6` pour l'aération de premier niveau. Les vues plein écran (Caisse, Historique) gèrent leur propre scroll interne (`lg:overflow-hidden` + `.pos-scroll`) plutôt que de faire défiler la page entière.

## Elevation & Depth

Système hybride : les surfaces sont **flates au repos** (cards blanches avec un simple `border border-bitume/5`, pas d'ombre par défaut). L'élévation n'apparaît qu'en réponse à une interaction (hover desktop : `-translate-y-0.5` + `shadow-md`) ou comme signature de marque sur les actions principales, via des ombres colorées diffuses (glows).

### Shadow Vocabulary
- **Glow Bleu** (`shadow-paname` : `0 0 0 1px rgba(0,64,221,.3), 0 8px 32px -4px rgba(0,64,221,.4)`) : bouton primaire, CTA héros.
- **Glow Or** (`shadow-or`, même formule en jaune) : bouton doré (validation, action gérant).
- **Glow Rouge** (`shadow-rouge`, même formule en rouge) : bouton danger (suppression, alerte).

### Named Rules
**La Règle du Plat-Par-Défaut.** Aucune ombre au repos sur les cards standards ; l'ombre est toujours une réponse à un état (hover, action principale), jamais un décor statique.

## Shapes

Coins très arrondis et cohérents par taille de composant : `rounded-xl`/`16px` pour les cards et boutons standards (la valeur signature du système), `rounded-lg`/`12px` pour les conteneurs secondaires (tabs, petits inputs), `rounded-md`/`8px` pour les micro-éléments (steppers +/-), `rounded-3xl`/`24px` pour les grandes surfaces (hero Dashboard, feuilles modales), `rounded-full` pour les pills et pastilles de statut. Les cards de statut portent une bordure colorée fine **à gauche uniquement** (1px), jamais un contour complet.

### Named Rules
**La Règle de la Bordure Gauche.** Un statut (rupture/faible/ok) se signale par un trait de 1px sur le bord gauche de la card, jamais par un fond ou un contour complet coloré — la surface reste blanche.

## Components

### Buttons
- **Shape:** `rounded-2xl` (16px), toujours.
- **Primary:** fond `paname-700`, texte blanc, `shadow-paname`, hover `paname-900`.
- **Gold:** fond `eiffel`, texte quasi-noir (`yellow-950`), `shadow-or`, gras — réservé aux actions gérant/validation.
- **Danger:** fond `pavillon`, texte blanc, `shadow-rouge` — suppression, alerte.
- **Ghost:** transparent, bordure `bitume/10`, texte `bitume` — action secondaire.
- **Tactile:** cible tactile 48px minimum (`h-12`), 56px (`size="pos"`) pour les actions fréquentes de caisse. Chaque variante répond à `active:` (scale + assombrissement) en plus de `hover:`, car l'écran principal est tactile sans survol possible.

### Badges
- **Style:** `tag-street` (mono, uppercase, 10px, tracking serré), `px-2.5 py-1`, `rounded-md`.
- **Variantes:** rupture (rouge/blanc), faible (or/quasi-noir), ok (vert/blanc), info (bleu/blanc).

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px).
- **Background:** blanc, posé sur fond calcaire.
- **Border:** `border border-bitume/5` (quasi invisible au repos).
- **Shadow Strategy:** aucune au repos ; `shadow-md` + léger décollement au hover (desktop uniquement).
- **Statut:** bordure gauche 1px colorée (voir Shapes), jamais de fond teinté.
- **Internal Padding:** 16px (`p-4`), contenu décalé de `pl-2` si bordure de statut présente.

### Inputs / Fields
- **Style:** fond blanc, bordure `border-bitume/10`, `rounded-2xl`, hauteur 48px (`h-12`).
- **Focus:** bordure `paname-700`, pas de glow — le focus reste sobre, le glow est réservé aux CTA.

### Navigation
- **Sidebar (NavRail, exception dark) :** 88px, fond `bitume`, icône + libellé `tag-street` empilés, lien actif en fond `paname-700`.
- **BottomNav / TopBar (mobile, <lg):** fond clair, mêmes règles de couleur que le reste de l'app — pas d'exception dark en dehors de la Sidebar.

### StatusDot (signature)
Pastille 8px colorée selon statut avec halo pulsant optionnel (`.animate-status-pulse`) — utilisée pour signaler un état "vivant" (ex. rupture active) plutôt qu'un simple badge statique.

## Do's and Don'ts

### Do:
- **Do** garder le fond `calcaire` comme fond de page par défaut, y compris sur Login/Caisse/Historique une fois migrés.
- **Do** utiliser `.tabular` sur tout chiffre de prix, stock ou quantité.
- **Do** réserver les ombres colorées (glow) aux actions principales, pas à la décoration.
- **Do** signaler un statut par une bordure gauche 1px, jamais par un fond plein coloré sur une card.
- **Do** garantir `active:` sur tout élément tactile de la caisse, en plus (ou à la place) du `hover:`.

### Don't:
- **Don't** recréer un écran plein `bg-bitume` en dehors de la Sidebar — c'est l'ancien système en cours de retrait.
- **Don't** ajouter de gradient ou d'ombre colorée qui ne correspond à aucun token de `tailwind.config.js`.
- **Don't** mélanger plusieurs accents saturés (bleu + or + rouge) sur un même bloc hors contexte de statuts multiples.
- **Don't** utiliser une couleur d'accent sur plus de ~10% de la surface d'un écran donné — sa rareté fait sa force.
