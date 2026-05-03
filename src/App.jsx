import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Ruptures from './pages/Ruptures'
import Approvisionnement from './pages/Approvisionnement'
import Caisse from './pages/Caisse'
import Dashboard from './pages/Dashboard'
import BottomNav from './components/BottomNav'

function App() {
  return (
    <BrowserRouter>
      {/* pb-16 = padding-bottom pour que le contenu ne soit pas masqué par la BottomNav fixe */}
      <main className="pb-16">
        <Routes>
          <Route path="/" element={<Navigate to="/ruptures" replace />} />
          <Route path="/ruptures" element={<Ruptures />} />
          <Route path="/approvisionnement" element={<Approvisionnement />} />
          <Route path="/caisse" element={<Caisse />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      <BottomNav />
    </BrowserRouter>
  )
}

export default App