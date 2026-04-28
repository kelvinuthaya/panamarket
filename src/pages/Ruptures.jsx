import { useEffect, useState } from 'react'
import ProduitCard from '../components/ProduitCard'
import { supabase } from '../lib/supabase'

const FILTRES = [
  { key: 'tous', label: 'Tous' },
  { key: 'rupture', label: 'Rupture' },
  { key: 'insuffisant', label: 'Stock insuffisant' },
  { key: 'ok', label: 'En stock' },
]

const getStatut = (p) => {
  if (p.st_actuel === 0) return 'rupture'
  if (p.st_actuel < p.st_min) return 'insuffisant'
  return 'ok'
}

const titres = {
  tous: 'Tous les produits',
  rupture: 'Produits en rupture',
  insuffisant: 'Stock insuffisant',
  ok: 'Produits en stock',
}

const Ruptures = () => {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')

  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase.from('produits').select('*')
      if (error) console.error(error)
      else setProduits(data)
      setLoading(false)
    }
    fetchProduits()
  }, [])

  const produitsFiltres = produits.filter((p) =>
    filtre === 'tous' ? true : getStatut(p) === filtre
  )

  if (loading) return <p className="p-6 text-gray-500">Chargement...</p>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ruptures de stock</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTRES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltre(key)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filtre === key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <h2 className="text-base font-semibold text-gray-500 mb-4">
        {titres[filtre]} ({produitsFiltres.length})
      </h2>

      <div className="flex flex-col gap-4">
        {produitsFiltres.map((p) => (
          <ProduitCard
            key={p.id}
            designation={p.designation}
            gamme={p.gamme}
            stActuel={p.st_actuel}
            stMin={p.st_min}
            statut={getStatut(p)}
          />
        ))}
      </div>
    </div>
  )
}

export default Ruptures
