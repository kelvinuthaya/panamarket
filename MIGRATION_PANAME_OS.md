# 🎨 Migration → PANAME OS

> Plan d'exécution complet. Chaque étape contient un **prompt copy-paste-ready** pour Claude Code, ce qui doit se passer, et comment vérifier. Ordre à respecter.

---

## 📍 Récap palette (à garder sous la main)

```
paname-700  #0040DD  ← héros, CTA primaires
paname-500  #2557FF  ← bleu vif pour glows / hover
paname-900  #001F8C  ← deep blue
paname-100  #DCE7FF  ← backgrounds légers
eiffel      #F5C518  ← or signal (rare !)
pavillon    #FF2D2D  ← rouge pop, ruptures
bitume      #0A0A0F  ← noir profond, dark mode
bitume-2    #14141C  ← surfaces dark
calcaire    #F5F4EE  ← off-white, fond principal
signal      #00D670  ← vert OK
```

Fonts : `Bricolage Grotesque` (display) · `Geist` (body) · `JetBrains Mono` (mono)

---

## 🟢 Étape 1 — Setup des tokens design

> **Objectif** : poser les fondations couleurs + fonts. Aucun écran ne change visuellement encore, on prépare juste le terrain.

### 📋 Prompt à coller dans Claude Code

```
Mets en place le design system "PANAME OS" pour Panam'arket. Trois choses à faire :

1. Mets à jour `tailwind.config.js` en étendant le theme avec ces tokens :
   - Couleurs : ajoute les palettes paname (100, 500, 700, 900), eiffel, pavillon, bitume (DEFAULT, "2", "3"), calcaire, signal avec les hex suivants :
     - paname.100: '#DCE7FF', paname.500: '#2557FF', paname.700: '#0040DD', paname.900: '#001F8C'
     - eiffel: '#F5C518'
     - pavillon: '#FF2D2D'
     - bitume.DEFAULT: '#0A0A0F', bitume.2: '#14141C', bitume.3: '#1F1F2C'
     - calcaire: '#F5F4EE'
     - signal.DEFAULT: '#00D670', signal.dark: '#009955'
   - fontFamily : display = ['Bricolage Grotesque', 'sans-serif'], sans = ['Geist', 'sans-serif'], mono = ['JetBrains Mono', 'monospace']
   - Ajoute des box-shadows custom : 'paname' (0 0 0 1px rgba(0,64,221,0.3), 0 8px 32px -4px rgba(0,64,221,0.4)), 'or' (idem en jaune), 'rouge' (idem en rouge)

2. Dans `index.html`, ajoute dans le <head> les preconnect et le <link> Google Fonts pour Bricolage Grotesque (400-800), Geist (400-700) et JetBrains Mono (400-600).

3. Dans `src/index.css` (ou `src/main.css` selon ton arbo), ajoute :
   - Une règle `body { @apply font-sans bg-calcaire text-bitume; }` dans @layer base
   - Une classe utilitaire `.tag-street` avec : font-mono, font-semibold, text-[10px], tracking-[0.08em], uppercase
   - Une classe utilitaire `.tabular` avec font-variant-numeric: tabular-nums

Avant de modifier quoi que ce soit, lis d'abord les 3 fichiers concernés et confirme la structure actuelle. Ne casse aucune classe existante : on ajoute, on ne remplace pas.
```

### ✅ Ce qui doit se passer
- `tailwind.config.js` étendu (pas remplacé)
- Fonts chargées dans `index.html`
- Classes utilitaires `.tag-street` et `.tabular` disponibles partout
- Le body adopte automatiquement Geist en font par défaut

### 🔍 Vérification
Dans n'importe quel composant existant, ajoute temporairement `<div className="bg-paname-700 text-eiffel font-display text-4xl">Test</div>` et lance `npm run dev`. Si tu vois un fond bleu cobalt, du texte jaune doré, et le texte en Bricolage Grotesque → c'est good.

---

## 🟢 Étape 2 — Composants atomiques (UI kit)

> **Objectif** : créer les briques réutilisables (Button, Badge, Tag, Card, StatusDot). Une fois faites, tous les écrans suivants les utilisent.

### 📋 Prompt à coller dans Claude Code

