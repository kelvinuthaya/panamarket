// Login PANAME OS — dark mode avec splashes décoratifs + form blanc qui pop
//
// LOGIQUE PRÉSERVÉE (étape 4 migration) :
// - 4 useState : identifiant, password, error, loading
// - handleSubmit async : email = `${identifiant.trim()}@panamarket.fr`,
//   supabase.auth.signInWithPassword, gestion erreur identique
// - Le suffixe @panamarket.fr est concaténé automatiquement → on garde
//   l'indice visuel (sinon l'user tape son email complet et le login casse)
// - onAuthStateChange dans AuthContext gère la redirection après succès

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
    <div className="relative min-h-[100dvh] bg-bitume flex items-center justify-center px-4 overflow-hidden">

      {/* Splashes SVG décoratifs — 3 coins, opacity faible pour rester en arrière-plan */}
      <svg
        className="absolute -top-32 -left-32 w-96 h-96 pointer-events-none"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="splash-rouge" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#FF2D2D" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FF2D2D" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#splash-rouge)" />
      </svg>

      <svg
        className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] pointer-events-none"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="splash-bleu" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#2557FF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#2557FF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#splash-bleu)" />
      </svg>

      <svg
        className="absolute top-1/3 -right-24 w-72 h-72 pointer-events-none"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="splash-or" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#F5C518" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F5C518" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#splash-or)" />
      </svg>

      {/* Bloc central */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">

        {/* Logo + lieu */}
        <div className="text-center">
          <h1 className="font-display text-6xl font-bold text-white leading-none">
            Panam
            {/* "arket" en italic + gradient bleu→violet via bg-clip-text */}
            <span className="italic bg-gradient-to-r from-paname-700 to-violet-600 bg-clip-text text-transparent">
              'arket
            </span>
          </h1>
          <p className="tag-street text-eiffel mt-3">75020 · BELLEVILLE · OS</p>
        </div>

        {/* Carte formulaire */}
        <div className="w-full bg-white rounded-3xl p-6 shadow-paname">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Identifiant — pas de label, juste placeholder + suffixe @panamarket.fr en hint mono
                (suffixe nécessaire pour que l'user comprenne ce qu'il doit taper) */}
            <div>
              <input
                type="text"
                value={identifiant}
                onChange={e => setIdentifiant(e.target.value)}
                placeholder="employe, manager, gérant…"
                className="w-full h-14 bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none text-lg text-bitume placeholder:text-zinc-400 transition-colors"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
              />
              <p className="font-mono text-[10px] text-zinc-400 mt-1">@panamarket.fr ajouté auto</p>
            </div>

            <div>
              <input
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
              <p className="text-sm text-pavillon bg-pavillon/10 px-3 py-2 rounded-lg">
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
        <p className="font-mono text-[10px] text-white/30 text-center">
          v1.4.0 · NF 525 ready · Made in 75020
        </p>
      </div>
    </div>
  )
}
