// Lit le CSV export mensuel Secure Caisse (latin-1, séparateur ;).
// Le fichier contient DEUX tableaux à la suite :
//   1. RECAPITULATIF PAR TAUX DE TVA (CA du mois par taux)
//   2. RECAPITULATIF JOURNALIER (CA encaissé par jour, colonne "C.A.Jour")
// On ne lit le CA jour QUE dans la 2e section, sinon on additionnerait aussi
// le récap TVA. Retourne caParJour { "DD/MM": montant }, caParTva { "10.00": montant, ... },
// annee/mois et labelMois lus dans le fichier (jamais dans moisSelectionne — un CSV
// d'une autre année/mois que celui affiché doit garder ses propres dates).

const MOIS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const RE_CA_JOUR = /c\.?a\.?\s*jour/i
const RE_TTC_TAUX = /^ttc\s*([\d.,]+)\s*%$/i
const RE_DATE_ISO = /^(\d{4})\/(\d{2})\/(\d{2})$/

function lireLatin1(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'iso-8859-1')
  })
}

function extraireLabelMoisFichier(lignes) {
  for (const ligne of lignes) {
    const m = ligne.match(/du mois de\s*:\s*([^)]+)/i)
    if (m) return m[1].trim()
  }
  return null
}

// Section 1 : récap par taux de TVA (avant "RECAPITULATIF JOURNALIER")
function parseSectionTva(lignes, idxJournalier) {
  const section = idxJournalier >= 0 ? lignes.slice(0, idxJournalier) : lignes

  let colonnes = null // [{ taux, idx }] — une par "TTC X.XX%" dans l'en-tête
  let ligneTotaux = null
  const lignesJour = []

  for (const ligne of section) {
    const cells = ligne.split(';').map(c => c.trim())
    if (!cells[0]) continue

    if (!colonnes) {
      const trouve = []
      cells.forEach((c, i) => {
        const m = c.match(RE_TTC_TAUX)
        if (m) trouve.push({ taux: m[1].replace(',', '.'), idx: i })
      })
      if (trouve.length > 0) colonnes = trouve
      continue
    }
    if (/^totaux/i.test(cells[0])) { ligneTotaux = cells; continue }
    if (RE_DATE_ISO.test(cells[0])) lignesJour.push(cells)
  }

  if (!colonnes) return {}

  const caParTva = {}
  for (const { taux, idx } of colonnes) {
    const total = ligneTotaux && ligneTotaux[idx] !== undefined
      ? parseFloat(ligneTotaux[idx].replace(',', '.')) || 0
      : lignesJour.reduce((s, cells) => s + (parseFloat((cells[idx] ?? '0').replace(',', '.')) || 0), 0)
    caParTva[taux] = parseFloat(total.toFixed(2))
  }
  return caParTva
}

// Section 2 : récap journalier (source du CA jour — colonne "C.A.Jour")
function parseSectionJournaliere(lignes, idxJournalier) {
  const section = idxJournalier >= 0 ? lignes.slice(idxJournalier) : []

  let colTotal = null
  const caParJour = {}
  let annee = null
  let mois = null

  for (const ligne of section) {
    const cells = ligne.split(';').map(c => c.trim())
    if (!cells[0]) continue

    if (colTotal === null) {
      const idx = cells.findIndex(c => RE_CA_JOUR.test(c))
      if (idx >= 0) colTotal = idx
      continue
    }

    const m = cells[0].match(RE_DATE_ISO)
    if (!m) continue // ignore "TOTAUX", séparateurs "_", etc.

    const [, yyyy, mm, dd] = m
    if (annee === null) { annee = Number(yyyy); mois = Number(mm) }
    caParJour[`${dd}/${mm}`] = parseFloat((cells[colTotal] ?? '0').replace(',', '.')) || 0
  }

  return { caParJour, annee, mois }
}

// Fonction pure — pas de FileReader, donc testable directement avec du texte.
export function parseTexteCsvCA(text) {
  const lignes = text.split(/\r?\n/)
  const idxJournalier = lignes.findIndex(l => /recapitulatif journalier/i.test(l))

  const { caParJour, annee, mois } = parseSectionJournaliere(lignes, idxJournalier)
  if (Object.keys(caParJour).length === 0) {
    throw new Error('Aucune ligne journalière trouvée (section "RECAPITULATIF JOURNALIER" absente ou vide)')
  }

  const caParTva = parseSectionTva(lignes, idxJournalier)

  const labelBrut = extraireLabelMoisFichier(lignes)
  const labelMois = labelBrut ?? `${MOIS_FR[mois - 1]} ${annee}`

  return { caParJour, caParTva, annee, mois, labelMois }
}

export async function parseCsvCA(file) {
  const rawText = await lireLatin1(file)
  // Nettoyer le BOM UTF-8 (EF BB BF) et UTF-16 LE (FF FE)
  const text = rawText.replace(/^﻿/, '').replace(/^\xFF\xFE/, '')
  return parseTexteCsvCA(text)
}
