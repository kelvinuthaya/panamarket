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
**Cahier des charges à jour :** page Notion « Cahier des Charges » (id 341d6a7d-cd63-818f-9ce7-dbfc147b6199)

---

## Architecture des fichiers

src/
├── contexts/
│   └── AuthContext.jsx       # Session Supabase + rôle normalisé (employe/manager/gerant)
├── lib/
│   ├── supabase.js           # Client Supabase — ne pas modifier
│   ├── produits.js           # GAMMES, getStatut, detecterGamme, chercherProduitOFF (Open Food Facts)
│   ├── journee.js            # Journée commerciale (bascule 4h Paris) + bornes semaine/mois/année — testée
│   ├── agregats.js           # Agrégation quantités vendues par gamme (fonctions pures) — testée
│   ├── recapPdf.js           # Tickets PDF A4 + 80mm (jsPDF), partagé Caisse/Historique
│   ├── parsePdfCA.js         # Import PDF mensuel Secure Caisse (pdf.js CDN)
│   ├── parseCsvCA.js         # Import CSV Secure Caisse (CA/jour + répartition TVA)
│   └── useBarcodeScanner.js  # Hook caméra ZXing partagé (Caisse, Achats, ProduitFormModal)
├── components/
│   ├── ProduitFormModal.jsx  # Création/édition produit (scan + Open Food Facts)
│   ├── ui/                   # Card, Badge, StatusDot, Button, Tag
│   └── layout/               # AppShell, Sidebar (desktop), BottomNav (mobile), TopBar, Drawer
└── pages/
    ├── Home.jsx              # Accueil, tuiles selon rôle
    ├── Login.jsx             # Auth Supabase
    ├── Catalogue.jsx         # CRUD produits + filtres statut/gamme + badges DLC (manager/gérant pour modif)
    ├── Achats.jsx            # 3 onglets : liste de courses / réception (scan+DLC) / historique livraisons
    ├── Caisse.jsx            # Panier, prix CB/espèces, transactions immuables, tickets PDF (thème dark PANAME OS)
    ├── Historique.jsx        # Journées de caisse passées, périodes jour/semaine/mois/année (gérant)
    └── Dashboard.jsx         # CA, top 5, imports Secure Caisse (gérant, redirige sinon)

Tests : `src/lib/*.test.js` (vitest) — `npm test`. Les fonctions métier pures vont dans src/lib pour rester testables.

---

## Base de données Supabase

Table `produits` :

| Colonne          | Type           | Description                                        |
|------------------|----------------|----------------------------------------------------|
| id               | int8, identity | Clé primaire auto-incrémentée                      |
| code             | text           | Code-barres EAN13 (nullable)                       |
| designation      | text           | Nom du produit                                     |
| gamme            | text           | Catégorie (12 gammes, source : lib/produits.js)    |
| st_actuel        | float4         | Stock actuel en rayon                              |
| st_min           | float4         | Seuil minimum — rupture si st_actuel < st_min      |
| pr_vente         | float4         | Prix de vente CB en euros                          |
| pr_vente_especes | float4, null   | Prix espèces si différencié (ex. puffs), sinon null|

Autres tables :
- `transactions` : id, created_at, user_id, operateur (text), produits (jsonb), total, paiement ('cb'|'especes')
- `livraisons` : id, created_at, user_id
- `stock_dlc` : id, produit_id (FK), designation, quantite, dlc (date, nullable), livraison_id (FK)
- `ca_importe` : jour, ca, source ('pdf'|'csv'), label_mois, nb_transactions, panier_moyen, imported_by — upsert (source, jour)

**Journal immuable** : les lignes de vente (id, designation, quantite, prixUnitaire au prix
réellement encaissé) + total/paiement/operateur sont FIGÉES en jsonb à la validation.
Rien n'est recalculé à la lecture, SAUF la gamme, reconstruite depuis la table `produits`
(exception documentée dans lib/agregats.js).

Logique statut (source unique : `getStatut` dans lib/produits.js) :
- st_actuel === 0 → 'rupture' (rouge) — commander en urgence
- 0 < st_actuel < st_min → 'faible' (orange) — planifier commande
- st_actuel >= st_min → 'ok' (vert)

