# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personnel de Panam'arket, épicerie urbaine indépendante (224 rue de Belleville, 75020 Paris), ~4 employés au total. Trois rôles Supabase Auth :
- **Employé** (mobile, en rayon) : consultation du catalogue, caisse, achats.
- **Manager** (mobile + desktop) : + modification du catalogue.
- **Gérant** — Christian Francis (mobile + desktop) : accès complet, dont dashboard, historique, imports CA, suppression de vente.

## Product Purpose

Gérer au quotidien l'inventaire, l'approvisionnement et l'encaissement d'une petite épicerie urbaine : suivre les stocks et ruptures, organiser les réceptions de livraison avec DLC, encaisser en caisse tactile, conserver un historique de vente immuable, et donner au gérant une vue consolidée du chiffre d'affaires. Succès = réduire les ruptures de stock non anticipées et fiabiliser la caisse et le reporting sans dépendre d'un logiciel de caisse générique.

## Positioning

Application sur-mesure plutôt qu'un logiciel de caisse/inventaire du commerce (Square, Zettle, Tiller...), pour deux raisons confirmées par le gérant :
- **Workflows métier spécifiques** qu'un outil générique ne modélise pas nativement : journée commerciale qui bascule à 4h du matin (l'épicerie ferme à 2h) plutôt qu'à minuit calendaire, prix différencié CB/espèces recalculé au panier, ticket de vente figé en jsonb à la validation (rien n'est recalculé à la lecture), favoris de caisse.
- **Autonomie et maîtrise des coûts** : pas d'abonnement SaaS récurrent, code et données (Supabase) sous contrôle direct du commerçant.

## Operating Context

Poste de caisse principal : écran tactile ~15″ 1366×768 en paysage sous Windows, douchette USB (émulation clavier + Enter). C'est le cas d'usage premier ("mode POS", breakpoint `lg:` 1024px) ; le mobile reste utilisé en rayon pour le catalogue et les achats.

L'épicerie utilise en parallèle un logiciel de caisse tiers, Secure Caisse, dont les relevés PDF/CSV mensuels sont importés dans le Dashboard pour recouper le chiffre d'affaires officiel (CA/jour, répartition TVA) avec l'activité enregistrée dans l'app.

Catalogue actif d'environ 50 références, évolutif (nouveaux produits fréquents, ajout par scan EAN + auto-remplissage Open Food Facts).

## Capabilities and Constraints

- **Catalogue** : CRUD produits, filtres statut (rupture/faible/ok)/gamme/tri, badges DLC, ajout par scan caméra ou douchette USB, modification réservée manager/gérant.
- **Achats** : liste de courses auto-générée (ruptures puis stocks faibles) + ajouts manuels, réception avec scan + quantités + DLC, historique des livraisons.
- **Caisse** : panier avec compteurs, recherche, favoris épinglés (persistés Supabase), scan caméra + USB, prix CB/espèces, transaction immuable en jsonb au moment de la validation, décrément de stock, tickets PDF A4 et 80mm, envoi mailto.
- **Historique** (gérant) : régénération des tickets d'une journée/semaine/mois/année passée, traçabilité de l'opérateur.
- **Dashboard** (gérant) : CA du mois, graphique CA/jour (app + importé), top 5 produits, alertes stock, import PDF/CSV Secure Caisse persisté, répartition TVA.
- Rôle utilisateur porté par `user.app_metadata.role` (fallback `user_metadata`), normalisé sans accents/majuscules.
- RLS actif sur toutes les tables Supabase via `public.current_role()`.
- Décisions produit non tranchées, à ne pas anticiper : graphique empilé TVA, ajout de produit par photo (Claude Vision, évolution future), bouton « Signaler rupture » pour l'employé.

## Brand Commitments

Nom : Panam'arket. Une seule ambiance visuelle claire (calcaire) pour toute l'app, décision confirmée par le porteur du projet : l'ancienne identité sombre « PANAME OS », qui habillait Login, Caisse et Historique, est en cours d'unification vers cette ambiance claire plutôt que conservée comme système à part. Exception assumée : la Sidebar (NavRail 88px) reste en fond sombre, pour des raisons de lisibilité du logo qui y est intégré. Éviter les effets décoratifs non systémiques (gradients, ombres colorées « glow ») qui ne s'appuient pas sur les tokens Tailwind déjà définis dans tailwind.config.js.

## Evidence on Hand

- `data/*.csv` : imports initiaux et enrichissements EAN du catalogue réel (traçabilité, ne pas supprimer).
- Cahier des charges à jour dans le Notion du projet (page « Cahier des Charges »).
- Pas de témoignages/études de cas externes : usage interne uniquement, ne pas en fabriquer.

## Product Principles

1. Coller aux workflows réels de la boutique plutôt qu'aux conventions génériques d'un logiciel de caisse (journée commerciale à 4h, prix différencié, ticket immuable).
2. Autonomie et maîtrise des coûts : pas de dépendance SaaS, code et données sous contrôle direct.
3. Le poste de caisse tactile est le cas d'usage premier ; le mobile reste secondaire, pour le rayon.
4. Intégrité et traçabilité des données : transactions et livraisons immuables ; seule la gamme est reconstruite dynamiquement à la lecture, documenté comme exception.
5. Simplicité pédagogique : projet piloté par un stagiaire seul — logique métier pure et testable (`src/lib`) plutôt que des abstractions complexes.

## Accessibility & Inclusion

Aucune contrainte spécifique identifiée pour l'équipe (~4 personnes) : usage tactile/smartphone standard, pas de besoin particulier connu à ce jour.
