// Lit le CSV export caisse Secure Caisse (latin-1, séparateur ;)
// Retourne caParJour { "DD/MM": montant } et caParTva (vide — non fourni par ce CSV)

function lireLatin1(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'iso-8859-1')
  })
}

function parseLigneRecap(line, colTotal) {
  const cells = line.split(';').map(c => c.trim().replace(',', '.'))
  if (!cells[0].match(/^\d{2}\/\d{2}\/\d{4}$/)) return null
  const dateKey = cells[0].slice(0, 5) // "DD/MM"
  const total = parseFloat(cells[colTotal] || cells[cells.length - 1]) || 0
  return { dateKey, total }
}

export async function parseCsvCA(file) {
  const rawText = await lireLatin1(file)
  // Nettoyer le BOM UTF-8 (EF BB BF) et UTF-16 LE (FF FE)
  const text = rawText.replace(/^﻿/, '').replace(/^\xFF\xFE/, '')

  const lignes = text.split(/\r?\n/)

  let colTotal = -1
  let headerTrouve = false
  const caParJour = {}

  for (const ligne of lignes) {
    const cells = ligne.split(';').map(c => c.trim())
    if (!cells.length || !cells[0]) continue

    if (!headerTrouve) {
      if (/^date$/i.test(cells[0])) {
        // Ligne d'en-tête : chercher colonne "Total" ou "C.A. Jour"
        const idx = cells.findIndex(c => /^total$/i.test(c) || /c\.?a\.?\s*jour/i.test(c))
        colTotal = idx >= 0 ? idx : cells.length - 1
        headerTrouve = true
        continue
      }
      // Données sans en-tête : première ligne "DD/MM/YYYY" → utiliser dernière colonne
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) {
        colTotal = cells.length - 1
        headerTrouve = true
        // Pas de continue — traiter cette ligne comme donnée
      } else {
        continue
      }
    }

    const result = parseLigneRecap(ligne, colTotal)
    if (result) {
      caParJour[result.dateKey] = (caParJour[result.dateKey] ?? 0) + result.total
    }
  }

  // caParTva non fourni par le CSV Secure Caisse — calculé ailleurs si besoin
  return { caParJour, caParTva: {} }
}
