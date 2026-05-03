const badgeClasses = {
  rupture: 'bg-red-500',
  insuffisant: 'bg-orange-400',
  ok: 'bg-green-500',
}

const badgeLabels = {
  rupture: 'Rupture',
  insuffisant: 'Insuffisant',
  ok: 'En stock',
}

// onSignalerRupture : fonction appelée quand l'employé appuie sur le bouton
const ProduitCard = ({ designation, gamme, stActuel, stMin, statut, onSignalerRupture }) => {
  const enRupture = statut === 'rupture' // st_actuel === 0

  return (
    <div className="w-full bg-white rounded-2xl shadow-md p-6 flex flex-col gap-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{gamme}</p>
      <h2 className="text-lg font-bold text-gray-900 leading-tight">{designation}</h2>

      <div className="flex items-center gap-3 mt-1">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold text-white ${badgeClasses[statut]}`}>
          {badgeLabels[statut]}
        </span>
        <span className="text-sm text-gray-700">
          Stock actuel : <strong>{stActuel}</strong>
        </span>
      </div>

      <p className="text-xs text-gray-400">Stock minimum : {stMin}</p>

      {/* Bouton désactivé si déjà en rupture — inutile de signaler à nouveau */}
      <button
        onClick={onSignalerRupture}
        disabled={enRupture}
        className={`mt-2 w-full py-2 rounded-xl text-sm font-semibold transition-colors ${
          enRupture
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
        }`}
      >
        {enRupture ? 'Déjà en rupture' : 'Signaler rupture'}
      </button>
    </div>
  )
}

export default ProduitCard
