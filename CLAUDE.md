# CLAUDE.md — Panamarket PWA
Codex will review your output once you are done.
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.
## Comportement de l'IA (règles permanentes)

### 1. Réfléchir avant de coder
- Énoncer les hypothèses explicitement. Si ambigu, poser la question.
- Si plusieurs interprétations existent, les présenter — ne pas choisir silencieusement.
- Si une approche plus simple existe, la signaler.

### 2. Simplicité d'abord
- Minimum de code qui résout le problème. Rien de spéculatif.
- Pas de fonctionnalités au-delà de ce qui est demandé.
- Pas d'abstractions pour du code à usage unique.
- Si 200 lignes peuvent être 50, réécrire.

### 3. Changements chirurgicaux
- Toucher uniquement ce qui est nécessaire.
- Ne pas "améliorer" le code adjacent.
- Respecter le style existant, même si on ferait différemment.
- Si du code mort est repéré, le signaler — ne pas le supprimer.

### 4. Exécution orientée objectif
Pour les tâches multi-étapes, énoncer un plan bref :
1. [Étape] → vérification : [check]
2. [Étape] → vérification : [check]

### 5. Pédagogie
Kelvin est stagiaire BUT3, débutant React/SQL. Expliquer brièvement les choix
non évidents en commentaire dans le code.

---

## Contexte du projet

**Projet :** PWA de gestion d'inventaire et d'approvisionnement
**Client :** Panam'arket — épicerie urbaine, 224 rue de Belleville, 75020 Paris
**Employés :** ~4 personnes. Gérant : Christian Francis
**Produits actifs :** ~50 références (catalogue évolutif, nouveaux produits fréquents)
**Développeur :** Kelvin Uthayakumar — stagiaire BUT3 Informatique
**Stack :** React 19 + Vite, Tailwind CSS v3, Supabase (PostgreSQL), déployé sur Netlify
**Repo GitHub :** github.com/kelvinuthaya/panamarket (public)

---

## Architecture des fichiers

src/
├── lib/
│   └── supabase.js           # Client Supabase — ne pas modifier
├── components/
│   └── ProduitCard.jsx       # Carte produit réutilisable
└── pages/
    ├── Ruptures.jsx          # Module 1 — ruptures de stock (employé, mobile)
    ├── Approvisionnement.jsx # Module 2 — liste de courses (manager, mobile)
    ├── Caisse.jsx            # Module 3 — caisse simulée (employé, mobile)
    └── Dashboard.jsx         # Module 4 — statistiques (manager, desktop)

---

## Base de données Supabase

Table `produits` :

| Colonne    | Type           | Description                                      |
|------------|----------------|--------------------------------------------------|
| id         | int8, identity | Clé primaire auto-incrémentée                    |
| code       | text           | Code-barres EAN13                                |
| designation| text           | Nom du produit                                   |
| gamme      | text           | Catégorie (Boissons énergétiques, Alcools, etc.) |
| st_actuel  | float4         | Stock actuel en rayon                            |
| st_min     | float4         | Seuil minimum — rupture si st_actuel < st_min    |
| pr_vente   | float4         | Prix de vente en euros                           |

Logique rupture :
- st_actuel === 0 → Rupture totale (rouge) — commander en urgence
- st_actuel > 0 && st_actuel < st_min → Stock insuffisant (orange) — planifier commande
- st_actuel >= st_min → En stock (vert)

URL Supabase : https://oiqguvuceghiokgpafca.supabase.co
RLS : désactivé pour l'instant (à activer avec l'auth en semaine 5-6)

---

## Spécification fonctionnelle

### Module 1 — Ruptures de stock
Utilisateur : Employé (mobile)
- Afficher la liste de tous les produits avec leur statut (rupture / insuffisant / ok)
- Filtres : Tous / Rupture / Stock insuffisant / En stock
- Bouton "Signaler rupture" sur chaque ProduitCard → update st_actuel dans Supabase
- Scanner un code-barres produit avec la caméra pour retrouver un produit rapidement

### Module 2 — Approvisionnement
Utilisateur : Manager (mobile)
- Consulter la liste des produits en rupture ou stock insuffisant
- Générer une liste de courses dynamique (produits à commander)
- Marquer un produit comme commandé / réapprovisionné

### Module 3 — Caisse simulée
Utilisateur : Employé (mobile)
- Liste des produits avec compteurs de quantité (+/-)
- Scanner un code-barres pour ajouter un produit hors liste
- Total journalier en temps réel
- Génération ticket PDF en fin de journée
- Envoi du ticket par email
- Sauvegarde pour suivi CA mensuel

### Module 4 — Dashboard statistiques
Utilisateur : Manager (desktop)
- CA fictif jour par jour
- CA mensuel cumulé avec graphique (Recharts)
- Top 5 produits les plus vendus
- Évolution mois par mois
- Nombre de ruptures signalées par semaine

### Fonctionnalités transversales
- Authentification 2 rôles (employé / manager) via Supabase Auth
- Gestion catalogue : ajout / modif / suppression produit par le manager
- Ajout produit par scan code-barres
- (Bonus) Ajout produit par photo via Claude API Vision
- App installable sur téléphone (manifest.json PWA)
- Navigation bottom bar mobile (4 onglets)
- Responsive mobile-first sur toutes les pages

---

## Stack technique

| Couche        | Technologie                        |
|---------------|------------------------------------|
| Front         | React 19 + Vite                    |
| CSS           | Tailwind CSS v3                    |
| Routing       | React Router v6                    |
| Back          | Supabase (PostgreSQL + Auth)       |
| Scan          | librairie barcode (à définir)      |
| PDF           | librairie PDF (à définir)          |
| Deploy        | Netlify                            |
| Vision IA     | Claude API (bonus)                 |

---

## Conventions de code

- CSS : Tailwind CSS v3 uniquement — pas de styles inline, pas de fichiers CSS séparés
- Nommage : camelCase pour les props React, snake_case pour les colonnes Supabase
- Composants : fonctionnels uniquement, pas de classes React
- Imports : toujours en haut de fichier
- Supabase : toujours destructurer { data, error }, toujours gérer l'erreur

---

## Design system

- Palette : fond gris très léger (#F9FAFB), blanc pour les cards
- Vert (#1D9E75) : couleur principale, actions, succès
- Bleu (#378ADD) : informations
- Orange (#F59E0B) : stock insuffisant
- Rouge (#EF4444) : rupture totale, danger
- Cards : fond blanc, border gris léger, border-radius 12px, shadow légère
- Mobile-first : optimisé pour utilisation à une main en rayon
- Navigation : bottom bar fixe sur mobile, 4 onglets (Ruptures, Appro, Caisse, Dashboard)
- Pas de gradients lourds, pas de shadows excessives