```
Crée les composants UI atomiques de PANAME OS dans `src/components/ui/`. Si le dossier existe déjà, ajoute-les dedans, sinon crée-le.

Composants à créer (un fichier .jsx par composant, exports nommés) :

1. **Button.jsx** — props : variant ('primary' | 'gold' | 'danger' | 'ghost' | 'dark'), size ('sm' | 'md' | 'lg'), children, onClick, disabled, type
   - primary : bg-paname-700, text-white, shadow-paname (effet glow), hover:bg-paname-900
   - gold : bg-eiffel, text-yellow-950, shadow-or, font-bold
   - danger : bg-pavillon, text-white, shadow-rouge
   - ghost : bg-transparent, border-2 border-bitume/10, text-bitume, hover:bg-bitume/5
   - dark : bg-bitume-2, text-white, border border-white/10, hover:bg-bitume-3
   - Toujours : rounded-2xl, font-semibold, transition, padding selon size
   - tag-street UPPERCASE seulement sur la variante 'primary' large

2. **Badge.jsx** — props : variant ('rupture' | 'faible' | 'ok' | 'info'), children
   - rupture : bg-pavillon text-white "tag-street"
   - faible : bg-eiffel text-yellow-950 "tag-street"
   - ok : bg-signal text-white "tag-street"
   - info : bg-paname-700 text-white "tag-street"
   - Toutes : px-2.5 py-1 rounded-md inline-flex items-center gap-1.5

3. **StatusDot.jsx** — props : variant ('rupture' | 'faible' | 'ok' | 'info'), pulse (boolean, default true)
   - Petite pastille 8px ronde colorée selon variant
   - Si pulse=true, ajoute un anneau pulsant via @keyframes pulse (à ajouter dans index.css si pas encore là)

4. **Card.jsx** — props : variant ('default' | 'rupture' | 'faible' | 'ok'), children, className
   - default : bg-white rounded-2xl border border-bitume/5 p-4
   - Variantes "rupture/faible/ok" : ajoute une bordure colorée à GAUCHE (1px width via div absolute), pas tout autour
   - Le contenu prend pl-2 pour ne pas chevaucher la bordure

5. **Tag.jsx** — props : color (hex string ou nom), children
   - Style "tag-street" : font-mono uppercase tracking-wider text-[10px] font-semibold
   - rounded-md, px-2 py-1
   - Si color est passé, utilise cette couleur de fond

Pour chaque composant : commence par lire les composants existants dans `src/components` pour respecter la convention de code (CamelCase imports, exports, etc.). Ajoute des PropTypes ou commentaires JSDoc minimaux.

Ne touche pas aux écrans existants pour l'instant. Confirme la création des 5 fichiers à la fin.
```

### ✅ Ce qui doit se passer
- 5 fichiers dans `src/components/ui/`
- Chaque composant est testable isolément
- Aucun écran existant n'est modifié

### 🔍 Vérification
Dans n'importe quel écran, importe et affiche tous les variants :
```jsx
<Button variant="primary">Test</Button>
<Button variant="gold">★ Test</Button>
<Badge variant="rupture">RUPT</Badge>
<Card variant="rupture">Contenu</Card>
```
Si tout s'affiche conforme à la maquette → étape suivante.

---

## 🟢 Étape 3 — Layout shell (AppShell + Nav)

> **Objectif** : refondre la coquille de l'app. Bottom nav mobile fixée correctement (safe area + 100dvh), sidebar dark sur desktop, drawer pour le menu secondaire.

### 📋 Prompt à coller dans Claude Code

