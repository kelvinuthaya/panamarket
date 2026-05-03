import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const getStatut = (p) => (p.st_actuel === 0 ? 'rupture' : 'insuffisant')

const BADGE = {
  rupture:    { bg: 'bg-red-500',    label: 'Rupture totale'    },
  insuffisant:{ bg: 'bg-orange-400', label: 'Stock insuffisant' },
}

const Approvisionnement = () => {
  const [produits, setProduits]   = useState([])
  const [loading, setLoading]     = useState(true)
  // Set d'ids des produits marqués comme commandés (état local uniquement)
  const [commandes, setCommandes] = useState(new Set())

  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase.from('produits').select('*')
      if (error) { console.error(error); setLoading(false); return }

      // Supabase JS ne permet pas de comparer deux colonnes directement (.lt ne prend qu'une valeur littérale)
      // → on filtre côté client, sans impact sur ~50 produits
      const aCommander = data
        .filter(p => p.st_actuel < p.st_min)
        // Ruptures en premier (urgence), puis par ordre alphabétique
        .sort((a, b) => {
          if (a.st_actuel === 0 && b.st_actuel !== 0) return -1
          if (a.st_actuel !== 0 && b.st_actuel === 0) return 1
          return a.designation.localeCompare(b.designation)
        })

      setProduits(aCommander)
      setLoading(false)
    }
    fetchProduits()
  }, [])

  const toggleCommande = (id) => {
    // On clone le Set — React détecte le changement uniquement si la référence change
    setCommandes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toutCocher = () => setCommandes(new Set(produits.map(p => p.id)))

  const nbRestants = produits.length - commandes.size

  if (loading) return <p className="p-6 text-gray-500">Chargement...</p>

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Liste de courses</h1>
        {produits.length > 0 && (
          <button
            onClick={toutCocher}
            className="text-sm font-medium text-[#1D9E75] hover:underline mt-1"
          >
            Tout cocher
          </button>
        )}
      </div>

      {produits.length > 0 && (
        <p className="text-sm text-gray-500 mb-6">
          {nbRestants > 0
            ? `${nbRestants} produit${nbRestants > 1 ? 's' : ''} à commander`
            : 'Tout a été commandé ✓'}
        </p>
      )}

      {/* ── État vide ── */}
      {produits.length === 0 && (
        <div className="mt-20 flex flex-col items-center gap-3 text-center">
          <span className="text-5xl text-[#1D9E75]">✓</span>
          <p className="text-lg font-semibold text-[#1D9E75]">Tous les stocks sont suffisants</p>
          <p className="text-sm text-gray-400">Aucun produit à commander</p>
        </div>
      )}

      {/* ── Liste ── */}
      <div className="flex flex-col gap-4">
        {produits.map(p => {
          const statut      = getStatut(p)
          const estCommande = commandes.has(p.id)

          return (
            <div
              key={p.id}
              // opacity-50 + transition pour l'effet "coché"
              className={`w-full bg-white rounded-2xl shadow-md p-5 flex flex-col gap-2 transition-opacity ${
                estCommande ? 'opacity-50' : ''
              }`}
            >
              <p className="text-xs text-gray-400 uppercase tracking-wide">{p.gamme}</p>

              <h2 className={`text-lg font-bold text-gray-900 leading-tight ${
                estCommande ? 'line-through text-gray-400' : ''
              }`}>
                {p.designation}
              </h2>

              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${BADGE[statut].bg}`}>
                  {BADGE[statut].label}
                </span>
                <span className="text-sm text-gray-700">
                  Stock : <strong>{p.st_actuel}</strong> / min {p.st_min}
                </span>
              </div>

              {/* Checkbox — label cliquable sur toute la ligne pour faciliter l'usage mobile */}
              <label className="mt-2 flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={estCommande}
                  onChange={() => toggleCommande(p.id)}
                  className="w-5 h-5 cursor-pointer accent-[#1D9E75]"
                />
                <span className={`text-sm font-medium ${
                  estCommande ? 'text-[#1D9E75]' : 'text-gray-600'
                }`}>
                  {estCommande ? 'Commandé ✓' : 'Marquer comme commandé'}
                </span>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Approvisionnement
