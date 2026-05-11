// Extrait les transactions d'un PDF de caisse Secure Caisse
// Utilise window.pdfjsLib chargé via CDN dans index.html

const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

const EXCLUS_RE = /^(divers|menu)/i

// Dernier montant "X,XX €" ou "X.XX €" en fin de ligne recap journalier
const RECAP_RE = /^(\d{2}\/\d{2}\/\d{4})\s+.*?([\d]+[,.]\d{2})\s*€\s*$/

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

// Formt ligne article : "DD/MM designation[qty_collé] qty prix_unit € ..."
// Le qty est parfois collé à la désignation : "KRONENBOURG 7,2 cane2" → qty=2
function parseArticleLine(ligne) {
  const dateMatch = ligne.match(/^(\d{2}\/\d{2})\s+/)
  if (!dateMatch) return null
  const date = dateMatch[1]
  const reste = ligne.slice(dateMatch[0].length)

  const prixMatch = reste.match(/([\d]+[,.]\d{2})\s*€/)
  if (!prixMatch) return null

  const avantPrix = reste.slice(0, reste.indexOf(prixMatch[0])).trim()
  const parts = avantPrix.split(/\s+/)
  if (parts.length === 0) return null
  const dernier = parts[parts.length - 1]

  let qty, designation

  if (/^\d+$/.test(dernier)) {
    qty = parseInt(dernier, 10)
    designation = parts.slice(0, -1).join(' ').trim()
  } else {
    // qty collé à la fin du dernier mot : "cane2" → qty=2, prefix="cane"
    const colleMatch = dernier.match(/^(.+?)(\d+)$/)
    if (!colleMatch) return null
    qty = parseInt(colleMatch[2], 10)
    const prefixDesig = colleMatch[1].trim()
    designation = [...parts.slice(0, -1), prefixDesig].filter(Boolean).join(' ').trim()
  }

  const prix = parseFloat(prixMatch[1].replace(',', '.'))
  if (!designation || qty <= 0 || isNaN(prix)) return null

  return { date, designation, qty, prix }
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

  // --- top5 depuis les lignes articles de toutes les pages ---
  const totaux = {}
  for (const ligne of toutesLignes) {
    const art = parseArticleLine(ligne)
    if (!art || EXCLUS_RE.test(art.designation)) continue
    if (!totaux[art.designation]) {
      totaux[art.designation] = { designation: art.designation, qte: 0, ca: 0 }
    }
    totaux[art.designation].qte += art.qty
    totaux[art.designation].ca  += art.prix * art.qty
  }
  const top5 = Object.values(totaux)
    .sort((a, b) => b.qte - a.qte)
    .slice(0, 5)
    .map(p => ({ ...p, ca: parseFloat(p.ca.toFixed(2)) }))

  return { caParJour, top5, nbTransactions, panierMoyen, labelMois }
}
