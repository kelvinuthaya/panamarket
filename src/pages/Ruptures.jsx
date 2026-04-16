import { useEffect, useState } from 'react'
import ProduitCard from '../components/ProduitCard'
import { supabase } from '../lib/supabase'

const Ruptures = () => {
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')

  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase
        .from('produits')
        .select('*')
      if (error) console.error(error)
      else setProduits(data)
      setLoading(false)
    }
    fetchProduits()
  }, [])

  const produitsFiltres = produits.filter((p) => {
    if (filtre === 'rupture') return p.st_actuel < p.st_min
    if (filtre === 'enStock') return p.st_actuel >= p.st_min
    return true
  })

  const titres = {
    tous: 'Tous les produits :',
    rupture: 'Produits en rupture :',
    enStock: 'Produits en stock :',
  }

  if (loading) return <p>Chargement...</p>

  return (
    <div>
      <h1>Ruptures de stock</h1>
      <button onClick={() => setFiltre('tous')}>Tous</button>
      <button onClick={() => setFiltre('rupture')}>Ruptures</button>
      <button onClick={() => setFiltre('enStock')}>En stock</button>
      <h3>{titres[filtre]}</h3>
      {produitsFiltres.map((p) => (
        <ProduitCard
          key={p.id}
          designation={p.designation}
          gamme={p.gamme}
          stActuel={p.st_actuel}
          stMin={p.st_min}
        />
      ))}
    </div>
  )
}

export default Ruptures