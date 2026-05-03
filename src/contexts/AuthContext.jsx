import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  // loading = true pendant que Supabase vérifie la session stockée (cookie/localStorage)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthStateChange fire immédiatement avec l'événement INITIAL_SESSION
    // (pattern recommandé Supabase v2 — évite la promesse getSession qui peut bloquer silencieusement)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth]', event, session?.user?.email ?? 'aucun utilisateur')
      setUser(session?.user ?? null)
      // loading passe à false dès qu'on connaît l'état initial (INITIAL_SESSION)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.user_metadata?.role ?? null,
      isAuthenticated: !!user,
      loading,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook à utiliser dans les composants : const { user, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext)
}