```
Refais le shell de l'application Panam'arket pour qu'il soit responsive PANAME OS-compliant. 

Crée ou modifie ces fichiers dans `src/components/layout/` :

1. **AppShell.jsx** — Composant racine wrapping tous les écrans authentifiés. 
   - Détecte mobile vs desktop via Tailwind (md: breakpoint)
   - Mobile : affiche TopBar en haut + BottomNav en bas + le contenu au milieu en min-h-[100dvh] avec padding-bottom pour que le contenu ne passe pas sous la nav
   - Desktop (md:) : affiche Sidebar à gauche fixe (240px) + le contenu à droite
   - Le main content a un padding global cohérent

2. **BottomNav.jsx** — Mobile uniquement
   - 4 onglets : Catalogue (📦), Achats (🛒), Caisse (💰), Dashboard (📊) avec lucide-react icons (Package, ShoppingCart, Wallet, BarChart3)
   - Fond bg-bitume, position fixed bottom-0, padding-bottom: env(safe-area-inset-bottom) via style inline
   - L'onglet actif a un fond bg-paname-700, rounded-xl, padding, et le label en tag-street blanc
   - Les onglets inactifs : icône grise opacity-50, label tag-street opacity-50
   - useLocation de react-router pour détecter l'onglet actif

3. **TopBar.jsx** — Mobile uniquement
   - Hauteur fixe (env safe-area-inset-top + 56px), bg-calcaire
   - Affiche : titre de la page (passé en prop ou via context), bouton Menu (icône Menu de lucide-react) à droite
   - Le bouton Menu ouvre un Drawer (utilise un useState local + un composant Drawer simple)

4. **Drawer.jsx** — Drawer/Sheet qui slide depuis la droite
   - Background : bg-bitume, text-white
   - Contient des liens vers : Gestion produits, Import caisse, Utilisateurs (si rôle gérant), Mon profil, Déconnexion
   - Utilise des conditions sur le rôle utilisateur depuis le contexte d'auth Supabase
   - Animation slide via classes Tailwind translate-x-full → translate-x-0
   - Backdrop bg-black/40 derrière, click pour fermer

5. **Sidebar.jsx** — Desktop uniquement (md:)
   - Width 240px fixe, bg-bitume text-white, full height
   - En haut : logo "Panam'arket" en font-display font-bold + tag-street "75020 · BELLEVILLE"
   - Liens principaux : Dashboard, Catalogue, Achats, Caisse, Gestion (avec icônes lucide-react)
   - Lien actif : bg-paname-700 (gradient possible) avec text-white font-semibold
   - Liens inactifs : text-zinc-400 hover:bg-white/5 hover:text-white
   - Séparateur après les 5 principaux + 2 liens secondaires (Import caisse, Utilisateurs)
   - En bas : avatar utilisateur (initiales sur fond gradient-paname) + nom + rôle en tag-street eiffel pour gérant

IMPORTANT pour la bottom nav (mon point précédent) :
- Le main content doit utiliser min-h-[100dvh] (pas 100vh) pour gérer la barre Safari
- La bottom nav doit avoir style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
- Le main doit avoir paddingBottom calc(64px + env(safe-area-inset-bottom)) pour que le contenu défile correctement

Lis d'abord la structure existante du routing (probablement App.jsx ou main.jsx) pour comprendre où injecter AppShell. Ne casse pas le routing existant.
```

### ✅ Ce qui doit se passer
- Bottom nav s'affiche correctement sur iPhone avec home indicator (pas de chevauchement)
- Drawer s'ouvre depuis la droite quand on clique sur Menu
- Sidebar desktop visible à partir de 768px
- Aucun écran existant cassé (le contenu apparaît juste dans le nouveau shell)

### 🔍 Vérification
- Ouvre dev tools, mode iPhone 14 Pro avec barre dynamique
- Vérifie que le contenu n'est pas masqué par la nav du bas
- Resize > 768px : le shell switch en mode sidebar
- Clique sur le menu burger : drawer slide depuis la droite

---

## 🟢 Étape 4 — Migration Login + Caisse (les 2 écrans dark)

> **Objectif** : refaire le login et la caisse en dark mode. Ce sont les 2 écrans à fort impact visuel, on les fait ensemble pour valider le pattern dark.

### 📋 Prompt à coller dans Claude Code

