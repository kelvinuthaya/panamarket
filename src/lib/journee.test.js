// src/lib/journee.test.js — Tests de la journée commerciale (bascule 4h Paris).
//
// L'astuce clé : toutes les fonctions de journee.js acceptent une dateRef en
// paramètre (au lieu de lire l'horloge directement). On peut donc leur passer
// des dates FIGÉES et vérifier le résultat — un test qui dépendrait de "maintenant"
// passerait aujourd'hui et échouerait demain.
//
// Les dates sont écrites en ISO avec offset explicite (+02:00 = heure d'été
// Paris, +01:00 = heure d'hiver) pour que le test soit sans ambiguïté quel que
// soit le fuseau de la machine qui l'exécute (la mienne, la CI, celle du jury…).

import { describe, it, expect } from 'vitest'
import {
  bornesJourneeCommerciale,
  jourCommercial,
  formatJourFr,
  bornesSemaine,
  bornesMois,
} from './journee'

// Helper : affiche une Date en heure murale Paris "YYYY-MM-DD HH:mm" pour
// écrire des assertions lisibles (comparer des Date UTC brutes est illisible)
function enHeureParis(date) {
  return date.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 16)
}

describe('jourCommercial — la règle des 4h', () => {
  it('impute une vente à 1h30 du matin à la journée de la VEILLE', () => {
    // Le cas qui a motivé toute la règle : l'épicerie ferme à 2h,
    // une vente nocturne appartient au CA de la veille.
    expect(jourCommercial(new Date('2026-06-25T01:30:00+02:00'))).toBe('2026-06-24')
  })

  it('impute une vente à 10h du matin à la journée en cours', () => {
    expect(jourCommercial(new Date('2026-06-25T10:00:00+02:00'))).toBe('2026-06-25')
  })

  it('bascule exactement à 4h00 : 3h59 → veille, 4h00 → jour J', () => {
    // Test "aux bornes" : les bugs se cachent toujours aux frontières
    expect(jourCommercial(new Date('2026-06-25T03:59:59+02:00'))).toBe('2026-06-24')
    expect(jourCommercial(new Date('2026-06-25T04:00:00+02:00'))).toBe('2026-06-25')
  })

  it('gère le passage de mois et d’année (1er janvier à 2h → 31 décembre)', () => {
    // +01:00 : janvier = heure d'hiver à Paris
    expect(jourCommercial(new Date('2026-01-01T02:00:00+01:00'))).toBe('2025-12-31')
  })
})

describe('bornesJourneeCommerciale', () => {
  it('retourne [4h00 Paris, 4h00 Paris le lendemain[', () => {
    const { debut, fin } = bornesJourneeCommerciale(new Date('2026-06-25T14:00:00+02:00'))
    expect(enHeureParis(debut)).toBe('2026-06-25 04:00')
    expect(enHeureParis(fin)).toBe('2026-06-26 04:00')
  })

  it('la journée dure 24h (hors jours de changement d’heure)', () => {
    const { debut, fin } = bornesJourneeCommerciale(new Date('2026-06-25T14:00:00+02:00'))
    expect(fin.getTime() - debut.getTime()).toBe(24 * 60 * 60 * 1000)
  })
})

describe('bornesSemaine', () => {
  it('un mercredi appartient à la semaine qui démarre le lundi précédent à 4h', () => {
    // Le 24 juin 2026 est un mercredi → lundi = 22 juin
    const { debut, fin } = bornesSemaine(new Date('2026-06-24T12:00:00+02:00'))
    expect(enHeureParis(debut)).toBe('2026-06-22 04:00')
    expect(enHeureParis(fin)).toBe('2026-06-29 04:00') // lundi suivant, exclusif
  })

  it('un lundi à 2h du matin appartient encore à la semaine PRÉCÉDENTE', () => {
    // Double règle : 2h < 4h → jour commercial = dimanche → semaine d'avant
    const { debut } = bornesSemaine(new Date('2026-06-22T02:00:00+02:00'))
    expect(enHeureParis(debut)).toBe('2026-06-15 04:00')
  })
})

describe('bornesMois', () => {
  it('va du 1er du mois 4h au 1er du mois suivant 4h', () => {
    const { debut, fin } = bornesMois(new Date('2026-06-15T12:00:00+02:00'))
    expect(enHeureParis(debut)).toBe('2026-06-01 04:00')
    expect(enHeureParis(fin)).toBe('2026-07-01 04:00')
  })

  it('le 1er janvier à 2h compte dans le mois de DÉCEMBRE de l’année précédente', () => {
    const { debut } = bornesMois(new Date('2026-01-01T02:00:00+01:00'))
    expect(enHeureParis(debut)).toBe('2025-12-01 04:00')
  })
})

describe('formatJourFr', () => {
  it('formate une date ISO en libellé français long', () => {
    expect(formatJourFr('2026-06-25')).toBe('jeudi 25 juin 2026')
  })
})
