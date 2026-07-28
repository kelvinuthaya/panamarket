// TopBar PANAME OS — barre du haut mobile/rayon uniquement (<lg)
// Hauteur = safe-area-inset-top + 56px (la notch iPhone repousse le contenu)
// Affiche le titre courant + bouton menu burger qui ouvre le Drawer

import { Menu } from 'lucide-react'

export const TopBar = ({ title = '', onMenuClick }) => (
  <header
    className="lg:hidden sticky top-0 z-30 bg-calcaire flex items-center justify-between px-4 border-b border-bitume/5"
    style={{
      paddingTop: 'env(safe-area-inset-top)',
      // 56px de contenu visible sous la safe-area
      minHeight: 'calc(env(safe-area-inset-top) + 56px)',
    }}
  >
    <h1 className="font-display font-bold text-xl text-bitume truncate">{title}</h1>
    <button
      onClick={onMenuClick}
      aria-label="Ouvrir le menu"
      className="w-10 h-10 rounded-xl flex items-center justify-center text-bitume hover:bg-bitume/5 transition shrink-0"
    >
      <Menu size={22} strokeWidth={2} />
    </button>
  </header>
)
