import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { parsePdfCA } from '../lib/parsePdfCA'
import { parseCsvCA } from '../lib/parseCsvCA'
import { bornesMois } from '../lib/journee'
import {
  TrendingUp, ShoppingBag, AlertTriangle, AlertCircle,
  Package, FileText, FileSpreadsheet, Receipt, ShoppingCart,
} from 'lucide-react'

// Correspondances mois FR → numéro (1–12)
const MOIS_NUM = {
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5,
  juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10,
  novembre: 11, décembre: 12, decembre: 12,
}

// "Mars 2026" → { moisNum: 3 (1-based), annee: 2026 }
function parserLabelMois(labelMois) {
  const parts = labelMois.trim().toLowerCase().split(/\s+/)
  return { moisNum: MOIS_NUM[parts[0]], annee: parseInt(parts[1]) }
}

// ca_importe a une ligne par (source, jour) : importer le PDF puis le CSV du
// même mois doublerait le CA si on sommait tout. Le PDF fait foi quand les
// deux existent (il porte aussi nb factures / panier moyen).
function dedupeCaImporteParJour(rows) {
  const parJour = new Map()
  for (const r of rows) {
    const existant = parJour.get(r.jour)
    if (!existant || r.source === 'pdf') parJour.set(r.jour, r)
  }
  return [...parJour.values()]
}

