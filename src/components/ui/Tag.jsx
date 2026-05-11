// Tag PANAME OS — petit label "tag-street" avec couleur de fond libre
// La couleur étant dynamique (hex/string), on passe par style inline :
// Tailwind ne peut pas générer une classe `bg-[#XYZ]` à partir d'une variable runtime.

export const Tag = ({ color, children }) => (
  <span
    className="tag-street rounded-md px-2 py-1 inline-block"
    style={color ? { backgroundColor: color } : undefined}
  >
    {children}
  </span>
)
