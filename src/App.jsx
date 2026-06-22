import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import Achats from './pages/Achats'
import Caisse from './pages/Caisse'
import Dashboard from './pages/Dashboard'
import Catalogue from './pages/Catalogue'
import Login from './pages/Login'
import { AppShell } from './components/layout/AppShell'

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
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/achats" element={<Achats />} />
        <Route path="/approvisionnement" element={<Navigate to="/achats" replace />} />
        <Route path="/livraison" element={<Navigate to="/achats" replace />} />
        <Route path="/caisse" element={<Caisse />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
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
