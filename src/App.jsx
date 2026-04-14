import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Ruptures from './pages/Ruptures'
import Approvisionnement from './pages/Approvisionnement'
import Caisse from './pages/Caisse'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/ruptures">Ruptures</Link> |{' '}
        <Link to="/approvisionnement">Approvisionnement</Link> |{' '}
        <Link to="/caisse">Caisse</Link> |{' '}
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <Routes>
        <Route path="/ruptures" element={<Ruptures />} />
        <Route path="/approvisionnement" element={<Approvisionnement />} />
        <Route path="/caisse" element={<Caisse />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App