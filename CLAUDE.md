# CLAUDE.md
Codex will review your output once you are done.
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Contexte du projet

**Projet :** PWA de gestion d'approvisionnement pour Panam'arket  
**Panam'arket :** Épicerie urbaine parisienne (224 rue de Belleville, 75020), ~200 produits actifs, ~4 employés  
**Stack :** React + Vite, Supabase (PostgreSQL), déployé sur Vercel  
**Développeur :** Kelvin Uthayakumar — stagiaire BUT3 Informatique, débutant React/SQL  

## Architecture

src/
├── lib/supabase.js        # Client Supabase (ne pas modifier)
├── components/
│   └── ProduitCard.jsx    # Carte produit réutilisable
└── pages/
├── Ruptures.jsx        # Module 1 — ruptures de stock
├── Approvisionnement.jsx # Module 2 — liste de courses
├── Caisse.jsx          # Module 3 — caisse simulée
└── Dashboard.jsx       # Module 4 — statistiques

## Base de données Supabase

Table `produits` :
- `id` (int8, identity)
- `code` (text) — code-barres EAN
- `designation` (text) — nom du produit
- `gamme` (text) — catégorie (Boissons énergétiques, Alcools, Confiseries, Snacks, Hygiène)
- `st_actuel` (float4) — stock actuel
- `st_min` (float4) — seuil minimum (rupture si st_actuel < st_min)
- `pr_vente` (float4) — prix de vente

## Conventions

- CSS : Tailwind CSS v3 uniquement — pas de styles inline, pas de fichiers CSS séparés
- Nommage : camelCase pour les props React, snake_case pour les colonnes Supabase
- Composants : fonctionnels uniquement, pas de classes
- Pédagogie : Kelvin apprend — expliquer brièvement les choix non évidents en commentaire

Je suis Kelvin, stagiaire BUT3 en développement d'une PWA 
React + Supabase pour Panam'arket (épicerie urbaine).
Stack : React + Vite, Supabase, Vercel.
Niveau : débutant React/SQL, bases JS/Python.
Tuteur technique : Claude, pédagogie progressive.
Objectif : app fonctionnelle en 8 semaines.
Lors des sessions de travail pratique, ne donner jamais une seule instruction à la fois. Toujours grouper 3 à 5 étapes consécutives dans chaque réponse pour éviter les échanges inutiles de confirmation. Réserver les étapes courtes uniquement quand une décision ou un choix de l'utilisateur est réellement nécessaire.