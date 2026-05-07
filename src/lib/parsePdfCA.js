// Extrait les transactions d'un PDF de caisse
// Utilise window.pdfjsLib chargé via CDN dans index.html
// Format attendu par ligne : DD/MM  designation  qty  prix.XX €

const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

// Regex : date  tout-ce-qui-est-désignation  quantité-entière  prix-décimal
// Le ?= lookahead permet au .+ non-greedy de laisser les 2 derniers tokens à qty/prix
const ARTICLE_RE = /^(\d{2}\/\d{2})\s+(.+?)\s+(\d+)\s+([\d]+[,.][\d]{2})\s*€?\s*$/i

// Lignes à ignorer dans le top 5 (produits fourre-tout)
const EXCLUS_RE = /^(divers|menu)/i

// Marqueur de fin de ticket → pour compter le nb de transactions
const TICKET_TOTAL_RE = /total\s*[:\s]\s*[\d,]+[,.][\d]{2}\s*€/i

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
  // Tri : Y décroissant = du haut vers le bas de page
  return groupes
    .sort((a, b) => b.y - a.y)
    .map(g =>
      g.items
        .sort((a, b) => a.transform[4] - b.transform[4]) // tri X (gauche → droite)
        .map(i => i.str)
        .join(' ')
        .trim()
    )
}

export async function parsePdfCA(file) {
  const pdfjsLib = window.pdfjsLib
  if (!pdfjsLib) throw new Error('pdf.js non chargé — vérifier index.html')

  // Pointer le worker sur le même CDN que la lib
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const articles = []   // { date: 'DD/MM', designation, qty, prix }
  const toutesLignes = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lignes = grouperParLigne(content.items)
    toutesLignes.push(...lignes)

    for (const ligne of lignes) {
      const m = ligne.match(ARTICLE_RE)
      if (m && !EXCLUS_RE.test(m[2].trim())) {
        articles.push({
          date:        m[1],
          designation: m[2].trim(),
          qty:         parseInt(m[3], 10),
          prix:        parseFloat(m[4].replace(',', '.')),
        })
      }
    }
  }

  console.log('[PDF lignes brutes]', toutesLignes.slice(0, 40))

  // CA par jour
  const caParJour = {}
  for (const a of articles) {
    caParJour[a.date] = (caParJour[a.date] ?? 0) + a.prix * a.qty
  }

  // Top 5 produits par quantité totale vendue
  const totaux = {}
  for (const a of articles) {
    if (!totaux[a.designation]) {
      totaux[a.designation] = { designation: a.designation, qte: 0, ca: 0 }
    }
    totaux[a.designation].qte += a.qty
    totaux[a.designation].ca  += a.prix * a.qty
  }
  const top5 = Object.values(totaux)
    .sort((a, b) => b.qte - a.qte)
    .slice(0, 5)
    .map(p => ({ ...p, ca: parseFloat(p.ca.toFixed(2)) }))

  // Compter les tickets (lignes "Total : X.XX €") ; sinon compter les lignes article
  const nbTickets = toutesLignes.filter(l => TICKET_TOTAL_RE.test(l)).length
  const nbTransactions = nbTickets > 0 ? nbTickets : articles.length

  const caTotal = Object.values(caParJour).reduce((s, v) => s + v, 0)
  const panierMoyen = nbTransactions > 0
    ? parseFloat((caTotal / nbTransactions).toFixed(2))
    : null

  // Déduire le mois depuis la première date trouvée
  const premierDate = articles[0]?.date ?? '01/01'
  const mm = parseInt(premierDate.split('/')[1], 10)
  const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const labelMois = MOIS[mm] ?? `Mois ${mm}`

  return { caParJour, top5, nbTransactions, panierMoyen, labelMois }
}