export default function Dashboard() {
  const { role, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [produits, setProduits]               = useState([])
  const [transactions, setTransactions]       = useState([])
  const [caImporte, setCaImporte]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [migrationFaite, setMigrationFaite]   = useState(false)
  const [moisSelectionne, setMoisSelectionne] = useState(
    new Date().toLocaleDateString('en-CA').slice(0, 7)
  )
  const [refreshKey, setRefreshKey] = useState(0)
  // Métriques mensuelles d'un import PDF (table import_mois) — persistées en
  // base pour survivre à un refresh, contrairement à un simple état React.
  const [importMois, setImportMois] = useState(null)
  const [labelPdf, setLabelPdf]     = useState('')
  const [labelCsv, setLabelCsv]     = useState('')
  const [errImport, setErrImport]   = useState('')

  const pdfRef = useRef(null)
  const csvRef = useRef(null)

  useEffect(() => {
    if (!authLoading && role && role !== 'gerant') {
      navigate('/catalogue', { replace: true })
    }
  }, [role, authLoading, navigate])

  useEffect(() => {
    async function fetchData() {
      // Bornes du mois calées sur la journée commerciale (bascule 4h Paris),
      // comme Caisse et Historique — sinon le CA mensuel diverge pour les
      // ventes entre minuit et 4h en bord de mois. dateRef au 15 à midi :
      // n'importe quel instant du mois convient pour obtenir ses bornes.
      const [annee, mois] = moisSelectionne.split('-').map(Number)
      const { debut: debutMois, fin: finMois } = bornesMois(new Date(moisSelectionne + '-15T12:00:00'))

      // new Date(y, m-1, 1).toISOString() passe par UTC : à Paris (UTC+1/+2),
      // minuit local devient la veille en UTC et décale toute la fenêtre d'un
      // jour (perd le dernier jour du mois). On reste en chaînes, sans Date/UTC.
      const nbJoursMois = new Date(annee, mois, 0).getDate()
      const premierJour = `${moisSelectionne}-01`
      const dernierJour = `${moisSelectionne}-${String(nbJoursMois).padStart(2, '0')}`

      const [txnResult, produitsResult, caImporteResult, importMoisResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('total, created_at, produits')
          .gte('created_at', debutMois.toISOString())
          .lt('created_at', finMois.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('produits')
          .select('id, designation, gamme, st_actuel, st_min, pr_vente')
          .order('designation'),
        supabase
          .from('ca_importe')
          .select('*')
          .gte('jour', premierJour)
          .lte('jour', dernierJour)
          .order('jour', { ascending: true }),
        supabase
          .from('import_mois')
          .select('*')
          .eq('mois', premierJour),
      ])

      if (!txnResult.error)       setTransactions(txnResult.data ?? [])
      if (!produitsResult.error)  setProduits(produitsResult.data ?? [])
      if (!caImporteResult.error) setCaImporte(caImporteResult.data ?? [])
      if (!importMoisResult.error) {
        const rows = importMoisResult.data ?? []
        setImportMois(rows.find(r => r.source === 'pdf') ?? rows[0] ?? null)
      }
      setLoading(false)
    }
    fetchData()
  }, [moisSelectionne, refreshKey])

  useEffect(() => {
    if (localStorage.getItem('migration_v1_done')) setMigrationFaite(true)
  }, [])

  // Enregistre les CA journaliers dans Supabase (table ca_importe)
  async function saveImportToSupabase(caParJour, source, labelMois, meta) {
    const { moisNum, annee } = parserLabelMois(labelMois)
    if (!moisNum || isNaN(annee)) return { success: false, error: new Error('labelMois invalide') }

    const rows = Object.entries(caParJour).map(([cle, ca]) => {
      const [dd, mm] = cle.split('/')
      const jour = `${annee}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      return {
        source,
        label_mois: labelMois,
        jour,
        ca,
        nb_transactions: meta.nbTransactions ?? null,
        panier_moyen:    meta.panierMoyen    ?? null,
        imported_by:     user?.id            ?? null,
      }
    })

    // rows.length === 0 signifiait "aucune ligne à importer" mais renvoyait
    // success: true : l'utilisateur cliquait, rien ne se passait, aucun message.
    if (rows.length === 0) return { success: false, error: new Error('Aucune ligne à importer') }

    const { error } = await supabase
      .from('ca_importe')
      .upsert(rows, { onConflict: 'source,jour' })

    return { success: !error, error: error ?? null }
  }

  // Enregistre les métriques du mois (table import_mois) — le mois est le bon
  // grain, contrairement à ca_importe où nb_transactions/panier_moyen étaient
  // recopiés à l'identique sur chaque ligne jour.
  async function saveImportMoisToSupabase(source, labelMois, meta) {
    const { moisNum, annee } = parserLabelMois(labelMois)
    if (!moisNum || isNaN(annee)) return { success: false, error: new Error('labelMois invalide') }
    const mois = `${annee}-${String(moisNum).padStart(2, '0')}-01`

    const { error } = await supabase
      .from('import_mois')
      .upsert({
        source,
        label_mois: labelMois,
        mois,
        nb_transactions: meta.nbTransactions ?? null,
        panier_moyen:    meta.panierMoyen    ?? null,
        nb_articles:     meta.nbArticles     ?? null,
        top5:            meta.top5           ?? null,
        ca_par_tva:      meta.caParTva       ?? null,
        imported_by:     user?.id            ?? null,
      }, { onConflict: 'source,mois' })

    return { success: !error, error: error ?? null }
  }

  async function handleImportPdf(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrImport('')
    try {
      const data = await parsePdfCA(file)
      setLabelPdf(data.labelMois)

      const meta = { nbTransactions: data.nbTransactions, panierMoyen: data.panierMoyen }
      const [{ error: errCa }, { error: errMois }] = await Promise.all([
        saveImportToSupabase(data.caParJour, 'pdf', data.labelMois, meta),
        saveImportMoisToSupabase('pdf', data.labelMois,
          { ...meta, nbArticles: data.nbArticles, top5: data.top5, caParTva: data.caParTva }),
      ])
      if (errCa || errMois) {
        console.error('Erreur sauvegarde Supabase:', errCa ?? errMois)
        toast.error('Échec de la sauvegarde de l\'import')
      } else {
        const { moisNum, annee } = parserLabelMois(data.labelMois)
        if (moisNum && !isNaN(annee)) {
          const d = new Date(annee, moisNum - 1, 1)
          setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
        }
        setRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('[Import PDF]', err)
      setErrImport(`Erreur PDF : ${err.message}`)
    }
    e.target.value = ''
  }

  async function handleImportCsv(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrImport('')
    try {
      const data = await parseCsvCA(file)
      setLabelCsv(data.labelMois)

      // labelMois vient du fichier, pas de moisSelectionne : importer un CSV
      // d'une autre année/mois que celui affiché ne doit pas ranger ses
      // données sur le mauvais mois.
      const [{ error: errCa }, { error: errMois }] = await Promise.all([
        saveImportToSupabase(data.caParJour, 'csv', data.labelMois, {}),
        saveImportMoisToSupabase('csv', data.labelMois, { caParTva: data.caParTva }),
      ])
      if (errCa || errMois) {
        console.error('Erreur sauvegarde Supabase:', errCa ?? errMois)
        toast.error('Échec de la sauvegarde de l\'import')
      } else {
        const d = new Date(data.annee, data.mois - 1, 1)
        setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
        setRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('[Import CSV]', err)
      setErrImport(`Erreur CSV : ${err.message}`)
    }
    e.target.value = ''
  }

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
            // Obligatoire depuis la policy RLS transactions_insert (auth.uid() = user_id)
            user_id:    user?.id,
          })
        }
      } catch {}
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('transactions').insert(inserts)
      if (error) {
        console.error('Migration erreur:', error)
        toast.error('Échec de la migration des transactions')
        return
      }
    }

    localStorage.setItem('migration_v1_done', 'true')
    setMigrationFaite(true)
    toast.success(`Migration réussie — ${inserts.length} transaction(s) transférée(s)`)
  }

  const labelMoisAffiche = new Date(moisSelectionne + '-15')
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  // ca_importe peut contenir PDF + CSV du même mois (une ligne par source) :
  // dédupliquer par jour avant de sommer, sinon le CA double.
  const caImporteDedup = useMemo(() => dedupeCaImporteParJour(caImporte), [caImporte])

  const caMois = useMemo(() => {
    if (caImporteDedup.length > 0) return caImporteDedup.reduce((s, r) => s + r.ca, 0)
    return transactions.reduce((sum, t) => sum + t.total, 0)
  }, [transactions, caImporteDedup])

  const articlesMois = useMemo(() => {
    if (importMois?.nb_articles != null) return importMois.nb_articles
    return transactions.reduce((sum, t) =>
      sum + t.produits.reduce((s, p) => s + p.quantite, 0), 0
    )
  }, [transactions, importMois])

  const nbTransactionsMois = useMemo(() => {
    if (importMois?.nb_transactions != null) return importMois.nb_transactions
    return transactions.length
  }, [transactions, importMois])

  const panierMoyenMois = useMemo(() => {
    if (importMois?.panier_moyen != null) return importMois.panier_moyen
    return nbTransactionsMois > 0 ? caMois / nbTransactionsMois : 0
  }, [caMois, nbTransactionsMois, importMois])

  const nbRuptures = useMemo(() =>
    produits.filter(p => p.st_actuel === 0).length,
    [produits]
  )

  const nbInsuffisants = useMemo(() =>
    produits.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min).length,
    [produits]
  )

  const donneesGraphique = useMemo(() => {
    const [annee, mois] = moisSelectionne.split('-').map(Number)
    const nbJours = new Date(annee, mois, 0).getDate()

    const caAppParJour = {}
    transactions.forEach(t => {
      const d = new Date(t.created_at)
      const jour = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      caAppParJour[jour] = (caAppParJour[jour] ?? 0) + t.total
    })

    const caImpParJour = {}
    caImporteDedup.forEach(row => {
      const [, mm, dd] = row.jour.split('-')
      const jour = `${dd}/${mm}`
      caImpParJour[jour] = (caImpParJour[jour] ?? 0) + row.ca
    })

    const points = []
    for (let j = 1; j <= nbJours; j++) {
      const dd = String(j).padStart(2, '0')
      const mm = String(mois).padStart(2, '0')
      const jour = `${dd}/${mm}`
      const caApp = parseFloat((caAppParJour[jour] ?? 0).toFixed(2))
      const caImp = parseFloat((caImpParJour[jour] ?? 0).toFixed(2))
      if (caApp > 0 || caImp > 0) points.push({ jour, caApp, caImporte: caImp })
    }
    return points
  }, [transactions, caImporteDedup, moisSelectionne])

  const top5 = useMemo(() => {
    if (importMois?.top5?.length > 0) return importMois.top5
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
  }, [transactions, importMois])

  const alertesStock = useMemo(() =>
    produits.filter(p => p.st_actuel < p.st_min),
    [produits]
  )

  // Répartition TVA du mois affiché (import_mois.ca_par_tva), pas de l'état
  // de session : sinon elle reste figée sur le dernier fichier importé, sur
  // n'importe quel mois. La priorité pdf > csv vient de la sélection de
  // importMois plus haut (fetchData).
  const tvaEntries = useMemo(() => {
    const tva = importMois?.ca_par_tva
    if (!tva || Object.keys(tva).length === 0) return []
    return Object.entries(tva)
      .map(([taux, ca]) => ({ taux, ca }))
      .sort((a, b) => parseFloat(a.taux) - parseFloat(b.taux))
  }, [importMois])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="tag-street text-eiffel">CHARGEMENT…</p>
      </div>
    )
  }

  const peutImporter = role === 'gerant'

  // Labels des mois prev/next pour le sélecteur
  const [yr, mo] = moisSelectionne.split('-').map(Number)
  const prevMoisLabel = new Date(yr, mo - 2, 1)
    .toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase()
  const nextMoisLabel = new Date(yr, mo, 1)
    .toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase()
  const isCurrentMonth = moisSelectionne >= new Date().toLocaleDateString('en-CA').slice(0, 7)

  return (
    <div className="pb-20">
      <div className="px-4 pt-4 max-w-5xl lg:max-w-6xl mx-auto space-y-5">

        {/* PAGE HEADER */}
        <div>
          <p className="tag-street text-zinc-400">PANAM'ARKET</p>
          <p className="font-display text-3xl font-bold text-bitume">Dashboard</p>
        </div>

        {/* MIGRATION BANNER */}
        {!migrationFaite && role === 'gerant' && (
          <button
            onClick={migrerLocalStorage}
            className="w-full bg-pavillon text-white h-14 rounded-xl tag-street shadow-rouge active:brightness-90 transition"
          >
            ⚠ MIGRER LES DONNÉES VERS SUPABASE (UNE SEULE FOIS)
          </button>
        )}

        {/* SÉLECTEUR DE MOIS */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const d = new Date(yr, mo - 2, 1)
              setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
            }}
            className="flex-1 h-12 bg-white border border-bitume/10 rounded-xl tag-street text-zinc-600 text-center transition active:border-paname-700/30"
          >
            ◀ {prevMoisLabel}
          </button>
          <div className="flex-[2] h-12 flex items-center justify-center bg-gradient-to-r from-paname-700 to-paname-500 text-white rounded-xl tag-street text-center shadow-paname">
            {labelMoisAffiche.toUpperCase()}
          </div>
          <button
            onClick={() => {
              const d = new Date(yr, mo, 1)
              setMoisSelectionne(d.toLocaleDateString('en-CA').slice(0, 7))
            }}
            disabled={isCurrentMonth}
            className="flex-1 h-12 bg-white border border-bitume/10 rounded-xl tag-street text-zinc-600 text-center transition active:border-paname-700/30 disabled:opacity-30"
          >
            {nextMoisLabel} ▶
          </button>
        </div>

        {/* HERO POSTER — CA du mois */}
        <div className="bg-paname-700 rounded-3xl p-6 text-white relative overflow-hidden">
          {/* Déco : énorme € en arrière-plan */}
          <div
            className="absolute -right-6 -top-10 font-display font-bold text-white/10 leading-none select-none pointer-events-none"
            style={{ fontSize: '180px' }}
            aria-hidden="true"
          >€</div>
          {/* Splash doré en bas-gauche */}
          <svg
            className="absolute bottom-0 left-0 w-32 h-32 opacity-40 pointer-events-none"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="heroSplash">
                <stop offset="0%" stopColor="#F5C518" stopOpacity="1" />
                <stop offset="100%" stopColor="#F5C518" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="0" cy="100" r="80" fill="url(#heroSplash)" />
          </svg>

          <div className="relative z-10">
            <p className="tag-street text-white/60 mb-2">CA · {labelMoisAffiche.toUpperCase()}</p>

            <div className="flex items-end gap-1 mb-3">
              <span
                className="font-display font-bold tabular leading-none"
                style={{ fontSize: '56px' }}
              >
                {Math.floor(caMois).toLocaleString('fr-FR')}
              </span>
              <span className="font-display text-3xl font-bold text-eiffel mb-1">
                ,{String(Math.round((caMois % 1) * 100)).padStart(2, '0')} €
              </span>
            </div>

            {caImporteDedup.length > 0 ? (
              <p className="tag-street text-blue-200">SOURCE IMPORTÉE · {caImporteDedup.length} JOURS</p>
            ) : transactions.length > 0 ? (
              <p className="tag-street text-blue-200">
                {transactions.length} TRANSACTION{transactions.length > 1 ? 'S' : ''} APP
              </p>
            ) : (
              <p className="tag-street text-white/40">AUCUNE DONNÉE CE MOIS</p>
            )}

            {/* Répartition TVA si dispo depuis CSV */}
            {tvaEntries.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4 space-y-1.5">
                <p className="tag-street text-white/40 mb-2">RÉPARTITION TVA</p>
                {tvaEntries.map(({ taux, ca }, i) => {
                  const dotColors = ['bg-eiffel', 'bg-paname-100', 'bg-blue-300']
                  return (
                    <div key={taux} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[i] ?? 'bg-white/40'}`} />
                      <span className="font-mono text-[10px] text-white/60 flex-1">TVA {taux} %</span>
                      <span className="font-mono tabular text-[10px] font-bold text-white">
                        {parseFloat(ca).toFixed(2)} €
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Transactions/panier : import_mois si dispo, sinon calcul depuis la caisse interne */}
            {nbTransactionsMois > 0 && (
              <div className="mt-4 flex gap-6 border-t border-white/10 pt-4">
                <div>
                  <p className="tag-street text-white/40">
                    TRANSACTIONS {importMois?.nb_transactions != null ? '(IMPORT)' : '(CAISSE)'}
                  </p>
                  <p className="font-display font-bold tabular text-white">{nbTransactionsMois}</p>
                </div>
                {panierMoyenMois > 0 && (
                  <div>
                    <p className="tag-street text-white/40">PANIER MOYEN</p>
                    <p className="font-display font-bold tabular text-eiffel">
                      {panierMoyenMois.toFixed(2)} €
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3 STAT CARDS */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-bitume/5 p-4">
            <p className="tag-street text-zinc-400 mb-2">ARTICLES</p>
            <p className="font-display text-3xl font-bold tabular text-bitume">{articlesMois}</p>
            <p className="font-mono text-[10px] text-zinc-400 mt-1">
              vendus {importMois?.nb_articles != null ? '(import)' : '(caisse)'}
            </p>
          </div>

          <div className="bg-pavillon rounded-2xl p-4 text-white relative overflow-hidden">
            <div
              className="absolute -right-1 -bottom-4 font-display font-bold text-white/10 leading-none select-none pointer-events-none"
              style={{ fontSize: '72px' }}
              aria-hidden="true"
            >{nbRuptures}</div>
            <p className="tag-street text-white/70 mb-2">RUPTURES</p>
            <p className="relative font-display text-3xl font-bold tabular">{nbRuptures}</p>
          </div>

          <div className="bg-eiffel rounded-2xl p-4 text-yellow-950 relative overflow-hidden">
            <div
              className="absolute -right-1 -bottom-4 font-display font-bold text-yellow-950/10 leading-none select-none pointer-events-none"
              style={{ fontSize: '72px' }}
              aria-hidden="true"
            >{nbInsuffisants}</div>
            <p className="tag-street text-yellow-950/70 mb-2">FAIBLES</p>
            <p className="relative font-display text-3xl font-bold tabular">{nbInsuffisants}</p>
          </div>
        </div>

        {/* IMPORT DONNÉES CAISSE */}
        {peutImporter && (
          <div className="bg-white rounded-2xl border border-bitume/5 p-4">
            <p className="tag-street text-zinc-400 mb-3">IMPORT DONNÉES CAISSE</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="file"
                  accept=".pdf"
                  ref={pdfRef}
                  className="hidden"
                  onChange={handleImportPdf}
                />
                <button
                  onClick={() => pdfRef.current.click()}
                  className="w-full min-h-[64px] flex flex-col items-center justify-center gap-2 bg-paname-700/5 text-paname-700 border border-paname-700/20 rounded-xl px-3 py-4 tag-street transition active:bg-paname-700/10"
                >
                  <FileText size={20} />
                  PDF TRANSACTIONS
                </button>
                {labelPdf && (
                  <p className="font-mono text-[10px] text-paname-700 mt-1.5 text-center">
                    ✓ {labelPdf}
                  </p>
                )}
              </div>

              <div>
                <input
                  type="file"
                  accept=".csv"
                  ref={csvRef}
                  className="hidden"
                  onChange={handleImportCsv}
                />
                <button
                  onClick={() => csvRef.current.click()}
                  className="w-full min-h-[64px] flex flex-col items-center justify-center gap-2 bg-paname-500/5 text-paname-500 border border-paname-500/20 rounded-xl px-3 py-4 tag-street transition active:bg-paname-500/10"
                >
                  <FileSpreadsheet size={20} />
                  CSV CA
                </button>
                {labelCsv && (
                  <p className="font-mono text-[10px] text-paname-500 mt-1.5 text-center">
                    ✓ {labelCsv}
                  </p>
                )}
              </div>
            </div>

            {errImport && (
              <p className="mt-3 font-mono text-[10px] text-pavillon bg-pavillon/5 rounded-xl px-3 py-2">
                {errImport}
              </p>
            )}
          </div>
        )}

        {/* STATE VIDE */}
        {caImporteDedup.length === 0 && articlesMois === 0 && (
          <div className="flex items-center gap-3 bg-paname-700/5 border border-paname-700/10 rounded-2xl px-4 py-3">
            <span className="text-lg shrink-0">ℹ️</span>
            <p className="font-mono text-[10px] text-paname-700">
              Aucune vente enregistrée ce mois — les données CA et top produits
              apparaîtront dès la première saisie dans la Caisse.
            </p>
          </div>
        )}

        {/* ACCÈS RAPIDE CATALOGUE */}
        <Link
          to="/catalogue"
          className="flex items-center justify-between bg-white rounded-2xl border border-bitume/5 px-4 min-h-[56px] py-3 active:border-paname-700/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-paname-700/10 flex items-center justify-center">
              <Package size={18} className="text-paname-700" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-bitume">Gérer le catalogue</p>
              <p className="font-mono text-[10px] text-zinc-400">
                Ajouter, modifier ou supprimer des produits
              </p>
            </div>
          </div>
          <span className="text-zinc-300 text-xl leading-none">›</span>
        </Link>

        {/* GRAPHIQUE + TOP 5 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* GRAPHIQUE CA JOUR PAR JOUR */}
          <div className="bg-white rounded-2xl border border-bitume/5 p-4">
            <p className="tag-street text-zinc-400 mb-4">CA JOUR PAR JOUR</p>
            {donneesGraphique.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">📊</p>
                <p className="tag-street text-zinc-400 mb-1">AUCUNE DONNÉE</p>
                <p className="font-mono text-[10px] text-zinc-400">
                  Importez un PDF ou enregistrez des ventes
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={donneesGraphique} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="jour"
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => `${v} €`}
                    width={55}
                  />
                  <Tooltip
                    formatter={(v, key) => [
                      `${parseFloat(v).toFixed(2)} €`,
                      key === 'caApp' ? 'Ventes app' : 'Historique caisse',
                    ]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
                    cursor={{ fill: '#F5F4EE' }}
                  />
                  <Legend
                    formatter={key => key === 'caApp' ? 'Ventes app' : 'Historique caisse'}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  {/* Couleurs PANAME OS : paname-700 pour app, pavillon pour historique */}
                  <Bar dataKey="caApp"     name="Ventes app"        fill="#0040DD" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="caImporte" name="Historique caisse" fill="#FF2D2D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* TOP 5 PRODUITS */}
          <div className="bg-white rounded-2xl border border-bitume/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="tag-street text-zinc-400">TOP 5 PRODUITS</p>
              {importMois?.top5?.length > 0 && (
                <p className="font-mono text-[10px] text-paname-700">{importMois.label_mois}</p>
              )}
            </div>
            {top5.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-3xl mb-2">🏆</p>
                <p className="tag-street text-zinc-400 mb-1">AUCUNE VENTE CE MOIS</p>
                <p className="font-mono text-[10px] text-zinc-400">
                  Les top produits s'afficheront ici
                </p>
              </div>
            ) : (
              <div>
                {top5.map((p, i) => (
                  <div key={p.designation} className="flex items-center gap-3 py-2.5 border-t border-zinc-50">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-eiffel text-yellow-950' : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm text-bitume truncate">{p.designation}</p>
                      <p className="font-mono text-[10px] text-zinc-400">
                        {p.qte} unité{p.qte > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="font-mono tabular text-sm font-bold text-paname-700 shrink-0">
                      {p.ca.toFixed(2)} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ÉTAT DES STOCKS ALERTES */}
        {alertesStock.length > 0 && (
          <div className="bg-white rounded-2xl border border-bitume/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="tag-street text-zinc-400">ÉTAT DES STOCKS</p>
              <Link to="/catalogue" className="tag-street text-paname-700 min-h-[44px] flex items-center px-2 -mr-2">
                VOIR TOUT →
              </Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {alertesStock.map(p => {
                const rupture = p.st_actuel === 0
                return (
                  <div key={p.id} className="flex items-center justify-between py-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-display font-bold text-sm text-bitume truncate">
                        {p.designation}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-400">{p.gamme}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono tabular text-[10px] text-zinc-500">
                        {p.st_actuel}/{p.st_min}
                      </span>
                      <span className={`tag-street px-2 py-1 rounded-md ${
                        rupture ? 'bg-pavillon text-white' : 'bg-eiffel text-yellow-950'
                      }`}>
                        {rupture ? 'RUPTURE' : 'INSUFF.'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