```
Migre les écrans Login et Caisse vers le style PANAME OS en dark mode.

ÉCRAN 1 — Login (probablement `src/pages/Login.jsx` ou similaire)

Refonte complète :
- Background : bg-bitume avec 3 splashes SVG décoratifs (rouge, bleu, or) en circles avec radialGradient et opacity 0.4-0.6, positionnés en absolute aux 3 coins
- En haut : logo "Panam'arket" en font-display text-6xl font-bold text-white avec "arket" en italic gradient bleu-violet (utilise un className dégradé bg-gradient-to-r from-paname-700 to-violet-600 bg-clip-text text-transparent)
- Sous le logo : tag-street text-eiffel "75020 · BELLEVILLE · OS"
- Le formulaire est dans une carte BLANCHE (bg-white) avec rounded-3xl p-6, ombre forte (shadow-paname)
- Inputs : style minimaliste avec border-b-2 border-zinc-200, focus:border-paname-700, padding y-2, pas de label visible mais placeholder
- Bouton "Entrer" : bg gradient paname-700 → paname-500, text-white, font-bold tag-street UPPERCASE, glow-paname (shadow custom), full width, rounded-2xl, py-3.5
- Footer : font-mono text-[10px] text-white/30 "v1.4.0 · NF 525 ready · Made in 75020"
- Garde EXACTEMENT la même logique de submit Supabase Auth qui existe déjà — tu changes que le visuel.

ÉCRAN 2 — Caisse (probablement `src/pages/Caisse.jsx`)

Refonte avec dark mode :
- Background principal : bg-bitume (l'écran entier)
- Header en haut : 
  - À gauche : tag-street text-eiffel "CAISSE · MODE SOIR" + dessous l'heure en font-display text-3xl font-bold text-white
  - À droite : bouton "📊 RÉCAP" style bg-eiffel text-yellow-950 px-3 py-2 rounded-xl tag-street
- Barre de recherche + bouton scan :
  - Search : bg-white/5 border border-white/10 rounded-2xl px-3 py-3 text-white avec icône search
  - Scan button : w-12 h-12 rounded-2xl gradient bg-gradient-to-br from-paname-700 to-paname-500 + glow-paname
- Panier (le contenu principal qui défile) :
  - Section header : tag-street text-zinc-500 "PANIER · X ARTICLES"
  - Chaque ligne produit : bg-bitume-2 rounded-2xl p-3 border border-white/5
    - À gauche : nom du produit en font-display font-bold text-sm text-white + ligne mono text-[10px] text-zinc-500 avec prix unitaire et TVA
    - À droite : trio bouton-− / chiffre / bouton-+
      - Bouton − : w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white
      - Chiffre : font-display tabular text-lg font-bold w-6 text-center text-white
      - Bouton + : w-8 h-8 rounded-lg avec gradient paname text-white
- Footer sticky en bas (au-dessus de la bottom nav) :
  - bg-bitume-2 avec border-top: 2px solid eiffel
  - Total : flex avec "TOTAL" tag-street à gauche et le montant en font-display text-4xl font-bold tabular text-white à droite, le "€" en text-eiffel
  - Boutons CB / Cash : 2 boutons côte à côte. Actif = gradient-paname glow-paname, inactif = bg-white/5 border border-white/10
  - Bouton VALIDER LA VENTE → : full width, bg-eiffel, text-yellow-950, font-bold tag-street UPPERCASE, glow-or, rounded-2xl py-3.5

IMPORTANT : 
- Ne change AUCUNE logique métier (calcul total, validation Supabase, génération PDF jsPDF, mailto, persistance localStorage, scan ZXing)
- Garde tous les hooks et useEffect existants
- Tu ne modifies QUE le JSX et les classNames
- Si tu vois des composants imbriqués (genre ProduitRow), refais-les aussi en respectant le style

Avant de coder, lis intégralement le fichier de chaque écran pour identifier la logique à préserver. Liste-moi en commentaire en haut du fichier les hooks/fonctions critiques que tu as identifiés et conservés.
```

### ✅ Ce qui doit se passer
- Login en dark avec splashes colorés et form blanc qui pop
- Caisse en dark, contenu lisible, total en gros
- Toutes les fonctions existantes (PDF, Supabase, scan) intactes

### 🔍 Vérification
- Login : connecte-toi, ça doit fonctionner exactement comme avant
- Caisse : ajoute un produit au panier, valide une vente, vérifie que le PDF se génère et que la transaction est enregistrée en base. Si oui → étape suivante.

---

## 🟢 Étape 5 — Migration Catalogue + Achats + Dashboard

