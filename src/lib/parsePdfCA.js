// Extrait les transactions d'un PDF de caisse Secure Caisse
// Utilise window.pdfjsLib chargé via CDN dans index.html

const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

const EXCLUS_RE = /^(divers|menu)/i

// Dernier montant "X,XX €" ou "X.XX €" en fin de ligne recap journalier
const RECAP_RE = /^(\d{2}\/\d{2}\/\d{4})\s+.*?([\d]+[,.]\d{2})\s*€\s*$/

// "Taux 2 (20.00% )-----=> Total T.T.C. (Euro ): 419.50 € - H.T.(Euro ): ..."
const RE_TAUX_TVA = /taux\s*\d+\s*\(\s*([\d.,]+)\s*%\s*\).*?total\s*t\.?t\.?c\.?\s*\([^)]*\)\s*:\s*([\d]+[,.]\d{2})\s*€/i

// Le bloc des 4 taux apparaît deux fois dans le document (bas de la dernière
// page de détail ET page récapitulative), avec les mêmes valeurs : on garde
// la 1re occurrence par taux, la 2e ne fait que confirmer le même chiffre.
export function extraireCaParTva(lignes) {
  const caParTva = {}
  for (const ligne of lignes) {
    const m = ligne.match(RE_TAUX_TVA)
    if (m) {
      const taux = m[1].replace(',', '.')
      if (!(taux in caParTva)) caParTva[taux] = parseFloat(m[2].replace(',', '.'))
    }
  }
  return caParTva
}

// Groupe les items pdf.js d'une page par ligne visuelle (tolérance ±3px en Y)
function grouperParLigne(items) {
  const groupes = []
  for (const item of items) {
    const y = item.transform[5]
    const g = groupes.find(gr => Math.abs(gr.y - y) <= 3)
    if (g) {
      g.items.push(item)
    } else {
      groupes.push({ y, items: [item] })
    }
  }
  return groupes
    .sort((a, b) => b.y - a.y)
    .map(g =>
      g.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(i => i.str)
        .join(' ')
        .trim()
    )
}

// Format ligne article : "DD/MM designation[qty collé] prix_unit € total €"
// La qté n'est plus lue dans le texte : elle fusionne parfois avec la
// désignation dans le flux pdf.js ("OASIS POMM CASSIS 33CL" + qté "1" →
// "313" collé) et le cas est indécidable au niveau du texte seul ("313" =
// "31"+"3" ou "3"+"13" ?). Les colonnes Prix TTC et Total restent toujours
// propres et séparées : qty = total / prix_unitaire, forcément entier.
export function parseArticleLine(ligne) {
  const dateMatch = ligne.match(/^(\d{2}\/\d{2})\s+/)
  if (!dateMatch) return null
  const date = dateMatch[1]
  const reste = ligne.slice(dateMatch[0].length)

  const montants = [...reste.matchAll(/([\d]+[,.]\d{2})\s*€/g)]
  if (montants.length < 2) return null

  const prixUnitaire = parseFloat(montants[0][1].replace(',', '.'))
  const total = parseFloat(montants[1][1].replace(',', '.'))
  if (!(prixUnitaire > 0)) return null

  const ratio = total / prixUnitaire
  const qty = Math.round(ratio)
  if (qty <= 0 || Math.abs(ratio - qty) > 0.01) return null

  // Désignation = texte avant le 1er montant, suffixe numérique collé retiré
  // (cosmétique — la qté ne vient plus de là, cf. commentaire ci-dessus).
  const avantPrix = reste.slice(0, reste.indexOf(montants[0][0])).trim()
  const parts = avantPrix.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  const dernierSansChiffres = parts[parts.length - 1].replace(/\d+$/, '')
  const designation = [...parts.slice(0, -1), dernierSansChiffres].filter(Boolean).join(' ').trim()
  if (!designation) return null

  return { date, designation, qty, prix: prixUnitaire, total }
}

export async function parsePdfCA(file) {
  const pdfjsLib = window.pdfjsLib
  if (!pdfjsLib) throw new Error('pdf.js non chargé — vérifier index.html')

  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const toutesLignes = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    toutesLignes.push(...grouperParLigne(content.items))
  }

  // --- labelMois ---
  let labelMois = ''
  for (const ligne of toutesLignes) {
    const m = ligne.match(/d[eé]tail du mois de\s*:\s*([^)]+)/i)
      ?? ligne.match(/r[eé]capitulatif du mois de\s*:\s*([^)]+)/i)
    if (m) { labelMois = m[1].trim(); break }
  }

  // --- nbTransactions et panierMoyen depuis "Nbre de Factures/Mois = X" ---
  let nbTransactions = 0
  let panierMoyen = null
  for (const ligne of toutesLignes) {
    const mFact = ligne.match(/factures\/mois\s*=\s*(\d+)/i)
    const mPan  = ligne.match(/panier moyen\s*=\s*([\d.,]+)/i)
    if (mFact) nbTransactions = parseInt(mFact[1], 10)
    if (mPan)  panierMoyen   = parseFloat(mPan[1].replace(',', '.'))
  }

  // --- caParJour depuis la page récapitulatif (dernière valeur € de chaque ligne date) ---
  const caParJour = {}
  let dansRecap = false
  for (const ligne of toutesLignes) {
    if (/r[eé]capitulatif du mois/i.test(ligne)) { dansRecap = true; continue }
    if (!dansRecap) continue
    const m = ligne.match(RECAP_RE)
    if (m) {
      const cle = m[1].slice(0, 5) // "DD/MM"
      caParJour[cle] = parseFloat(m[2].replace(',', '.'))
    }
  }

  // --- top5 + nbArticles depuis les lignes articles de toutes les pages ---
  // nbArticles compte TOUT article (y compris "Divers x%", qui pèse la moitié
  // du CA) : les exclure serait mensonger pour un compteur d'articles vendus.
  // Le top5 continue d'exclure Divers/Menu via EXCLUS_RE — c'est voulu.
  let nbArticles = 0
  const totaux = {}
  for (const ligne of toutesLignes) {
    const art = parseArticleLine(ligne)
    if (!art) continue
    nbArticles += art.qty
    if (EXCLUS_RE.test(art.designation)) continue
    if (!totaux[art.designation]) {
      totaux[art.designation] = { designation: art.designation, qte: 0, ca: 0 }
    }
    totaux[art.designation].qte += art.qty
    totaux[art.designation].ca  += art.total
  }
  const top5 = Object.values(totaux)
    .sort((a, b) => b.qte - a.qte)
    .slice(0, 5)
    .map(p => ({ ...p, ca: parseFloat(p.ca.toFixed(2)) }))

  const caParTva = extraireCaParTva(toutesLignes)

  if (Object.keys(caParJour).length === 0) {
    throw new Error('Aucun CA journalier trouvé — la page "Récapitulatif du mois" est probablement absente de ce PDF')
  }

  return { caParJour, top5, nbTransactions, panierMoyen, labelMois, nbArticles, caParTva }
}
