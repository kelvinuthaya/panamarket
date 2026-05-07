import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Plus, Minus, Check, ChevronDown, ChevronUp, X } from 'lucide-react'

const SEUILS_DLC = {
  'Boissons énergétiques': 14,
  'Alcools': 60,
  'Confiseries': 14,
  'Snacks': 14,
  'Hygiène': 60,
  'default': 7,
}

export default function Livraison() {
  const [produits, setProduits]     = useState([])
  const [recherche, setRecherche]   = useState('')
  const [lignes, setLignes]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast]           = useState('')
  const [livraisonOuverte, setLivraisonOuverte] = useState(true)

  const livraisonRef = useRef(null)

  const todayFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase
        .from('produits')
        .select('id, designation, gamme, st_actuel')
        .order('designation')
      if (!error) setProduits(data ?? [])
      setLoading(false)
    }
    fetchProduits()
  }, [])

  // ── Toast auto-dismiss 2.5 s ───────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ── Computed ───────────────────────────────────────────────────────────────
  const produitsFiltrés = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  // ── Actions ────────────────────────────────────────────────────────────────
  function ajouterLigne(produit) {
    setLignes(prev => [...prev, {
      produit_id:  produit.id,
      designation: produit.designation,
      gamme:       produit.gamme,
      quantite:    1,
      dlc:         '',
    }])
    setLivraisonOuverte(true)
    // Scroll vers la section livraison au premier ajout
    setTimeout(() => livraisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function mettreAJourLigne(index, champ, valeur) {
    setLignes(prev => prev.map((l, i) => i === index ? { ...l, [champ]: valeur } : l))
  }

  function supprimerLigne(index) {
    setLignes(prev => prev.filter((_, i) => i !== index))
  }

  async function validerLivraison() {
    if (lignes.length === 0 || lignes.some(l => l.quantite < 1 || !l.dlc)) {
      setToast('Remplis toutes les lignes')
      return
    }
    setSubmitting(true)

    // 1. Insert livraison
    const { data: livraison, error: errLiv } = await supabase
      .from('livraisons')
      .insert({ lignes })
      .select()
      .single()

    if (errLiv) {
      setToast('Erreur enregistrement — réessayez')
      setSubmitting(false)
      return
    }

    // 2. Insert stock_dlc — une ligne par produit reçu
    const stockDlcRows = lignes.map(l => ({
      produit_id:   l.produit_id,
      dlc:          l.dlc,
      quantite:     Number(l.quantite),
      livraison_id: livraison.id,
    }))
    await supabase.from('stock_dlc').insert(stockDlcRows)

    // 3. Update st_actuel — agrégé par produit_id si plusieurs lignes identiques
    const totaux = {}
    lignes.forEach(l => {
      totaux[l.produit_id] = (totaux[l.produit_id] ?? 0) + Number(l.quantite)
    })
    await Promise.all(Object.entries(totaux).map(([id, total]) => {
      const produit = produits.find(p => p.id === Number(id))
      return supabase.from('produits').update({
        st_actuel: (produit?.st_actuel ?? 0) + total,
      }).eq('id', Number(id))
    }))

    setLignes([])
    setToast('Livraison enregistrée ✓')
    setSubmitting(false)
  }

  // DLC dans les X jours → alerte visuelle sur le champ
  function dlcProche(gamme, dlcStr) {
    if (!dlcStr) return false
    const seuil = SEUILS_DLC[gamme] ?? SEUILS_DLC['default']
    const diff = Math.ceil((new Date(dlcStr) - new Date()) / 86400000)
    return diff <= seuil
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── TOAST ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-gray-800 text-white text-sm font-medium px-4 py-3 rounded-xl text-center shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="mb-3">
          <h1 className="text-lg font-semibold text-gray-800">Livraison</h1>
          <p className="text-xs text-gray-400 capitalize">{todayFr}</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
          />
        </div>
      </header>

      {/* ── LISTE PRODUITS ────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-2">
        {produitsFiltrés.length === 0 && (
          <p className="text-center text-gray-400 mt-16 text-sm">Aucun produit trouvé.</p>
        )}
        {produitsFiltrés.map(p => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
              <p className="text-xs text-gray-400">{p.gamme}</p>
            </div>
            <button
              onClick={() => ajouterLigne(p)}
              className="w-9 h-9 rounded-lg bg-[#1D9E75] flex items-center justify-center text-white shrink-0 active:opacity-80"
              aria-label={`Ajouter ${p.designation}`}
            >
              <Plus size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* ── SECTION LIVRAISON ─────────────────────────────────────────────────── */}
      {lignes.length > 0 && (
        <div className="px-4 pb-4" ref={livraisonRef}>

          {/* En-tête de section avec toggle */}
          <button
            onClick={() => setLivraisonOuverte(o => !o)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="text-base font-bold text-gray-800">
              Produits à réceptionner
              <span className="ml-2 text-sm font-semibold text-[#1D9E75]">({lignes.length})</span>
            </h2>
            {livraisonOuverte
              ? <ChevronUp size={18} className="text-gray-400" />
              : <ChevronDown size={18} className="text-gray-400" />
            }
          </button>

          {livraisonOuverte && (
            <>
              <div className="space-y-2 mb-4">
                {lignes.map((l, i) => {
                  const alerte = dlcProche(l.gamme, l.dlc)
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 px-3 py-3">

                      {/* Ligne produit + bouton supprimer */}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-gray-800 truncate flex-1">
                          {l.designation}
                        </p>
                        <button
                          onClick={() => supprimerLigne(i)}
                          className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center shrink-0 active:bg-red-100"
                          aria-label="Supprimer cette ligne"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Contrôles quantité + DLC */}
                      <div className="flex gap-2 items-end">

                        {/* Quantité avec boutons -/+ */}
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Quantité</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => mettreAJourLigne(i, 'quantite', Math.max(1, l.quantite - 1))}
                              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 active:bg-gray-50"
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={l.quantite}
                              onChange={e => mettreAJourLigne(i, 'quantite', Math.max(1, Number(e.target.value)))}
                              className="w-12 text-center border border-gray-200 rounded-lg text-sm py-1.5 outline-none focus:border-[#1D9E75]"
                            />
                            <button
                              onClick={() => mettreAJourLigne(i, 'quantite', l.quantite + 1)}
                              className="w-8 h-8 rounded-lg bg-[#1D9E75] flex items-center justify-center text-white active:opacity-80"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>

                        {/* DLC avec alerte visuelle si date proche */}
                        <div className="flex-1">
                          <p className={`text-[10px] mb-1 ${alerte ? 'text-orange-500 font-semibold' : 'text-gray-400'}`}>
                            DLC{alerte ? ' ⚠ date proche' : ''}
                          </p>
                          <input
                            type="date"
                            value={l.dlc}
                            onChange={e => mettreAJourLigne(i, 'dlc', e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded-lg text-sm outline-none focus:border-[#1D9E75] ${
                              alerte ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                            }`}
                          />
                        </div>

                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bouton valider */}
              <button
                onClick={validerLivraison}
                disabled={submitting}
                className="w-full bg-[#1D9E75] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50 active:opacity-80 flex items-center justify-center gap-2"
              >
                <Check size={17} />
                {submitting
                  ? 'Enregistrement…'
                  : `Valider la livraison (${lignes.length} ligne${lignes.length > 1 ? 's' : ''})`
                }
              </button>
            </>
          )}

        </div>
      )}

    </div>
  )
}
