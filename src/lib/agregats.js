// src/lib/agregats.js — Agrégation pure des quantités vendues par gamme.
//
// SOURCE UNIQUE de la logique "quantités vendues" affichée sur le ticket
// jour (Caisse) ET sur les tickets semaine/mois/année (Historique). Aucune
// dépendance React : fonctions pures testables et appelables côté node.
//
// Pourquoi un helper externe ?
// • Le bloc "quantités vendues" doit être identique entre Caisse et Historique.
//   Le centraliser ici évite toute divergence (deux implémentations qui
//   dérivent finissent toujours par produire des chiffres différents).
// • La gamme n'est pas stockée dans le JSONB `produits` des transactions
//   (seulement designation/quantite/prixUnitaire). On la reconstitue depuis
//   un index `gammeParId` construit côté appelant à partir de la table
//   `produits`. Avantage : robuste aux ventes anciennes dont la gamme aurait
//   changé depuis (on prend la gamme CONTEMPORAINE du produit, pas une copie
//   figée à la vente).

/**
 * Agrège les quantités vendues, regroupées par gamme.
 *
 * @param {Array} transactions - liste { produits:[{id, designation, quantite, prixUnitaire}] }
 * @param {Object} gammeParId  - dict { [produitId]: gammeString }
 * @returns {Array} [ { gamme, produits:[{designation, quantite}], totalGamme }, ... ]
 *
 * Règles :
 * • Cumule les quantités d'un même produit sur plusieurs ventes (Map par id).
 * • designation = première rencontrée (stable : la même au sein d'une période).
 * • Produit dont l'id n'a pas de gamme connue → bucket 'Autre'
 *   (cas typique : produit supprimé du catalogue depuis la vente).
 * • Tri des GAMMES par ordre alphabétique (localeCompare fr pour les accents).
 * • Tri des PRODUITS dans chaque gamme par quantité DÉCROISSANTE,
 *   puis par designation alphabétique en cas d'égalité.
 */
export function agregerQuantites(transactions, gammeParId) {
  // Map<gamme, Map<produitId, {designation, quantite}>>
  // Double Map pour cumuler par id, puis grouper par gamme.
  const parGamme = new Map()

  for (const t of transactions) {
    for (const ligne of t.produits) {
      const gamme = gammeParId[ligne.id] || 'Autre'
      if (!parGamme.has(gamme)) parGamme.set(gamme, new Map())
      const produitsMap = parGamme.get(gamme)

      const existant = produitsMap.get(ligne.id)
      if (existant) {
        existant.quantite += ligne.quantite
      } else {
        produitsMap.set(ligne.id, {
          designation: ligne.designation,
          quantite:    ligne.quantite,
        })
      }
    }
  }

  // Tri des gammes (alphabétique, FR)
  const gammesTriees = [...parGamme.keys()].sort((a, b) =>
    a.localeCompare(b, 'fr')
  )

  return gammesTriees.map(gamme => {
    const produits = [...parGamme.get(gamme).values()].sort((a, b) =>
      // Quantité décroissante d'abord, puis designation alphabétique
      b.quantite - a.quantite || a.designation.localeCompare(b.designation, 'fr')
    )
    const totalGamme = produits.reduce((s, p) => s + p.quantite, 0)
    return { gamme, produits, totalGamme }
  })
}

/**
 * Nombre total d'articles vendus, toutes gammes confondues.
 * Utilisé pour afficher "Total articles : N" en pied de bloc.
 */
export function totalQuantites(agg) {
  return agg.reduce((s, g) => s + g.totalGamme, 0)
}
