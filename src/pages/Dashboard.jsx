import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TrendingUp, ShoppingBag, AlertTriangle, AlertCircle } from 'lucide-react'

// Génère les 7 derniers jours (aujourd'hui inclus), format YYYY-MM-DD
function derniersSeptJours() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

function lireCaisse(date) {
  try {
    const raw = localStorage.getItem(`caisse_${date}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

// YYYY-MM-DD → "jj/mm"
function formatDate(date) {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}

export default function Dashboard() {
  const { role, loading: authLoading } = useAuth()
  const navigate  = useNavigate()
  const [produits, setProduits] = useState([])
  const [loading, setLoading]   = useState(true)

  // Redirection si rôle non autorisé (employé) — seulement une fois l'auth résolue
  useEffect(() => {
    if (!authLoading && role && role !== 'manager' && role !== 'gérant') {
      navigate('/ruptures', { replace: true })
    }
  }, [role, authLoading, navigate])

  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase
        .from('produits')
        .select('id, designation, gamme, st_actuel, st_min, pr_vente')
        .order('designation')
      if (error) {
        console.error('[Dashboard] Erreur Supabase produits :', error.message)
      } else {
        setProduits(data)
        console.log(`[Dashboard] ${data.length} produits chargés depuis Supabase`)
      }
      setLoading(false)
    }
    fetchProduits()
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const todayFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const quantitesAujourdhui = useMemo(() => {
    const caisse = lireCaisse(today)
    // Log temporaire — à retirer une fois la caisse en production
    console.log(`[Dashboard] localStorage caisse_${today} :`, caisse ?? '(vide)')
    return caisse?.quantites ?? {}
  }, [today])

  // ── Métriques du jour ──────────────────────────────────────────────────────
  const caAujourdhui = useMemo(() =>
    produits.reduce((sum, p) => sum + (quantitesAujourdhui[p.id] ?? 0) * p.pr_vente, 0),
    [produits, quantitesAujourdhui]
  )

  const nbArticlesVendus = useMemo(() =>
    Object.values(quantitesAujourdhui).reduce((sum, q) => sum + q, 0),
    [quantitesAujourdhui]
  )

  const nbRuptures = useMemo(() =>
    produits.filter(p => p.st_actuel === 0).length,
    [produits]
  )

  const nbInsuffisants = useMemo(() =>
    produits.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min).length,
    [produits]
  )

  // ── Graphique CA 7 jours ──────────────────────────────────────────────────
  const donneesGraphique = useMemo(() =>
    derniersSeptJours().map(date => {
      const caisse = lireCaisse(date)
      if (!caisse || !produits.length) return { date: formatDate(date), ca: 0 }
      const ca = produits.reduce(
        (sum, p) => sum + (caisse.quantites?.[p.id] ?? 0) * p.pr_vente, 0
      )
      return { date: formatDate(date), ca: parseFloat(ca.toFixed(2)) }
    }),
    [produits]
  )

  // ── Top 5 produits du jour ─────────────────────────────────────────────────
  const top5 = useMemo(() =>
    produits
      .map(p => ({
        ...p,
        qte: quantitesAujourdhui[p.id] ?? 0,
        ca: (quantitesAujourdhui[p.id] ?? 0) * p.pr_vente,
      }))
      .filter(p => p.qte > 0)
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5),
    [produits, quantitesAujourdhui]
  )

  // ── Alertes stocks (rupture + insuffisant) ─────────────────────────────────
  const alertesStock = useMemo(() =>
    produits.filter(p => p.st_actuel < p.st_min),
    [produits]
  )

  // Pendant l'init de l'auth, montrer le loader plutôt qu'un écran blanc
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800">Dashboard</h1>
        <p className="text-xs text-gray-400 capitalize">{todayFr}</p>
      </header>

      <div className="p-4 max-w-5xl mx-auto space-y-6">

        {/* ── 4 CARDS MÉTRIQUES ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="CA du jour"
            value={`${caAujourdhui.toFixed(2)} €`}
            color="text-[#1D9E75]"
            bg="bg-green-50"
            Icon={TrendingUp}
          />
          <MetricCard
            label="Articles vendus"
            value={nbArticlesVendus}
            color="text-blue-500"
            bg="bg-blue-50"
            Icon={ShoppingBag}
          />
          <MetricCard
            label="Ruptures"
            value={nbRuptures}
            color="text-red-500"
            bg="bg-red-50"
            Icon={AlertTriangle}
          />
          <MetricCard
            label="Stocks insuffisants"
            value={nbInsuffisants}
            color="text-orange-500"
            bg="bg-orange-50"
            Icon={AlertCircle}
          />
        </div>

        {/* Bandeau info quand aucune vente du jour dans localStorage */}
        {nbArticlesVendus === 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
            <span className="text-lg">ℹ️</span>
            <span>
              Aucune vente enregistrée aujourd'hui — les données CA et top produits
              apparaîtront dès la première saisie dans la Caisse.
            </span>
          </div>
        )}

        {/* ── GRILLE 2 COL DESKTOP ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* GRAPHIQUE CA 7 JOURS */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              CA — 7 derniers jours
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={donneesGraphique} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v} €`}
                  width={60}
                />
                <Tooltip
                  formatter={v => [`${v.toFixed(2)} €`, 'CA']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Bar dataKey="ca" fill="#1D9E75" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* TOP 5 PRODUITS */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Top 5 produits du jour
            </h2>
            {top5.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucune vente enregistrée aujourd'hui.
              </p>
            ) : (
              <div className="space-y-3">
                {top5.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-500 flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {p.designation}
                      </p>
                      <p className="text-xs text-gray-400">{p.qte} unité{p.qte > 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#1D9E75] shrink-0">
                      {p.ca.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ÉTAT DES STOCKS — occupe 2 colonnes sur desktop */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">État des stocks</h2>
              <Link
                to="/ruptures"
                className="text-xs text-[#1D9E75] font-medium hover:underline"
              >
                Voir tout →
              </Link>
            </div>

            {alertesStock.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Tous les stocks sont OK.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {alertesStock.map(p => {
                  const rupture = p.st_actuel === 0
                  return (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {p.designation}
                        </p>
                        <p className="text-xs text-gray-400">{p.gamme}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-500">
                          {p.st_actuel} / {p.st_min}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          rupture
                            ? 'bg-red-100 text-red-600'
                            : 'bg-orange-100 text-orange-600'
                        }`}>
                          {rupture ? 'Rupture' : 'Insuffisant'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}

// Composant interne : card métrique réutilisable
function MetricCard({ label, value, color, bg, Icon }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  )
}
