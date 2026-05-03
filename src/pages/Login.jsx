import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [identifiant, setIdentifiant] = useState('')
  const [password, setPassword]       = useState('')
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const email = `${identifiant.trim()}@panamarket.fr`
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) setError('Identifiant ou mot de passe incorrect.')
    setLoading(false)
    // Si succès, onAuthStateChange dans AuthContext met à jour user → App redirige automatiquement
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800">Panam'arket</h1>
          <p className="text-sm text-gray-500 mt-1">Connectez-vous pour continuer</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant
            </label>
            {/* Le domaine @panamarket.fr est ajouté automatiquement — l'utilisateur tape juste son prénom/rôle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:border-[#1D9E75] focus-within:ring-1 focus-within:ring-[#1D9E75]">
              <input
                type="text"
                value={identifiant}
                onChange={e => setIdentifiant(e.target.value)}
                placeholder="employe, manager, gérant…"
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                required
                autoComplete="username"
                autoCapitalize="none"
              />
              <span className="px-3 py-2.5 text-xs text-gray-400 bg-gray-50 flex items-center border-l border-gray-200 whitespace-nowrap">
                @panamarket.fr
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[#1D9E75] text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 transition-opacity"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

        </form>
      </div>
    </div>
  )
}
