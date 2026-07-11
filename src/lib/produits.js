// Logique métier produits — extraite des pages Catalogue/Gestion.
// Pas de React ici, uniquement des constantes et fonctions pures.

export const GAMMES = [
  'Boissons énergétiques', 'Alcools','Autres', 'Boissons', 'Confiseries', 'Eaux', 'Épicerie salée', 'Pains et patisserie', 'Produits laitiers', 'Puffs',
  'Snacks', 'Hygiène', 
]

export const FORM_VIDE = {
  designation: '', gamme: '',
  code: '', st_actuel: '', st_min: '', pr_vente: '', pr_vente_especes: '',
}

// Statut de stock partagé par toutes les pages (Catalogue, Caisse, Achats).
// 'faible' = stock insuffisant (entre 0 exclu et st_min exclu).
export function getStatut(p) {
  if (p.st_actuel === 0) return 'rupture'
  if (p.st_actuel < p.st_min) return 'faible'
  return 'ok'
}

// Interroge Open Food Facts pour un code EAN.
// Retourne { designation, gamme } si trouvé, null sinon.
// Laisse remonter les erreurs réseau : chaque appelant affiche son propre message.
export async function chercherProduitOFF(code) {
  const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
  const data = await res.json()
  if (data.status !== 1) return null
  return {
    designation: data.product.product_name || '',
    gamme:       detecterGamme(data.product.categories_tags),
  }
}

export function detecterGamme(categoriesTags = []) {
  const cats = categoriesTags.map(c => c.toLowerCase())
  if (cats.some(c => c.includes('energy-drink'))) return 'Boissons énergétiques'
  if (cats.some(c =>
    c.includes('alcohol') || c.includes('beer') || c.includes('wine') ||
    c.includes('spirit') || c.includes('liqueur') || c.includes('aperitif')
  )) return 'Alcools'
  if (cats.some(c =>
    c.includes('confection') || c.includes('candy') || c.includes('chocolate') ||
    c.includes('biscuit') || c.includes('sweet') || c.includes('bonbon')
  )) return 'Confiseries'
  if (cats.some(c =>
    c.includes('snack') || c.includes('chip') || c.includes('crisp') || c.includes('nuts')
  )) return 'Snacks'
  if (cats.some(c =>
    c.includes('hygiene') || c.includes('personal-care') ||
    c.includes('cosmetic') || c.includes('soap') || c.includes('shampoo')
  )) return 'Hygiène'
  return 'Autres'
}
