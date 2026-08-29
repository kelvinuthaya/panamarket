// src/lib/parsePdfCA.test.js — Tests unitaires de parseArticleLine.
//
// Bug réel : quand la désignation déborde sur la colonne Qte, pdf.js fusionne
// les deux dans le flux texte ("33CL" + qté "1" → "313"). Le cas est
// indécidable au niveau du texte seul, donc on ne lit plus la qté dans la
// désignation : elle vient de total / prix_unitaire (colonnes toujours propres).

import { describe, it, expect } from 'vitest'
import { parseArticleLine, extraireCaParTva } from './parsePdfCA'

describe('parseArticleLine', () => {
  it('déduit qty=1 quand "33CL"+qté fusionnent en "313" dans la désignation', () => {
    const art = parseArticleLine("13/01  OASIS POMM CASSIS  313   1.20 €  1.20 €")
    expect(art.qty).toBe(1)
    expect(art.prix).toBeCloseTo(1.20)
  })

  it('déduit qty=1 quand la désignation fusionne en "1100"', () => {
    const art = parseArticleLine("12/01  'CURLY CACAHUETE  1100   2.20 €  2.20 €")
    expect(art.qty).toBe(1)
  })

  it('calcule qty > 1 depuis total / prix_unitaire', () => {
    const art = parseArticleLine("13/01  KRONENBOURG 7,2 cane2  2.10 €  4.20 €")
    expect(art.qty).toBe(2)
    expect(art.prix).toBeCloseTo(2.10)
  })

  it('ignore une ligne sans deux montants "X.XX €"', () => {
    expect(parseArticleLine("13/01  DIVERS  1.20 €")).toBeNull()
  })

  it('ignore une ligne dont le ratio total/prix_unitaire n\'est pas entier', () => {
    expect(parseArticleLine("13/01  ARTICLE X  1.23 €  4.56 €")).toBeNull()
  })
})

describe('extraireCaParTva', () => {
  it('extrait les 4 taux et déduplique le bloc répété (détail + récapitulatif)', () => {
    const blocTva = [
      'Taux 1 (10.00% )-----=> Total T.T.C. (Euro ): 15.60 € - H.T.(Euro ): 14.18 €',
      'Taux 2 (20.00% )-----=> Total T.T.C. (Euro ): 419.50 € - H.T.(Euro ): 349.58 €',
      'Taux 3 (2.00% )-----=> Total T.T.C. (Euro ): 56.00 € - H.T.(Euro ): 54.90 €',
      'Taux 4 (5.50% )-----=> Total T.T.C. (Euro ): 5044.55 € - H.T.(Euro ): 4781.09 €',
    ]
    // Même bloc répété (page récapitulative) — mêmes valeurs
    const lignes = [...blocTva, ...blocTva]

    expect(extraireCaParTva(lignes)).toEqual({
      '10.00': 15.60, '20.00': 419.50, '2.00': 56.00, '5.50': 5044.55,
    })
  })
})
