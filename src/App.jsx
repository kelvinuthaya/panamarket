import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Ruptures from './pages/Ruptures'
import Approvisionnement from './pages/Approvisionnement'
import Caisse from './pages/Caisse'
import Dashboard from './pages/Dashboard'
import Catalogue from './pages/Catalogue'
import Login from './pages/Login'
import BottomNav from './components/BottomNav'

// Composant interne : a accès au contexte Auth (AuthProvider est parent dans App)
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth()

  // Pendant la vérification de session au démarrage, on ne rend rien (évite le flash de /login)
  if (loading) return null

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <>
      <main className="pb-16">
        <Routes>
          <Route path="/" element={<Navigate to="/ruptures" replace />} />
          <Route path="/login" element={<Navigate to="/ruptures" replace />} />
          <Route path="/ruptures" element={<Ruptures />} />
          <Route path="/approvisionnement" element={<Approvisionnement />} />
          <Route path="/caisse" element={<Caisse />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="*" element={<Navigate to="/ruptures" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
