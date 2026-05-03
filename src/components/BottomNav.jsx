import { NavLink } from 'react-router-dom'
import { AlertTriangle, ShoppingCart, CreditCard, BarChart2, Package, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const TABS_TOUS = [
  { to: '/ruptures',          label: 'Ruptures',   Icon: AlertTriangle },
  { to: '/approvisionnement', label: 'Appro',      Icon: ShoppingCart  },
  { to: '/caisse',            label: 'Caisse',     Icon: CreditCard    },
  { to: '/dashboard',         label: 'Dashboard',  Icon: BarChart2     },
]

const TAB_CATALOGUE = { to: '/catalogue', label: 'Catalogue', Icon: Package }

const BottomNav = () => {
  const { logout, role } = useAuth()

  // Log temporaire — ouvre DevTools > Console pour voir la valeur exacte du rôle
  console.log('[BottomNav] role reçu depuis AuthContext :', JSON.stringify(role))

  // Comparaison normalisée : insensible à la casse et aux variantes d'accent
  const estManager = role === 'manager' || role === 'gérant' || role === 'gerant'

  const tabs = estManager ? [...TABS_TOUS, TAB_CATALOGUE] : TABS_TOUS

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-xs font-medium transition-colors ${
              isActive ? 'text-[#1D9E75]' : 'text-gray-400'
            }`
          }
        >
          <Icon size={22} strokeWidth={1.8} />
          {label}
        </NavLink>
      ))}

      <button
        onClick={logout}
        className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
      >
        <LogOut size={22} strokeWidth={1.8} />
        Déconnexion
      </button>
    </nav>
  )
}

export default BottomNav
