import { Link } from 'react-router-dom'
import { Package, ShoppingCart, Wallet, BarChart3 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABEL = { gerant: 'Gérant', manager: 'Manager' }

const TILES = [
  { to: '/catalogue', label: 'Catalogue', Icon: Package      },
  { to: '/achats',    label: 'Achats',    Icon: ShoppingCart },
  { to: '/caisse',    label: 'Caisse',    Icon: Wallet       },
  { to: '/dashboard', label: 'Dashboard', Icon: BarChart3, gerantOnly: true },
]

export default function Home() {
  const { user, role } = useAuth()
  const estManager = role === 'manager' || role === 'gerant'
  const estGerant  = role === 'gerant'
  const roleLabel  = ROLE_LABEL[role] ?? 'Employé'
  const nom        = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur'

  const tiles = TILES.filter(t => {
    if (t.gerantOnly)  return estGerant
    if (t.managerOnly) return estManager
    return true
  })

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div>
        {/* Sur-titre tag-street : même convention de header que les autres pages */}
        <p className="tag-street text-zinc-400">PANAM'ARKET · 75020</p>
        <h1 className="font-display font-bold text-2xl text-bitume leading-tight mt-1">
          Bonjour {nom}
        </h1>
        <span className="inline-block mt-2 tag-street text-paname-700 bg-paname-700/10 px-2 py-0.5 rounded-full">
          {roleLabel.toUpperCase()}
        </span>
      </div>

      {/* Grille de tuiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-white border border-bitume/10 rounded-2xl p-5 flex flex-col items-center gap-3 hover:border-paname-700/40 md:hover:shadow-md transition group"
          >
            <Icon
              size={28}
              strokeWidth={1.6}
              className="text-paname-700 group-hover:scale-105 transition-transform"
            />
            <span className="text-sm font-medium text-bitume">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
