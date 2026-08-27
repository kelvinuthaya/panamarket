// NavRail PANAME OS — desktop/POS uniquement (lg:), export nommé Sidebar
// pour ne pas casser les imports existants (AppShell).
// 88px fixe (icônes + labels empilés), fond bitume, full height. Rail étroit
// pensé pour le mode caisse tactile paysage : libère un maximum de largeur
// pour le contenu (grille produits + ticket) sur un écran 1366px.
// En dessous de lg: (mobile/rayon), TopBar + BottomNav prennent le relais.

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
import logoPanamarket from '../../assets/logo-panamarket.png'

const PRIMARY_LINKS = [
  { to: '/',           label: 'Accueil',    Icon: Home          },
  { to: '/catalogue',  label: 'Catalogue',  Icon: Package       },
  { to: '/achats',     label: 'Achats',     Icon: ShoppingCart  },
  { to: '/caisse',     label: 'Caisse',     Icon: Wallet        },
  { to: '/historique', label: 'Historique', Icon: CalendarClock, gerantOnly: true },
  { to: '/dashboard',  label: 'Dashboard',  Icon: BarChart3,     gerantOnly: true },
]

// Icône au-dessus du label, empilés — cible tactile ~72px de haut sur
// toute la largeur du rail (88px). Même logique visuelle que BottomNav
// (mobile) pour rester cohérent entre les deux modes.
const NavRailLink = ({ to, Icon, children }) => (
  <NavLink to={to} end={to === '/'} className="w-full px-2" title={children}>
    {({ isActive }) => (
      <div
        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl transition select-none ${
          isActive ? 'bg-paname-700' : 'active:bg-white/10'
        }`}
      >
        <Icon
          size={24}
          strokeWidth={isActive ? 2.2 : 1.8}
          className={isActive ? 'text-white' : 'text-white/60'}
        />
        <span className={`tag-street text-center leading-tight ${isActive ? 'text-white' : 'text-white/50'}`}>
          {children}
        </span>
      </div>
    )}
  </NavLink>
)

export const Sidebar = () => {
  const { user, role, logout } = useAuth()
  // estGerant : accès Dashboard + Historique + suppressions.
  const estGerant = role === 'gerant'
  // Libellé + couleur selon le rôle réel (3 niveaux)
  const roleLabel = role === 'gerant' ? 'GÉRANT' : role === 'manager' ? 'MANAGER' : 'EMPLOYÉ'
  const roleColor = role === 'gerant' ? 'text-eiffel' : role === 'manager' ? 'text-paname-300' : 'text-white/50'
  // Initiales depuis l'email — fallback "U" si pas connecté
  const initiales = (user?.email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 bottom-0 w-[88px] bg-bitume bg-grain text-white flex-col items-center z-30">
      {/* Logo compact — vrai logo du commerce, redimensionné pour tenir dans 88px */}
      <div className="w-full pt-5 pb-4 flex flex-col items-center gap-1 border-b border-white/10">
        <img src={logoPanamarket} alt="Panam'arket" className="w-14" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 w-full overflow-y-auto pos-scroll py-3 flex flex-col items-center gap-1.5">
        {PRIMARY_LINKS
          .filter(({ gerantOnly }) => !gerantOnly || estGerant)
          .map(({ to, label, Icon }) => (
            <NavRailLink key={to} to={to} Icon={Icon}>
              {label}
            </NavRailLink>
          ))}
      </nav>

      {/* Footer utilisateur — initiales sur gradient paname (title = email
          complet au survol souris), rôle en tag-street, logout en dessous
          (cible 48px, pas de place pour l'email complet à 88px de large). */}
      <div className="w-full border-t border-white/10 py-3 flex flex-col items-center gap-2">
        <div
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-paname-700 to-paname-500 flex items-center justify-center font-display font-bold text-white shrink-0"
          title={user?.email ?? 'Anonyme'}
        >
          {initiales}
        </div>
        <div className={`tag-street ${roleColor}`}>
          {roleLabel}
        </div>
        <button
          onClick={logout}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 active:bg-pavillon/20 active:text-pavillon transition shrink-0"
        >
          <LogOut size={20} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  )
}
