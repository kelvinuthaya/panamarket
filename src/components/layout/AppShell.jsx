// AppShell PANAME OS — coquille de l'app pour les écrans authentifiés
// Mobile/rayon (<lg) : TopBar (sticky) + main + BottomNav (fixed) + Drawer
// POS tactile paysage (lg:) : NavRail (fixed left 88px, cf. Sidebar.jsx) + main décalé
//
// min-h-[100dvh] = "dynamic viewport height" — gère la barre Safari iOS
// qui apparaît/disparaît au scroll (100vh seul casserait la hauteur).
// padding-bottom inline = inclut env(safe-area-inset-bottom) du home indicator iPhone.

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { Drawer } from './Drawer'

const ROUTE_TITLES = {
  '/':                  'Accueil',
  '/catalogue':         'Catalogue',
  '/achats':            'Achats',
  '/caisse':            'Caisse',
  '/dashboard':         'Dashboard',
  '/historique':        'Historique',
  '/approvisionnement': 'Approvisionnement',
  '/livraison':         'Livraison',
}

// Pages qui gèrent leur propre fond/padding pleine page (thème dark PANAME OS
// plein écran) : pas de wrapper max-w/px ici, sinon elles doivent le contourner
// avec des marges négatives (ancien hack -mx-4 -mt-4 encore visible dans leur
// historique git).
const FULL_BLEED_ROUTES = new Set(['/caisse', '/historique'])

export const AppShell = ({ children, title: titleOverride }) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const title = titleOverride ?? ROUTE_TITLES[location.pathname] ?? "Panam'arket"
  const fullBleed = FULL_BLEED_ROUTES.has(location.pathname)

  return (
    <div className="min-h-[100dvh] bg-calcaire">
      {/* Mode POS (lg:) : rail de navigation fixe à gauche */}
      <Sidebar />

      {/* Mobile/rayon (<lg) : top bar sticky */}
      <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />

      {/* Contenu — décalé de 88px en lg: pour ne pas passer sous le rail */}
      <main
        className="lg:ml-[88px] page-fade"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {fullBleed ? children : (
          <div className="max-w-5xl mx-auto px-4 pt-4 lg:pt-6">
            {children}
          </div>
        )}
      </main>

      {/* Mobile/rayon (<lg) : nav fixe en bas */}
      <BottomNav />

      {/* Drawer — mobile/rayon uniquement (Sidebar a son propre logout en lg:) */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
