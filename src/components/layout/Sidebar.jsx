// Sidebar PANAME OS — desktop uniquement (md:)
// 240px fixe, fond bitume, full height. Contient logo, liens principaux,
// liens secondaires (filtrés selon rôle), footer utilisateur.

import { NavLink } from 'react-router-dom'
import {
  Home,
  BarChart3,
  Package,
  ShoppingCart,
  Wallet,
  CalendarClock,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const PRIMARY_LINKS = [
  { to: '/',           label: 'Accueil',    Icon: Home          },
  { to: '/catalogue',  label: 'Catalogue',  Icon: Package       },
  { to: '/achats',     label: 'Achats',     Icon: ShoppingCart  },
  { to: '/caisse',     label: 'Caisse',     Icon: Wallet        },
  { to: '/historique', label: 'Historique', Icon: CalendarClock, gerantOnly: true },
  { to: '/dashboard',  label: 'Dashboard',  Icon: BarChart3,     gerantOnly: true },
]

const SidebarLink = ({ to, Icon, children }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
        isActive
          ? 'bg-paname-700 text-white font-semibold'
          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`
    }
  >
    <Icon size={18} strokeWidth={1.8} />
    <span className="text-sm">{children}</span>
  </NavLink>
)

export const Sidebar = () => {
  const { user, role, logout } = useAuth()
  // estManager : peut éditer le catalogue. estGerant : accès Dashboard + suppressions.
  const estManager = role === 'manager' || role === 'gerant'
  const estGerant  = role === 'gerant'
  // Libellé + couleur selon le rôle réel (3 niveaux)
  const roleLabel = role === 'gerant' ? 'GÉRANT' : role === 'manager' ? 'MANAGER' : 'EMPLOYÉ'
  const roleColor = role === 'gerant' ? 'text-eiffel' : role === 'manager' ? 'text-paname-300' : 'text-white/50'
  // Initiales depuis l'email — fallback "U" si pas connecté
  const initiales = (user?.email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-60 bg-bitume bg-grain text-white flex-col z-30">
      {/* Logo + lieu */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <div className="font-display font-bold text-2xl leading-none">Panam'arket</div>
        <div className="tag-street text-eiffel mt-1">75020 · BELLEVILLE</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
        {PRIMARY_LINKS
          .filter(({ gerantOnly }) => !gerantOnly || estGerant)
          .map(({ to, label, Icon }) => (
            <SidebarLink key={to} to={to} Icon={Icon}>
              {label}
            </SidebarLink>
          ))}
      </nav>

      {/* Footer utilisateur — initiales sur gradient paname, rôle en eiffel pour gérant,
          bouton déconnexion à droite (sinon pas de logout sur desktop) */}
      <div className="border-t border-white/10 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-paname-700 to-paname-500 flex items-center justify-center font-display font-bold text-white shrink-0">
          {initiales}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">
            {user?.email ?? 'Anonyme'}
          </div>
          <div className={`tag-street ${roleColor}`}>
            {roleLabel}
          </div>
        </div>
        <button
          onClick={logout}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:bg-pavillon/20 hover:text-pavillon transition shrink-0"
        >
          <LogOut size={16} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  )
}
