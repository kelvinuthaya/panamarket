import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TrendingUp, ShoppingBag, AlertTriangle, AlertCircle, Package } from 'lucide-react'

export default function Dashboard() {
  const { role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [produits, setProduits]               = useState([])
  const [transactions, setTransactions]       = useState([])
  const [loading, setLoading]                 = useState(true)
  const [migrationFaite, setMigrationFaite]   = useState(false)
  const [moisSelectionne, setMoisSelectionne] = useState(
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  )

  // Redirection si rôle non autorisé (employé) — seulement une fois l'auth résolue
  useEffect(() => {
    if (!authLoading && role && role !== 'manager' && role !== 'gerant') {
      navigate('/catalogue', { replace: true })
    }
  }, [role, authLoading, navigate])

  // Fetch transactions du mois + produits en parallèle, relancé à chaque changement de mois
  useEffect(() => {
    async function fetchData() {
      const debutMois = new Date(moisSelectionne + '-01')
      debutMois.setHours(0, 0, 0, 0)
      const [annee, mois] = moisSelectionne.split('-').map(Number)
      // new Date(y, m, 0) = dernier jour du mois m (m en base 1) car jour 0 = veille du 1er
      const finMois = new Date(annee, mois, 0)
      finMois.setHours(23, 59, 59, 999)

      const [txnResult, produitsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('total, created_at, produits')
          .gte('created_at', debutMois.toISOString())
          .lte('created_at', finMois.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('produits')
          .select('id, designation, gamme, st_actuel, st_min, pr_vente')
          .order('designation'),
      ])

      if (!txnResult.error)     setTransactions(txnResult.data ?? [])
      if (!produitsResult.error) setProduits(produitsResult.data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [moisSelectionne])

  useEffect(() => {
    if (localStorage.getItem('migration_v1_done')) setMigrationFaite(true)
  }, [])

  async function migrerLocalStorage() {
    const cles = Object.keys(localStorage).filter(k => /^caisse_\d{4}-\d{2}-\d{2}$/.test(k))
    if (cles.length === 0) { setMigrationFaite(true); return }

    const inserts = []
    for (const cle of cles) {
      const dateStr = cle.replace('caisse_', '')
      try {
        const parsed = JSON.parse(localStorage.getItem(cle))
        const txns = parsed.transactions ?? []
        for (const t of txns) {
          const [h, m] = (t.heure ?? '12:00').split(':')
          const createdAt = new Date(`${dateStr}T${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`)
          inserts.push({
            created_at: createdAt.toISOString(),
            produits:   t.produits,
            total:      parseFloat(t.total),
            paiement:   t.paiement === 'cb' || t.paiement === 'especes' ? t.paiement : 'cb',
          })
        }
      } catch {}
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('transactions').insert(inserts)
      if (error) { console.error('Migration erreur:', error); return }
    }

    localStorage.setItem('migration_v1_done', 'true')
    setMigrationFaite(true)
    alert(`Migration réussie — ${inserts.length} transaction(s) transférée(s) vers Supabase.`)
  }

  const todayFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Métriques du mois sélectionné ─────────────────────────────────────────
  const caMois = useMemo(() =>
    transactions.reduce((sum, t) => sum + t.total, 0),
    [transactions]
  )

  const articlesMois = useMemo(() =>
    transactions.reduce((sum, t) =>
      sum + t.produits.reduce((s, p) => s + p.quantite, 0), 0
    ),
    [transactions]
  )

  const nbRuptures = useMemo(() =>
    produits.filter(p => p.st_actuel === 0).length,
    [produits]
  )

  const nbInsuffisants = useMemo(() =>
    produits.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min).length,
    [produits]
  )

  // ── Graphique CA jour par jour du mois sélectionné ────────────────────────
  const donneesGraphique = useMemo(() => {
    const parJour = {}
    transactions.forEach(t => {
      const d = new Date(t.created_at)
      const jour = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      parJour[jour] = (parJour[jour] ?? 0) + t.total
    })
    return Object.entries(parJour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([jour, ca]) => ({ jour, ca: parseFloat(ca.toFixed(2)) }))
  }, [transactions])

  // ── Top 5 produits du mois ─────────────────────────────────────────────────
  const top5 = useMemo(() => {
    const totals = {}
    transactions.forEach(t => {
      t.produits.forEach(p => {
        if (!totals[p.designation]) {
          totals[p.designation] = { designation: p.designation, qte: 0, ca: 0 }
        }
        totals[p.designation].qte += p.quantite
        totals[p.designation].ca  += p.quantite * p.prixUnitaire
      })
    })
    return Object.values(totals)
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5)
      .map(p => ({ ...p, ca: parseFloat(p.ca.toFixed(2)) }))
  }, [transactions])

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

        {/* ── MIGRATION ONE-TIME ────────────────────────────────────────────── */}
        {!migrationFaite && role === 'gerant' && (
          <button
            onClick={migrerLocalStorage}
            className="w-full bg-orange-500 text-white py-3 rounded-xl text-sm font-semibold"
          >
            ⚠️ Migrer les données existantes vers Supabase (une seule fois)
          </button>
        )}

        {/* ── 4 CARDS MÉTRIQUES ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="CA du mois"
            value={`${caMois.toFixed(2)} €`}
            color="text-[#1D9E75]"
            bg="bg-green-50"
            Icon={TrendingUp}
          />
          <MetricCard
            label="Articles vendus"
            value={articlesMois}
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

        {/* Accès rapide catalogue */}
        <Link
          to="/catalogue"
          className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:border-[#1D9E75]/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center">
              <Package size={18} className="text-[#1D9E75]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Gérer le catalogue</p>
              <p className="text-xs text-gray-400">Ajouter, modifier ou supprimer des produits</p>
            </div>
          </div>
          <span className="text-gray-300 text-lg leading-none">›</span>
        </Link>

        {/* Bandeau info quand aucune vente ce mois */}
        {articlesMois === 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-sm text-blue-700">
            <span className="text-lg">ℹ️</span>
            <span>
              Aucune vente enregistrée ce mois — les données CA et top produits
              apparaîtront dès la première saisie dans la Caisse.
            </span>
          </div>
        )}

        {/* ── GRILLE 2 COL DESKTOP ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* GRAPHIQUE CA PAR JOUR DU MOIS */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">CA — jour par jour</h2>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-2">
              <button
                onClick={() => {
                  const [y, m] = moisSelectionne.split('-').map(Number)
                  const d = new Date(y, m - 2, 1)
                  setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100"
              >
                ‹
              </button>
              <span className="text-sm font-semibold text-gray-800 capitalize">
                {new Date(moisSelectionne + '-15').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => {
                  const [y, m] = moisSelectionne.split('-').map(Number)
                  const d = new Date(y, m, 1)
                  setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
                }}
                disabled={moisSelectionne >= new Date().toLocaleDateString('en-CA').slice(0, 7)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 active:bg-gray-100 disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              CA du mois : <span className="font-bold text-[#1D9E75]">{caMois.toFixed(2)} €</span>
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={donneesGraphique} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey="jour"
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

          {/* TOP 5 PRODUITS DU MOIS */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">
              Top 5 produits du mois
            </h2>
            {top5.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucune vente enregistrée ce mois.
              </p>
            ) : (
              <div className="space-y-3">
                {top5.map((p, i) => (
                  <div key={p.designation} className="flex items-center gap-3">
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
                to="/catalogue"
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
