// Bouton PANAME OS — 5 variantes + 4 tailles
// variant : primary | gold | danger | ghost | dark
// size    : sm | md | lg | pos (56px, cible tactile caisse)
// La variante 'primary' en taille 'lg' applique tag-street UPPERCASE (CTA héros)
//
// Usage tactile (écran caisse) : chaque variante répond à `active:` en plus
// de `hover:` — sur un écran tactile il n'y a pas de survol, seul l'état
// pressé donne le retour visuel qui confirme le tap.

const VARIANT_CLASSES = {
  primary: 'bg-paname-700 text-white shadow-paname hover:bg-paname-900 active:bg-paname-900',
  gold:    'bg-eiffel text-yellow-950 shadow-or font-bold active:brightness-95',
  danger:  'bg-pavillon text-white shadow-rouge active:brightness-90',
  ghost:   'bg-transparent border-2 border-bitume/10 text-bitume hover:bg-bitume/5 active:bg-bitume/10',
  dark:    'bg-bitume-2 text-white border border-white/10 hover:bg-bitume-3 active:bg-bitume-3',
}

// Hauteurs alignées sur la cible tactile minimale (48px), 'pos' à 56px pour
// les actions fréquentes de la caisse (valider, +/-).
const SIZE_CLASSES = {
  sm:  'h-10 px-3 text-sm',
  md:  'h-12 px-4 text-base',
  lg:  'h-14 px-6 text-lg',
  pos: 'h-14 px-6 text-lg',
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  type = 'button',
  className = '',
}) => {
  // Effet "label rue" réservé au CTA primaire le plus important
  const heroLabel = variant === 'primary' && size === 'lg' ? 'tag-street' : ''
  const base =
    'rounded-2xl font-semibold transition select-none active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${heroLabel} ${className}`}
    >
      {children}
    </button>
  )
}
