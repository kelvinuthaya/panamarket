// Card PANAME OS — surface blanche + bordure gauche colorée selon statut
// Variantes rupture/faible/ok ajoutent un trait 1px à GAUCHE (pas tout autour)

const STRIPE_COLORS = {
  rupture: 'bg-pavillon',
  faible:  'bg-eiffel',
  ok:      'bg-signal',
}

export const Card = ({ variant = 'default', children, className = '', onClick }) => {
  const hasStripe = variant !== 'default'

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-2xl border border-bitume/5 p-4 overflow-hidden md:transition-all md:duration-200 md:hover:-translate-y-0.5 md:hover:shadow-md ${
        onClick ? 'cursor-pointer select-none active:scale-[0.99]' : ''
      } ${className}`}
    >
      {hasStripe && (
        <div
          className={`absolute top-0 left-0 bottom-0 w-px ${STRIPE_COLORS[variant]}`}
          aria-hidden="true"
        />
      )}
      {/* pl-2 sur le contenu pour ne pas chevaucher la bordure gauche */}
      <div className={hasStripe ? 'pl-2' : ''}>{children}</div>
    </div>
  )
}