> **Objectif** : refaire les 3 écrans en mode clair (calcaire). Pattern différent du dark : cards bord coloré gauche, badges sticker, gros chiffres.

### 📋 Prompt à coller dans Claude Code

```
Migre les 3 écrans Catalogue, Achats et Dashboard vers PANAME OS (mode clair).

PATTERN COMMUN à tous les 3 :
- Background : bg-calcaire (déjà appliqué via body)
- Header de page : tag-street text-zinc-400 (sous-titre/contexte) + font-display text-3xl font-bold (titre)
- Cards : bg-white rounded-2xl border border-bitume/5
- Cards avec statut : bordure GAUCHE de 1px colorée (pas tout autour) — utilise le composant Card de l'étape 2
- Badges : utiliser le composant Badge de l'étape 2 (rupture/faible/ok)
- Boutons primaires : composant Button variant primary
- Tous les chiffres (stocks, prix) en font-display tabular pour les gros + font-mono tabular pour les petits

ÉCRAN 1 — Catalogue / Ruptures (probablement `src/pages/Catalogue.jsx` ou `Ruptures.jsx`)
- Filtres en pills horizontales scrollables :
  - "● 7 RUPTURES" : bg-pavillon text-white tag-street avec glow-rouge si actif
  - "⚠ 14 INSUFF." : bg-eiffel text-yellow-950 tag-street
  - "✓ 28 OK" : bg-white border tag-street text-zinc-700 (actif: bg-signal text-white)
  - "TOUS" : bg-white border
- Search bar : bg-white rounded-2xl px-4 py-3 border avec icône search lucide-react
- Liste produits : utilise Card variant selon le statut, à l'intérieur :
  - Header : flex avec titre (font-display font-bold) + Badge statut à droite
  - Sous-titre : font-mono text-[10px] text-zinc-500 (gamme + DLC ou code-barres)
  - Footer : flex justify-between, à gauche stock en gros (font-display tabular text-3xl font-bold colorée selon statut + "/X" en font-mono text-zinc-400), à droite prix en font-display tabular text-xl font-bold

ÉCRAN 2 — Achats (probablement `src/pages/Achats.jsx`)
- Tabs en haut : container bg-white rounded-2xl p-1 border, 3 boutons
  - Actif : bg-paname-700 text-white tag-street rounded-xl
  - Inactif : tag-street text-zinc-500
  - 3 onglets : LISTE / RÉCEPT. / HISTO.
- Section "À acheter" :
  - Header section : StatusDot pulsant rouge + tag-street "À ACHETER · X RUPTURES" en text-pavillon
  - Items : Card avec checkbox custom à gauche (cercle 24px border-2 border-pavillon, rempli + check blanc si coché), nom produit + "Manque X unités" en mono petit
  - Items cochés : ligne barrée + opacity-40 + check rempli
- Section "À surveiller" : même pattern avec StatusDot eiffel et text-yellow-700
- FAB en bas-droit : bouton 56x56 rounded-2xl gradient-paname glow-paname avec icône caméra (lucide-react Camera)
- Onglet Réception (quand sélectionné) : remplace la liste par le scanner ZXing existant — garde la logique, change juste le style du bouton et la zone d'affichage

ÉCRAN 3 — Dashboard (probablement `src/pages/Dashboard.jsx`)
- Sélecteur de mois : 3 boutons côte à côte (◀ AVR / MAI 2026 / JUIN ▶), le mois actif en gradient-paname text-white tag-street, les autres bg-white border tag-street text-zinc-600
- HERO POSTER (la grande card du CA) :
  - bg-paname-700 (cobalt pur) rounded-3xl p-8 text-white relative overflow-hidden
  - Décoratif : un énorme "€" en text-white/10 text-[300px] font-display font-bold absolute top-right
  - Splash SVG radial gradient eiffel en absolute bottom (opacity 0.4)
  - Layout grid 3 colonnes : 2 colonnes pour le CA, 1 colonne pour la répartition TVA
  - CA : tag-street "CA · MAI 2026" en text-white/60 puis font-display text-7xl font-bold tabular leading-none avec € en text-eiffel et les centimes en text-blue-300 text-3xl
  - Sous le CA : badge "↗ +X%" en bg-eiffel text-yellow-950 tag-street + texte secondaire en text-blue-200
  - Répartition TVA : 3 lignes avec petite pastille colorée + label + montant tabulaire à droite
- 3 stat cards en dessous :
  - Articles vendus : bg-white rounded-2xl, tag-street zinc-400 "ARTICLES VENDUS", font-display text-4xl font-bold tabular, mono text-xs en bas
  - Ruptures : bg-pavillon text-white avec un gros "X" en text-white/10 absolute en arrière-plan
  - Faibles : bg-eiffel text-yellow-950 même pattern
- Chart + Top 5 en grid 2 colonnes :
  - Chart : bg-white rounded-2xl avec barres 7 jours, chaque barre stackée (alim paname-700 + alcool pavillon), le jour actuel a un ring-2 ring-eiffel et une étoile au-dessus
  - Top 5 : bg-white rounded-2xl, chaque ligne avec rang (1 sur fond eiffel, autres sur fond zinc-200) + nom font-display font-bold + ventes en mono petit + montant en mono tabular bold

IMPORTANT :
- Tous les hooks Supabase, calculs, useEffect, useMemo restent identiques
- Tu refais UNIQUEMENT le JSX et les classNames
- Pour Recharts dans Dashboard : configure les colors du BarChart pour utiliser nos tokens (paname-700 et pavillon)
- Lis chaque fichier en entier d'abord, identifie la logique à préserver, puis migre

Confirme à la fin les fichiers modifiés et lance npm run dev pour vérifier qu'aucune erreur n'apparaît.
```

