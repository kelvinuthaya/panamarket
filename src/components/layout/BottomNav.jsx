// BottomNav PANAME OS — mobile uniquement, fixé en bas
// 4 onglets : Catalogue / Achats / Caisse / Dashboard
// padding-bottom INLINE (pas en className) pour respecter env(safe-area-inset-bottom)
// — Tailwind purgerait une classe arbitraire avec env() en build prod

import { NavLink } from 'react-router-dom'
import { Home, Package, ShoppingCart, Wallet, BarChart3 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const BASE_TABS = [
  { to: '/',          label: 'Accueil',   Icon: Home         },
  { to: '/catalogue', label: 'Catalogue', Icon: Package      },
  { to: '/achats',    label: 'Achats',    Icon: ShoppingCart },
  { to: '/caisse',    label: 'Caisse',    Icon: Wallet       },
  { to: '/dashboard', label: 'Dashboard', Icon: BarChart3,   gerantOnly: true },
]

export const BottomNav = () => {
  const { role } = useAuth()
  const estManager = role === 'manager' || role === 'gerant'
  const estGerant  = role === 'gerant'
  const tabs = BASE_TABS.filter(t => {
    if (t.gerantOnly)  return estGerant
    if (t.managerOnly) return estManager
    return true
  })

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bitume px-3 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="flex justify-around gap-2">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="flex-1">
            {({ isActive }) => (
              <div
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition ${
                  isActive ? 'bg-paname-700' : ''
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={isActive ? 'text-white' : 'text-white/50'}
                />
                <span className={`tag-street ${isActive ? 'text-white' : 'text-white/50'}`}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