**Journée commerciale** : bascule à 4h du matin Paris (l'épicerie ferme à 2h). Toujours
passer par lib/journee.js (bornesJourneeCommerciale, bornesSemaine, bornesMois, bornesAnnee)
pour borner une requête transactions — jamais de minuit calendaire.

URL Supabase : https://oiqguvuceghiokgpafca.supabase.co
RLS : actif sur toutes les tables via public.current_role() qui lit app_metadata.role
(commit d433128 ; audit sécurité du 24/06 : search_path fixé, policies WITH CHECK (true) corrigées)

---

## Rôles (3, via Supabase Auth)

| Rôle    | Device           | Accès                                                    |
|---------|------------------|----------------------------------------------------------|
| Employé | Mobile           | Catalogue (lecture), Caisse, Achats                      |
| Manager | Mobile + desktop | + modification catalogue                                 |
| Gérant  | Mobile + desktop | Tout : Dashboard, Historique, imports, suppression vente |

Le rôle vient de user.app_metadata.role (fallback user_metadata), normalisé
sans accents ni majuscules dans AuthContext.

---

## Spécification fonctionnelle (résumé — détail dans le Notion)

- **Catalogue** (ex-« Ruptures ») : liste + filtres statut/gamme/tri, badges DLC (urgence colorée),
  CRUD manager/gérant, ajout par scan ZXing + auto-remplissage Open Food Facts, scanner USB HID.
- **Achats** (fusion Approvisionnement + Livraison) : liste de courses auto (ruptures puis stocks
  faibles) + ajouts manuels ; réception par scan avec quantités et DLC (JJ/MM/AAAA) ; validation →
  st_actuel + stock_dlc + livraison ; historique des livraisons.
- **Caisse** : compteurs +/-, recherche, favoris épinglés, scan caméra + USB, prix différencié
  CB/espèces recalculé au basculement, validation → transaction immuable + décrément stock,
  récap jour, tickets PDF A4 et 80mm, envoi mailto, panier persisté en localStorage.
- **Historique** (gérant) : re-génération des tickets d'une journée/semaine/mois/année passée,
  traçabilité opérateur.
- **Dashboard** (gérant) : CA du mois, BarChart CA/jour (app + importé), top 5, alertes stock,
  import PDF/CSV Secure Caisse persisté dans ca_importe, répartition TVA (après import CSV).
- Reste à faire (cf. Notion) : graphique empilé TVA, ajout produit par photo (Claude Vision,
  évolution future), bouton « Signaler rupture » employé (décision en attente).

---

## Stack technique

| Couche        | Technologie                        |
|---------------|------------------------------------|
| Front         | React 19 + Vite                    |
| CSS           | Tailwind CSS v3                    |
| Routing       | React Router v7                    |
| Back          | Supabase (PostgreSQL + Auth)       |
| Scan          | @zxing/library (hook partagé)      |
| PDF tickets   | jsPDF                              |
| PDF parsing   | pdf.js v3 (CDN)                    |
| Charts        | Recharts                           |
| Icons         | lucide-react                       |
| Toasts        | sonner (Toaster dans App.jsx)      |
| Tests         | vitest (src/lib/*.test.js)         |
| Deploy        | Netlify                            |
| Vision IA     | Claude API (bonus, non fait)       |

---

## Conventions de code

- CSS : Tailwind CSS v3 uniquement — pas de styles inline, pas de fichiers CSS séparés
- Nommage : camelCase pour les props React, snake_case pour les colonnes Supabase
- Composants : fonctionnels uniquement, pas de classes React
- Imports : toujours en haut de fichier
- Supabase : toujours destructurer { data, error }, toujours gérer l'erreur
- Logique métier pure (dates, agrégats, statuts) : dans src/lib, testable sans React

---

## Design system

Deux ambiances coexistent :
- **Pages claires** (Catalogue, Achats, Dashboard) : fond #F9FAFB, cards blanches,
  border-radius 12-16px, shadows légères.
- **PANAME OS dark** (Caisse, Historique) : fond `bitume`, accents `eiffel` (jaune),
  `paname` (vert gradient), `pavillon` (rouge), `signal` (vert), typo `tag-street`.

- Statuts : vert = ok, orange/eiffel = stock faible, rouge/pavillon = rupture
- Mobile-first : utilisation à une main en rayon ; BottomNav mobile, Sidebar desktop
- Toasts : sonner (Catalogue, Dashboard, ProduitFormModal) ; Caisse et Achats ont un
  toast local useState — NE PAS importer `toast` de sonner dans ces deux fichiers
  (collision de nom avec le useState local déjà vécue)

---

## Données

- `data/*.csv` : imports initiaux et enrichissements EAN du catalogue (traçabilité, ne pas supprimer)