### ✅ Ce qui doit se passer
- 3 écrans clés en mode calcaire avec personnalité PANAME OS
- Le hero poster du Dashboard est l'élément le plus impactant visuellement
- Tous les filtres / tabs / interactions fonctionnent comme avant

### 🔍 Vérification
- Catalogue : applique chaque filtre, vérifie que les données filtrent correctement
- Achats : coche un produit, vérifie qu'il passe en réception
- Dashboard : navigue entre mois, vérifie que les stats se mettent à jour

---

## 🟢 Étape 6 — Migration Gestion produits + Polish final

> **Objectif** : finaliser avec le tableau Gestion (desktop-first) et ajouter les détails qui font la diff.

### 📋 Prompt à coller dans Claude Code

```
Finalise la migration PANAME OS avec 2 chantiers :

CHANTIER 1 — Gestion produits (probablement `src/pages/Gestion.jsx`)

C'est principalement un écran desktop pour Christian. Mobile = stack vertical des cards.

DESKTOP :
- Header : titre "Gestion produits" en font-display text-3xl + tag-street "CRUD · X PRODUITS"
- Boutons droite : "📥 IMPORT" en variant ghost + "+ NOUVEAU" en variant primary
- Filtres : search bar pleine largeur + 2 selects (Toutes gammes / Tous statuts) en bg-white border
- Tableau : 
  - Header bg-calcaire avec colonnes en tag-street text-zinc-500 : Produit / Code-barres / Gamme / Stock / Prix / Statut
  - Lignes : border-t border-zinc-100, hover:bg-zinc-50, transition
  - Cellule Produit : font-display font-bold
  - Cellule Code-barres : font-mono text-xs text-zinc-500
  - Cellule Stock : font-mono tabular text-right font-bold colorée selon statut (rouge / yellow / signal)
  - Cellule Prix : font-mono tabular text-right font-semibold
  - Cellule Statut : Badge composant centré
  - Actions ⋯ à droite : bouton ghost qui ouvre un menu modifier/supprimer

MOBILE :
- Header sticky avec titre + bouton "+" en cercle gradient-paname
- Liste de cards (réutilise Card composant) avec : nom + Badge statut, sous-titre code-barres + gamme, ligne stock + prix, swipe-to-action OU 2 boutons en bas de chaque card (Modifier / Supprimer en variant ghost et danger)

CHANTIER 2 — Polish final (sur tous les écrans déjà migrés)

Ajoute les micro-détails qui rendent l'app vivante :

1. **Texture grain** sur les fonds dark uniquement :
   - Ajoute dans index.css une classe .bg-grain qui applique un noise SVG via background-image (data URI)
   - Applique-la sur tous les bg-bitume (header de Login, sidebar, caisse, etc.)
   - L'effet doit être très subtil (opacity 0.6 mix-blend-mode overlay)

2. **Animation pulse sur les status dots actifs** :
   - Ajoute @keyframes pulse dans index.css avec un effet de halo qui se diffuse
   - Le composant StatusDot doit déjà la consommer (Étape 2)

3. **Hover lift sur les cards** :
   - Sur desktop uniquement (md:), les cards de produit ont un transition + transform translateY(-2px) au hover + shadow plus prononcée

4. **Smooth scroll** : html { scroll-behavior: smooth } dans index.css

5. **Transition de page** : sur les routes principales, ajoute une animation fade simple (Framer Motion serait idéal mais si pas installé, juste une classe CSS animation fade-in 200ms)

6. **Empty states** : pour le panier vide (Caisse), la liste de courses vide (Achats), le catalogue vide après filtre — au lieu d'un truc générique, mets une illustration emoji + texte tag-street + suggestion d'action.

7. **Vérifie l'accessibilité de base** : tous les boutons ont aria-label si pas de texte, contrastes texte/fond suffisants en dark mode (text-white sur bitume = OK, mais text-zinc-400 sur bitume-2 doit être vérifié).

À la fin, génère un récap markdown avec :
- Liste des fichiers modifiés/créés depuis l'étape 1
- Capture d'écran (instruction pour moi de prendre les screenshots)
- TODO list des points pas encore migrés (s'il en reste)
- Suggestions pour les prochaines évolutions
```

