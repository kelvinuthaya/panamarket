// Badge PANAME OS — pastille statut (rupture/faible/ok/info)
// Toutes les variantes utilisent le style "tag-street" (mono uppercase serré)

const VARIANT_CLASSES = {
  rupture: 'bg-pavillon text-white',
  faible:  'bg-eiffel text-yellow-950',
  ok:      'bg-signal text-white',
  info:    'bg-paname-700 text-white',
}

export const Badge = ({ variant = 'info', children }) => (
  <span
    className={`tag-street px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 ${VARIANT_CLASSES[variant]}`}
  >
    {children}
  </span>
)
