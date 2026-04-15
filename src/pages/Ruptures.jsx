import { useState } from 'react'
import ProduitCard from '../components/ProduitCard'

const Ruptures = () => {
    // 1. Je définis mes données
    const produits = [
        { id: 1, designation: "COCA-COLA vanille", gamme: "Boissons", stActuel: 0 },
        { id: 2, designation: "REDBULL", gamme: "Boissons", stActuel: 2 },
        { id: 3, designation: "CRISTALINE 50cl", gamme: "Eaux", stActuel: 0 },
      ]

    const [filtre, setFiltre] = useState('tous')

    const produitsFiltres = produits.filter((p) => {
        if (filtre === 'rupture') return p.stActuel === 0
        if (filtre === 'enStock') return p.stActuel > 0
        return true
    })

    const titres = {
        tous: 'Tous les produits :',
        rupture: 'Produits en rupture :',
        enStock: 'Produits en stock :',
    }

    return (
      <div>
        <h1>Ruptures de stock</h1>
        <button onClick={() => setFiltre('tous')}>Tous</button>
        <button onClick={() => setFiltre('rupture')}>Ruptures</button>
        <button onClick={() => setFiltre('enStock')}>En stock</button>
        <h3>{titres[filtre]}</h3>
        {produitsFiltres.map(({ id, designation, gamme, stActuel }) => (
             // 3. Pour chacun, je crée une carte visuelle
            <ProduitCard
            key={id}
            designation={designation}
            gamme={gamme}
            stActuel={stActuel}
            />
        ))}
    </div>
    )
}

  export default Ruptures