### ✅ Ce qui doit se passer
- Gestion produits : tableau dense desktop, cards stackées mobile
- Texture, animations, hovers, transitions partout
- App qui ne ressemble plus du tout à du Tailwind par défaut

### 🔍 Vérification
- Compare un screenshot avant/après sur les 6 écrans : ça doit être un avant/après spectaculaire
- Lance Lighthouse, score perf doit rester > 80, accessibilité > 90

---

## 🎯 Récap des 6 étapes

| # | Étape | Durée estimée | Fichiers touchés |
|---|---|---|---|
| 1 | Tokens | 15 min | tailwind.config, index.html, index.css |
| 2 | Composants UI | 30 min | 5 nouveaux fichiers dans `components/ui/` |
| 3 | Layout shell | 45 min | 5 fichiers dans `components/layout/` + AppShell wrap |
| 4 | Login + Caisse | 1h | 2 écrans (les plus complexes) |
| 5 | Catalogue + Achats + Dashboard | 1h30 | 3 écrans clés |
| 6 | Gestion + Polish | 45 min | 1 écran + détails partout |

**Total : ~5h** de boulot Claude Code, à splitter sur 2-3 sessions.

---

## 🚨 Règles à dire à Claude Code à chaque session

Avant de commencer une étape, copie aussi ce préfixe :

> Tu travailles sur la migration PANAME OS de Panam'arket. Le repo est React 18 + Vite + Tailwind v3 + Supabase. La maquette de référence est sur `panamarket_maquette_v2.html`. Avant de modifier un fichier, lis-le entièrement. Préserve TOUTE la logique métier (Supabase calls, useEffect, hooks, calculs). Tu ne touches QUE le JSX et les classNames Tailwind, sauf si l'étape demande explicitement de créer un nouveau fichier. Si tu détectes un risque de casser quelque chose, demande confirmation avant de procéder.

---

## 💡 Si ça casse en cours de route

- **Tailwind ne reconnaît pas mes nouvelles couleurs** → vérifier que tailwind.config.js est bien lu, redémarrer le serveur dev
- **Les fonts Bricolage Grotesque/Geist n'apparaissent pas** → vérifier que le link Google Fonts est bien dans `<head>` AVANT le bundle CSS, regarder le devtools Network pour confirmer le chargement
- **Le bottom nav passe sous le home indicator iPhone** → vérifier que `paddingBottom: 'env(safe-area-inset-bottom)'` est bien en style inline (pas en className, sinon Tailwind purge)
- **L'écran défile mal sur Safari iOS** → remplacer `100vh` par `100dvh` partout

Bon courage Kelvin 🥖🗼
