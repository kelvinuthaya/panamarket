// Login — ambiance claire calcaire (DESIGN.md), plus de dark ni de splashes décoratifs
//
// LOGIQUE PRÉSERVÉE (migration ambiance claire) :
// - 4 useState : identifiant, password, error, loading
// - handleSubmit async : email = `${identifiant.trim()}@panamarket.fr`,
//   supabase.auth.signInWithPassword, gestion erreur identique
// - Le suffixe @panamarket.fr est concaténé automatiquement → on garde
//   l'indice visuel (sinon l'user tape son email complet et le login casse)
// - onAuthStateChange dans AuthContext gère la redirection après succès

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import logoPanamarket from '../assets/logo-panamarket.png'

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
    <div className="relative min-h-[100dvh] bg-calcaire flex items-center justify-center px-4">

      {/* Bloc central */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo + lieu — vrai logo du commerce (remplace le wordmark texte) */}
        <div className="text-center">
          <img
            src={logoPanamarket}
            alt="Panam'arket"
            className="w-full max-w-[280px] mx-auto"
          />
        </div>

        {/* Carte formulaire */}
        <div className="w-full bg-white rounded-3xl border border-bitume/5 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Identifiant — pas de label, juste placeholder + suffixe @panamarket.fr en hint mono
                (suffixe nécessaire pour que l'user comprenne ce qu'il doit taper) */}
            <div>
              <label htmlFor="login-identifiant" className="sr-only">Identifiant</label>
              <input
                id="login-identifiant"
                type="text"
                value={identifiant}
                onChange={e => setIdentifiant(e.target.value)}
                placeholder="employe, manager, gérant…"
                className="w-full h-14 bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none text-lg text-bitume placeholder:text-zinc-400 transition-colors"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                aria-describedby="login-identifiant-hint"
              />
              <p id="login-identifiant-hint" className="font-mono text-[10px] text-zinc-400 mt-1">@panamarket.fr ajouté auto</p>
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">Mot de passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full h-14 bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none text-lg text-bitume placeholder:text-zinc-400 transition-colors"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-pavillon bg-pavillon/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-16 rounded-2xl bg-gradient-to-r from-paname-700 to-paname-500 text-white font-bold tag-street text-base shadow-paname disabled:opacity-60 active:brightness-95 transition"
            >
              {loading ? 'Connexion…' : 'Entrer'}
            </button>
          </form>
        </div>

        {/* Footer signature */}
        <p className="font-mono text-[10px] text-zinc-400 text-center">
          v1.4.0 · NF 525 ready
        </p>
      </div>
    </div>
  )
}
