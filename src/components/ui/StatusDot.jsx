// StatusDot PANAME OS — pastille 8px avec halo pulsant optionnel
// L'animation pulse est définie dans src/index.css (.animate-status-pulse)

const DOT_COLORS = {
  rupture: 'bg-pavillon',
  faible:  'bg-eiffel',
  ok:      'bg-signal',
  info:    'bg-paname-700',
}

export const StatusDot = ({ variant = 'ok', pulse = true }) => (
  <span className="relative inline-flex w-2 h-2" aria-hidden="true">
    {/* Halo qui se diffuse vers l'extérieur — masqué via aria-hidden, purement visuel */}
    {pulse && (
      <span
        className={`absolute inset-0 rounded-full opacity-60 animate-status-pulse ${DOT_COLORS[variant]}`}
      />
    )}
    <span className={`relative inline-block w-2 h-2 rounded-full ${DOT_COLORS[variant]}`} />
  </span>
)
