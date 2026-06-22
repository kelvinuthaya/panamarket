// AppShell PANAME OS — coquille de l'app pour les écrans authentifiés
// Mobile  : TopBar (sticky) + main + BottomNav (fixed) + Drawer
// Desktop : Sidebar (fixed left 240px) + main décalé (md:ml-60)
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
  '/approvisionnement': 'Approvisionnement',
  '/livraison':         'Livraison',
}

export const AppShell = ({ children, title: titleOverride }) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const title = titleOverride ?? ROUTE_TITLES[location.pathname] ?? "Panam'arket"

  return (
    <div className="min-h-[100dvh] bg-calcaire">
      {/* Desktop : sidebar fixe à gauche */}
      <Sidebar />

      {/* Mobile : top bar sticky */}
      <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />

      {/* Contenu — décalé de 240px sur desktop pour ne pas passer sous la sidebar */}
      <main
        className="md:ml-60 page-fade"
        style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-5xl mx-auto px-4 pt-4 md:pt-6">
          {children}
        </div>
      </main>

      {/* Mobile : nav fixe en bas */}
      <BottomNav />

      {/* Drawer — visible sur mobile mais marche aussi sur desktop si on l'ouvre */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
