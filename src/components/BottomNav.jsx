import { NavLink } from 'react-router-dom'
import { AlertTriangle, ShoppingCart, CreditCard, BarChart2 } from 'lucide-react'

const TABS = [
  { to: '/ruptures',          label: 'Ruptures',   Icon: AlertTriangle },
  { to: '/approvisionnement', label: 'Appro',      Icon: ShoppingCart  },
  { to: '/caisse',            label: 'Caisse',     Icon: CreditCard    },
  { to: '/dashboard',         label: 'Dashboard',  Icon: BarChart2     },
]

const BottomNav = () => {
  return (
    // fixed = reste visible même quand on scroll ; z-50 = passe au-dessus du contenu
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          // NavLink reçoit { isActive } et applique la classe en fonction de la route active
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
    </nav>
  )
}

export default BottomNav
