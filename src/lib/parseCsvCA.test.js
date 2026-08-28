// src/lib/parseCsvCA.test.js — Tests unitaires du parseur CSV Secure Caisse.
//
// On appelle parseTexteCsvCA directement avec du texte (pas de File/FileReader,
// indisponibles hors navigateur) : c'est la fonction pure isolée de la lecture
// de fichier. L'échantillon reproduit les deux sections du vrai export
// (récap TVA, récap journalier) avec une ligne TOTAUX et des séparateurs "_"
// à ignorer, comme dans un fichier réel.

import { describe, it, expect } from 'vitest'
import { parseTexteCsvCA } from './parseCsvCA'

const CSV_ECHANTILLON = [
  "DOSSIER SOURCE :PANAM'ARKET  ( Chiffre d'affaires du mois de : Fevrier 2026 )",
  'Impression du : 05/03/2026_00:07',
  '_RECAPITULATIF PAR TAUX DE TVA_',
  '_',
  'JOUR;TTC 10.00%;HT 10.00%;Tva 10.00%;;TTC 20.00%;HT 20.00%;Tva 20.00%;;TTC 5.50%;HT 5.50%;Tva 5.50%;;',
  '2026/02/01;0.00;0.00;0.00;;14.59;12.15;2.44;;164.88;156.28;8.60;;',
  '2026/02/02;5.00;4.55;0.45;;20.00;16.67;3.33;;100.00;94.79;5.21;;',
  'TOTAUX ;5.00;4.55;0.45;;34.59;28.82;5.77;;264.88;251.07;13.81;;',
  '_',
  'RECAPITULATIF JOURNALIER',
  '_',
  ' Jour; Ch. Resto; Chèque; Virement; Especes; C.B.; Annulation; Compte ; C.A.Jour;',
  '2026/02/01;0.00;0.00;0.00;149.28;30.19;0.00;0.00;179.47;;',
  '2026/02/02;0.00;0.00;0.00;80.00;45.00;0.00;0.00;125.00;;',
  'TOTAUX ;0.00;0.00;0.00;229.28;75.19;0.00;0.00;304.47;;',
].join('\n')

describe('parseTexteCsvCA', () => {
  it('lit le CA jour depuis la section RECAPITULATIF JOURNALIER (colonne C.A.Jour, pas la dernière)', () => {
    const { caParJour } = parseTexteCsvCA(CSV_ECHANTILLON)
    expect(caParJour).toEqual({ '01/02': 179.47, '02/02': 125 })
  })

  it('ne double pas le CA avec le récap TVA (2 tableaux dans le même fichier)', () => {
    const { caParJour } = parseTexteCsvCA(CSV_ECHANTILLON)
    // Si le récap TVA était compté aussi, 01/02 vaudrait 179.47 + une part du récap
    expect(Object.keys(caParJour)).toHaveLength(2)
  })

  it("ignore la ligne TOTAUX et les séparateurs \"_\"", () => {
    const { caParJour } = parseTexteCsvCA(CSV_ECHANTILLON)
    expect(caParJour['TOTAUX']).toBeUndefined()
  })

  it('extrait le CA TTC cumulé par taux de TVA depuis la ligne TOTAUX', () => {
    const { caParTva } = parseTexteCsvCA(CSV_ECHANTILLON)
    expect(caParTva).toEqual({ '10.00': 5, '20.00': 34.59, '5.50': 264.88 })
  })

  it('lit année, mois et labelMois depuis le fichier, jamais depuis l’appelant', () => {
    const { annee, mois, labelMois } = parseTexteCsvCA(CSV_ECHANTILLON)
    expect(annee).toBe(2026)
    expect(mois).toBe(2)
    expect(labelMois).toBe('Fevrier 2026')
  })

  it('reconstruit labelMois depuis les dates si la ligne "du mois de" est absente', () => {
    const sansEntete = CSV_ECHANTILLON.split('\n').slice(1).join('\n')
    const { labelMois } = parseTexteCsvCA(sansEntete)
    expect(labelMois).toBe('février 2026')
  })

  it('lève une erreur explicite quand aucune ligne journalière n’est trouvée', () => {
    expect(() => parseTexteCsvCA('rien à voir ici')).toThrow()
  })
})
