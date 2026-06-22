// Logique métier produits — extraite des pages Catalogue/Gestion.
// Pas de React ici, uniquement des constantes et fonctions pures.

export const GAMMES = [
  'Boissons énergétiques', 'Alcools', 'Confiseries',
  'Snacks', 'Hygiène', 'Autres',
]

export const FORM_VIDE = {
  designation: '', gamme: 'Boissons énergétiques',
  code: '', st_actuel: '', st_min: '', pr_vente: '', pr_vente_especes: '',
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
