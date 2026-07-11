// Drawer PANAME OS — sheet qui slide depuis la droite
// Backdrop noir/40 cliquable pour fermer + slide via translate-x

import { X, LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'


const DrawerButton = ({ Icon, onClick, children, danger = false }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition text-left ${
      danger
        ? 'text-pavillon hover:bg-pavillon/10'
        : 'text-white/80 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={18} strokeWidth={1.8} />
    <span className="text-sm font-medium">{children}</span>
  </button>
)

export const Drawer = ({ open, onClose }) => {
  const { logout } = useAuth()

  return (
    <>
      {/* Backdrop — click pour fermer */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Sheet droit */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-bitume text-white transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="tag-street text-white/60">MENU</span>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex flex-col p-2">
          <DrawerButton Icon={LogOut} onClick={logout} danger>
            Déconnexion
          </DrawerButton>
        </nav>
      </aside>
    </>
  )
}
