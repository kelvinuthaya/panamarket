import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Pencil, Trash2, ScanLine, X, AlertTriangle } from 'lucide-react'

const GAMMES = [
  'Boissons énergétiques', 'Alcools', 'Confiseries',
  'Snacks', 'Hygiène', 'Autres',
]

const FORM_VIDE = {
  designation: '', gamme: 'Boissons énergétiques',
  code: '', st_actuel: '', st_min: '', pr_vente: '',
}

export default function Catalogue() {
  const { role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [produits, setProduits]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [recherche, setRecherche]   = useState('')

  // Modal add/edit
  const [modalOuvert, setModalOuvert]       = useState(false)
  const [produitEnCours, setProduitEnCours] = useState(null) // null = ajout
  const [form, setForm]                     = useState(FORM_VIDE)
  const [saving, setSaving]                 = useState(false)

  // Confirm suppression
  const [confirmSupp, setConfirmSupp] = useState(null)

  // Scanner
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const scannerRef = useRef(null)

  // ── Accès ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && role && role !== 'manager' && role !== 'gérant') {
      navigate('/ruptures', { replace: true })
    }
  }, [role, authLoading, navigate])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProduits()
  }, [])

  async function fetchProduits() {
    const { data, error } = await supabase
      .from('produits')
      .select('id, code, designation, gamme, st_actuel, st_min, pr_vente')
      .order('designation')
    if (error) console.error('[Catalogue] Supabase :', error.message)
    else setProduits(data)
    setLoading(false)
  }

  // ── Scanner ───────────────────────────────────────────────────────────────
  // 50 ms de délai pour absorber le double-fire de useEffect en StrictMode (dev).
  // En production, StrictMode ne double-fire pas → le délai est invisible.
  useEffect(() => {
    if (!scannerOuvert) return

    let cancelled = false
    let scanner = null

    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          (code) => {
            if (cancelled) return
            setForm(f => ({ ...f, code }))
            cancelled = true
            scanner.stop()
              .then(() => { try { scanner.clear() } catch {} })
              .catch(() => {})
            scannerRef.current = null
            setScannerOuvert(false)
          },
          () => {} // erreurs de frame ignorées
        )
      } catch (err) {
        console.error('[Scan] Caméra inaccessible :', err)
        if (!cancelled) setScannerOuvert(false)
      }
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (scanner?.isScanning) {
        scanner.stop()
          .then(() => { try { scanner.clear() } catch {} })
          .catch(() => {})
      }
      scannerRef.current = null
    }
  }, [scannerOuvert])

  // ── Fermer modal (stop scanner d'abord) ───────────────────────────────────
  function fermerModal() {
    setScannerOuvert(false)
    setModalOuvert(false)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function ouvrirAjout() {
    setProduitEnCours(null)
    setForm(FORM_VIDE)
    setScannerOuvert(false)
    setModalOuvert(true)
  }

  function ouvrirModif(p) {
    setProduitEnCours(p)
    setForm({
      designation: p.designation,
      gamme:       p.gamme,
      code:        p.code ?? '',
      st_actuel:   p.st_actuel ?? '',
      st_min:      p.st_min ?? '',
      pr_vente:    p.pr_vente ?? '',
    })
    setScannerOuvert(false)
    setModalOuvert(true)
  }

  async function sauvegarder(e) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      designation: form.designation.trim(),
      gamme:       form.gamme,
      code:        form.code.trim() || null,
      st_actuel:   parseFloat(form.st_actuel) || 0,
      st_min:      parseFloat(form.st_min) || 0,
      pr_vente:    parseFloat(form.pr_vente),
    }

    const { error } = produitEnCours
      ? await supabase.from('produits').update(payload).eq('id', produitEnCours.id)
      : await supabase.from('produits').insert(payload)

    if (error) {
      console.error('[Catalogue] Sauvegarde :', error.message)
    } else {
      await fetchProduits()
      fermerModal()
    }
    setSaving(false)
  }

  async function supprimer(id) {
    const { error } = await supabase.from('produits').delete().eq('id', id)
    if (error) { console.error('[Catalogue] Suppression :', error.message); return }
    setProduits(prev => prev.filter(p => p.id !== id))
    setConfirmSupp(null)
  }

  // ── Filtre recherche ───────────────────────────────────────────────────────
  const produitsFiltres = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  // ── Render guards ─────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  if (!role || (role !== 'manager' && role !== 'gérant')) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-20">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Catalogue</h1>
            <p className="text-xs text-gray-400">{produits.length} produit{produits.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={ouvrirAjout}
            className="flex items-center gap-1.5 bg-[#1D9E75] text-white px-3 py-2 rounded-xl text-sm font-semibold active:opacity-80"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
          />
        </div>
      </header>

      {/* ── LISTE ─────────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-2">
        {produitsFiltres.length === 0 && (
          <p className="text-center text-gray-400 mt-16 text-sm">Aucun produit trouvé.</p>
        )}

        {produitsFiltres.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.designation}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.gamme}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs text-gray-500">
                    Stock : <strong className="text-gray-700">{p.st_actuel}</strong>
                    <span className="text-gray-400"> / min {p.st_min}</span>
                  </span>
                  <span className="text-xs font-semibold text-[#1D9E75]">
                    {p.pr_vente?.toFixed(2)} €
                  </span>
                  {p.code && (
                    <span className="text-xs text-gray-400 font-mono">{p.code}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                <button
                  onClick={() => ouvrirModif(p)}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 active:bg-gray-200"
                  aria-label="Modifier"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setConfirmSupp(p)}
                  className="p-2 rounded-lg bg-red-50 text-red-500 active:bg-red-100"
                  aria-label="Supprimer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL AJOUT / MODIFICATION ────────────────────────────────────── */}
      {modalOuvert && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center sm:justify-center"
          onClick={e => { if (e.target === e.currentTarget) fermerModal() }}
        >
          <div className="bg-white w-full max-h-[92vh] rounded-t-2xl sm:rounded-2xl sm:max-w-md flex flex-col">

            {/* Header modal */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-800">
                {produitEnCours ? 'Modifier le produit' : 'Ajouter un produit'}
              </h2>
              <button onClick={fermerModal} className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Formulaire scrollable */}
            <form onSubmit={sauvegarder} className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

              {/* Désignation */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Désignation <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.designation}
                  onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="Ex : Red Bull 250ml"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                />
              </div>

              {/* Gamme */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Gamme</label>
                <select
                  value={form.gamme}
                  onChange={e => setForm(f => ({ ...f, gamme: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75] bg-white"
                >
                  {GAMMES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Code EAN + scanner */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Code EAN (optionnel)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="Ex : 9002490100070"
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOuvert(o => !o)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium shrink-0 transition-colors ${
                      scannerOuvert
                        ? 'bg-gray-200 text-gray-600'
                        : 'bg-[#1D9E75]/10 text-[#1D9E75]'
                    }`}
                  >
                    <ScanLine size={16} />
                    {scannerOuvert ? 'Fermer' : 'Scanner'}
                  </button>
                </div>

                {/* Zone caméra — html5-qrcode injecte le flux vidéo dans ce div via son id */}
                {scannerOuvert && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-[#1D9E75]/30 bg-black">
                    <div id="qr-reader" className="w-full" />
                    <p className="text-center text-xs text-gray-400 py-2 bg-white border-t border-gray-100">
                      Pointez la caméra vers le code-barres
                    </p>
                  </div>
                )}
              </div>

              {/* Stock actuel / Stock min */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Stock actuel</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.st_actuel}
                    onChange={e => setForm(f => ({ ...f, st_actuel: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Stock minimum</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.st_min}
                    onChange={e => setForm(f => ({ ...f, st_min: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                  />
                </div>
              </div>

              {/* Prix de vente */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">
                  Prix de vente (€) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={form.pr_vente}
                  onChange={e => setForm(f => ({ ...f, pr_vente: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2 pb-2">
                <button
                  type="button"
                  onClick={fermerModal}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde…' : produitEnCours ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── DIALOG CONFIRMATION SUPPRESSION ───────────────────────────────── */}
      {confirmSupp && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Supprimer ce produit ?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              <strong className="text-gray-700">{confirmSupp.designation}</strong> sera
              définitivement supprimé du catalogue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSupp(null)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={() => supprimer(confirmSupp.id)}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
