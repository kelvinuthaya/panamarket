// Bouton PANAME OS — 5 variantes + 3 tailles
// variant : primary | gold | danger | ghost | dark
// size    : sm | md | lg
// La variante 'primary' en taille 'lg' applique tag-street UPPERCASE (CTA héros)

const VARIANT_CLASSES = {
  primary: 'bg-paname-700 text-white shadow-paname hover:bg-paname-900',
  gold:    'bg-eiffel text-yellow-950 shadow-or font-bold',
  danger:  'bg-pavillon text-white shadow-rouge',
  ghost:   'bg-transparent border-2 border-bitume/10 text-bitume hover:bg-bitume/5',
  dark:    'bg-bitume-2 text-white border border-white/10 hover:bg-bitume-3',
}

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-6 py-3.5 text-lg',
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
    'rounded-2xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'

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
