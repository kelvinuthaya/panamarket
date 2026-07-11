// src/lib/agregats.test.js — Tests unitaires de l'agrégation des ventes.
//
// Anatomie d'un test Vitest :
// • describe() regroupe les tests d'une même fonction (juste de l'organisation)
// • it() = un test = UN comportement précis, nommé en français lisible
// • expect(résultat).toEqual(attendu) fait échouer le test si ça ne correspond pas
//
// La stratégie : on fabrique des données d'entrée minuscules mais réalistes
// (mêmes formes que les vraies transactions Supabase), on appelle la fonction,
// et on vérifie la sortie. Pas de base de données, pas de React : instantané.

import { describe, it, expect } from 'vitest'
import { agregerQuantites, totalQuantites } from './agregats'

// Petit index gamme comme celui construit depuis la table `produits`
const GAMMES = {
  1: 'Boissons énergétiques',
  2: 'Boissons énergétiques',
  3: 'Alcools',
}

describe('agregerQuantites', () => {
  it('cumule les quantités d’un même produit vendu sur plusieurs transactions', () => {
    const transactions = [
      { produits: [{ id: 1, designation: 'Red Bull 25cl', quantite: 2, prixUnitaire: 1.5 }] },
      { produits: [{ id: 1, designation: 'Red Bull 25cl', quantite: 3, prixUnitaire: 1.5 }] },
    ]
    const agg = agregerQuantites(transactions, GAMMES)

    expect(agg).toEqual([
      {
        gamme: 'Boissons énergétiques',
        produits: [{ designation: 'Red Bull 25cl', quantite: 5 }], // 2 + 3
        totalGamme: 5,
      },
    ])
  })

  it('classe dans "Autre" un produit dont l’id est inconnu du catalogue', () => {
    // Cas réel : produit supprimé du catalogue après la vente
    const transactions = [
      { produits: [{ id: 999, designation: 'Produit disparu', quantite: 1, prixUnitaire: 2 }] },
    ]
    const agg = agregerQuantites(transactions, GAMMES)

    expect(agg).toHaveLength(1)
    expect(agg[0].gamme).toBe('Autre')
  })

  it('trie les gammes par ordre alphabétique français', () => {
    const transactions = [
      { produits: [
        { id: 1, designation: 'Red Bull', quantite: 1, prixUnitaire: 1.5 },
        { id: 3, designation: 'Bière blonde', quantite: 1, prixUnitaire: 2.5 },
      ] },
    ]
    const agg = agregerQuantites(transactions, GAMMES)

    // 'Alcools' avant 'Boissons énergétiques'
    expect(agg.map(g => g.gamme)).toEqual(['Alcools', 'Boissons énergétiques'])
  })

  it('trie les produits d’une gamme par quantité décroissante, puis par nom', () => {
    const transactions = [
      { produits: [
        { id: 1, designation: 'Red Bull', quantite: 1, prixUnitaire: 1.5 },
        { id: 2, designation: 'Monster', quantite: 4, prixUnitaire: 2 },
      ] },
    ]
    const agg = agregerQuantites(transactions, GAMMES)

    // Monster (4) doit passer devant Red Bull (1) malgré l'ordre d'arrivée
    expect(agg[0].produits.map(p => p.designation)).toEqual(['Monster', 'Red Bull'])
  })

  it('retourne un tableau vide quand il n’y a aucune transaction', () => {
    // Le cas limite classique : une journée sans vente ne doit pas planter le ticket
    expect(agregerQuantites([], GAMMES)).toEqual([])
  })
})

describe('totalQuantites', () => {
  it('additionne les totaux de toutes les gammes', () => {
    const transactions = [
      { produits: [
        { id: 1, designation: 'Red Bull', quantite: 2, prixUnitaire: 1.5 },
        { id: 3, designation: 'Bière blonde', quantite: 3, prixUnitaire: 2.5 },
      ] },
    ]
    const agg = agregerQuantites(transactions, GAMMES)
    expect(totalQuantites(agg)).toBe(5) // 2 + 3
  })

  it('retourne 0 sur une agrégation vide', () => {
    expect(totalQuantites([])).toBe(0)
  })
})
