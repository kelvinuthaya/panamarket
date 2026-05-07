// Lit le CSV export caisse (encodage latin-1, séparateur ;)
// Cherche la section récapitulatif TVA — lignes commençant par DD/MM/YYYY
// Extrait pour chaque jour : alim (5.5%), alcool (20%), resto (10%), flask (2%)

const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/

function lireLatin1(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file, 'iso-8859-1')
  })
}

function parseFloat_fr(str) {
  // Gère "1 234,56" (espace milliers, virgule décimale) et "1234.56"
  return parseFloat((str ?? '').replace(/\s/g, '').replace(',', '.')) || 0
}

// Détecte les colonnes TVA à partir d'une ligne d'en-tête
function detecterColonnes(parts) {
  let alim = -1, alcool = -1, resto = -1, flask = -1
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].toLowerCase().replace(/\s/g, '').replace(',', '.')
    if (/5\.5/.test(p))                             alim   = i
    else if (/\b20[.\b%]/.test(p) || p === '20')   alcool = i
    else if (/\b10[.\b%]/.test(p) || p === '10')   resto  = i
    // 2% = "2" ou "2%" mais pas "20%" ni "12%" → on teste en dernier
    else if (/^2[%.]?$/.test(p) || p === 'flask')  flask  = i
  }
  return { alim, alcool, resto, flask }
}

export async function parseCsvCA(file) {
  const text = await lireLatin1(file)
  const rows = text.split(/\r?\n/).map(l => l.split(';'))

  let cols = { alim: -1, alcool: -1, resto: -1, flask: -1 }
  let headerTrouve = false
  const donneesParJour = {}
  let premierMois = ''

  for (const parts of rows) {
    // Chercher la ligne d'en-tête contenant des taux de TVA
    if (!headerTrouve) {
      const row = parts.join(';').replace(',', '.')
      if (/5\.?5/.test(row) && /\b20\b/.test(row)) {
        cols = detecterColonnes(parts)
        headerTrouve = true
        continue
      }
    }

    // Chercher une cellule au format DD/MM/YYYY dans la ligne (peut ne pas être la première colonne)
    const datePart = parts.find(p => DATE_RE.test(p.trim()))
    if (!datePart) continue

    const [dd, mm, yyyy] = datePart.trim().split('/')
    const cle = `${dd}/${mm}`
    if (!premierMois) premierMois = `${mm}/${yyyy}`

    if (!donneesParJour[cle]) {
      donneesParJour[cle] = { alim: 0, alcool: 0, resto: 0, flask: 0 }
    }
    const get = idx => idx >= 0 ? parseFloat_fr(parts[idx]) : 0
    donneesParJour[cle].alim   += get(cols.alim)
    donneesParJour[cle].alcool += get(cols.alcool)
    donneesParJour[cle].resto  += get(cols.resto)
    donneesParJour[cle].flask  += get(cols.flask)
  }

  // Construire le label "Janvier 2026"
  const [mm2, yyyy2] = (premierMois || '01/2026').split('/')
  const labelMois = `${MOIS[parseInt(mm2, 10)] ?? mm2} ${yyyy2}`

  return { donneesParJour, labelMois, cols }
}
