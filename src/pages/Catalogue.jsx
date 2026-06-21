// PRESERVED: all state, useEffects, functions, useMemo, GAMMES, FORM_VIDE, detecterGamme
import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { BrowserMultiFormatReader } from '@zxing/library'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Pencil, Trash2, ScanLine, X, AlertTriangle, Loader2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const GAMMES = [
  'Boissons énergétiques', 'Alcools', 'Confiseries',
  'Snacks', 'Hygiène', 'Autres',
]

const FORM_VIDE = {
  designation: '', gamme: 'Boissons énergétiques',
  code: '', st_actuel: '', st_min: '', pr_vente: '', pr_vente_especes: '',
}

function detecterGamme(categoriesTags = []) {
  const cats = categoriesTags.map(c => c.toLowerCase())
  if (cats.some(c => c.includes('energy-drink'))) return 'Boissons énergétiques'
  if (cats.some(c =>
    c.includes('alcohol') || c.includes('beer') || c.includes('wine') ||
    c.includes('spirit') || c.includes('liqueur') || c.includes('aperitif')
  )) return 'Alcools'
  if (cats.some(c =>
    c.includes('confection') || c.includes('candy') || c.includes('chocolate') ||
    c.includes('biscuit') || c.includes('sweet') || c.includes('bonbon')
  )) return 'Confiseries'
  if (cats.some(c =>
    c.includes('snack') || c.includes('chip') || c.includes('crisp') || c.includes('nuts')
  )) return 'Snacks'
  if (cats.some(c =>
    c.includes('hygiene') || c.includes('personal-care') ||
    c.includes('cosmetic') || c.includes('soap') || c.includes('shampoo')
  )) return 'Hygiène'
  return 'Autres'
}

export default function Catalogue() {
  const { role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [produits, setProduits]           = useState([])
  const [dlcParProduit, setDlcParProduit] = useState({})
  const [loading, setLoading]             = useState(true)
  const [recherche, setRecherche]         = useState('')

  const [modalOuvert, setModalOuvert]       = useState(false)
  const [produitEnCours, setProduitEnCours] = useState(null)
  const [form, setForm]                     = useState(FORM_VIDE)
  const [saving, setSaving]                 = useState(false)

  const [confirmSupp, setConfirmSupp] = useState(null)

  const [scannerOuvert, setScannerOuvert] = useState(false)
  const videoRef  = useRef(null)
  const readerRef = useRef(null)

  const [offLoading, setOffLoading] = useState(false)
  const [offMessage, setOffMessage] = useState('')

  // filtre statut — new minimal state
  const [filtre, setFiltre] = useState('tous')

  useEffect(() => {
    if (!authLoading && role && role !== 'manager' && role !== 'gerant') {
      navigate('/ruptures', { replace: true })
    }
  }, [role, authLoading, navigate])

  useEffect(() => {
    fetchProduits()
  }, [])

  async function fetchProduits() {
    const [{ data, error }, { data: dlcData }] = await Promise.all([
      supabase
        .from('produits')
        .select('id, code, designation, gamme, st_actuel, st_min, pr_vente, pr_vente_especes')
        .order('designation'),
      supabase.from('stock_dlc').select('*'),
    ])
    if (error) console.error('[Catalogue] Supabase :', error.message)
    else setProduits(data)

    const map = {}
    dlcData?.forEach(entry => {
      if (!entry.dlc) return // produit reçu sans DLC : pas de badge à afficher
      const existing = map[entry.produit_id]
      if (!existing || entry.dlc < existing.dlc) map[entry.produit_id] = entry
    })
    setDlcParProduit(map)
    setLoading(false)
  }

  // Délai 50 ms : attend que React ait monté le <video> dans le DOM avant de
  // passer la ref à ZXing. Absorbe aussi le double-fire de StrictMode en dev.
  useEffect(() => {
    if (!scannerOuvert) return

    let cancelled = false

    const timer = setTimeout(() => {
      if (cancelled || !videoRef.current) return

      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        (result) => {
          if (!result || cancelled) return
          cancelled = true
          reader.reset()
          readerRef.current = null
          setScannerOuvert(false)

          const code = result.getText()
          setForm(f => ({ ...f, code }))
          setOffMessage('')
          chercherSurOFF(code)
        }
      ).catch(err => {
        console.error('[Scan] Caméra inaccessible :', err)
        if (!cancelled) setScannerOuvert(false)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (readerRef.current) {
        readerRef.current.reset()
        readerRef.current = null
      }
    }
  }, [scannerOuvert])

  async function chercherSurOFF(code) {
    setOffLoading(true)
    setOffMessage('')
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1) {
        const p = data.product
        setForm(f => ({
          ...f,
          designation: p.product_name || f.designation,
          gamme:       detecterGamme(p.categories_tags),
        }))
      } else {
        setOffMessage('Produit non trouvé dans la base Open Food Facts')
      }
    } catch {
      setOffMessage('Erreur lors de la recherche Open Food Facts')
    } finally {
      setOffLoading(false)
    }
  }

  function fermerModal() {
    setScannerOuvert(false)
    setOffMessage('')
    setModalOuvert(false)
  }

  function ouvrirAjout() {
    setProduitEnCours(null)
    setForm(FORM_VIDE)
    setScannerOuvert(false)
    setOffMessage('')
    setModalOuvert(true)
    setTimeout(() => { document.getElementById('input-code-ean')?.focus() }, 100)
  }

  function ouvrirModif(p) {
    setProduitEnCours(p)
    setForm({
      designation:      p.designation,
      gamme:            p.gamme,
      code:             p.code ?? '',
      st_actuel:        p.st_actuel ?? '',
      st_min:           p.st_min ?? '',
      pr_vente:         p.pr_vente ?? '',
      pr_vente_especes: p.pr_vente_especes ?? '',
    })
    setScannerOuvert(false)
    setOffMessage('')
    setModalOuvert(true)
    setTimeout(() => { document.getElementById('input-code-ean')?.focus() }, 100)
  }

  async function sauvegarder(e) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      designation:      form.designation.trim(),
      gamme:            form.gamme,
      code:             form.code.trim() || null,
      st_actuel:        parseFloat(form.st_actuel) || 0,
      st_min:           parseFloat(form.st_min) || 0,
      pr_vente:         parseFloat(form.pr_vente),
      // null (pas 0) si vide → "prix espèces = prix CB" par défaut côté lecture
      pr_vente_especes: parseFloat(form.pr_vente_especes) || null,
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

  const produitsFiltres = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  // counts derived from full produits list (unaffected by recherche)
  const nbRuptures = produits.filter(p => p.st_actuel === 0).length
  const nbFaibles  = produits.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min).length
  const nbOk       = produits.filter(p => p.st_actuel >= p.st_min).length

  // apply status filtre on top of text search
  const produitsFiltresAvecStatut = useMemo(() => {
    if (filtre === 'tous') return produitsFiltres
    if (filtre === 'rupture') return produitsFiltres.filter(p => p.st_actuel === 0)
    if (filtre === 'faible')  return produitsFiltres.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min)
    if (filtre === 'ok')      return produitsFiltres.filter(p => p.st_actuel >= p.st_min)
    return produitsFiltres
  }, [produitsFiltres, filtre])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="tag-street text-eiffel">CHARGEMENT…</p>
      </div>
    )
  }

  if (!role || (role !== 'manager' && role !== 'gerant')) return null

  return (
    <div className="pb-20">

      {/* ── TOP SECTION ───────────────────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="tag-street text-zinc-400">CATALOGUE</p>
            <p className="font-display text-3xl font-bold text-bitume">{produits.length} produits</p>
          </div>
          <button
            onClick={ouvrirAjout}
            className="w-10 h-10 rounded-2xl bg-paname-700 text-white flex items-center justify-center shadow-paname"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* ── FILTER PILLS ──────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
          <button
            onClick={() => setFiltre('tous')}
            className={`tag-street px-3 py-2 rounded-xl border whitespace-nowrap transition ${
              filtre === 'tous'
                ? 'bg-bitume text-white border-bitume'
                : 'bg-white text-zinc-500 border-bitume/10'
            }`}
          >
            TOUS
          </button>
          <button
            onClick={() => setFiltre('rupture')}
            className={`tag-street px-3 py-2 rounded-xl border whitespace-nowrap transition ${
              filtre === 'rupture'
                ? 'bg-pavillon text-white border-pavillon shadow-rouge'
                : 'bg-white text-zinc-500 border-bitume/10'
            }`}
          >
            RUPTURES {nbRuptures > 0 && `· ${nbRuptures}`}
          </button>
          <button
            onClick={() => setFiltre('faible')}
            className={`tag-street px-3 py-2 rounded-xl border whitespace-nowrap transition ${
              filtre === 'faible'
                ? 'bg-eiffel text-yellow-950 border-eiffel shadow-or'
                : 'bg-white text-zinc-500 border-bitume/10'
            }`}
          >
            INSUFF. {nbFaibles > 0 && `· ${nbFaibles}`}
          </button>
          <button
            onClick={() => setFiltre('ok')}
            className={`tag-street px-3 py-2 rounded-xl border whitespace-nowrap transition ${
              filtre === 'ok'
                ? 'bg-signal text-white border-signal'
                : 'bg-white text-zinc-500 border-bitume/10'
            }`}
          >
            EN STOCK {nbOk > 0 && `· ${nbOk}`}
          </button>
        </div>

        {/* ── SEARCH BAR ────────────────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher un produit…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-bitume/10 rounded-2xl text-sm outline-none focus:border-paname-700 transition-colors"
          />
        </div>
      </div>

      {/* ── LISTE ─────────────────────────────────────────────────────────── */}
      <div className="px-4 space-y-2">
        {produitsFiltresAvecStatut.length === 0 && (
          <div className="text-center py-16">
            <p className="tag-street text-zinc-400 mb-2">AUCUN PRODUIT</p>
            <p className="text-sm text-zinc-400">Modifie les filtres ou ajoute un produit</p>
          </div>
        )}

        {produitsFiltresAvecStatut.map(p => {
          const statut = p.st_actuel === 0
            ? 'rupture'
            : p.st_actuel < p.st_min
              ? 'faible'
              : 'ok'

          const dlcEntry = dlcParProduit[p.id]
          const dlcBadge = dlcEntry?.dlc ? (() => {
            const [yyyy, mm, dd] = dlcEntry.dlc?.split('-') ?? []
            const label = `${dd}/${mm}/${yyyy}`
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const dlcDate = new Date(dlcEntry.dlc); dlcDate.setHours(0, 0, 0, 0)
            const jours = Math.ceil((dlcDate - today) / 86400000)
            if (jours < 3)  return { label, cls: 'text-pavillon', prefix: '⚠ DLC : ' }
            if (jours < 14) return { label, cls: 'text-eiffel',   prefix: '🕐 DLC : ' }
            return              { label, cls: 'text-zinc-400',  prefix: 'DLC : ' }
          })() : null

          return (
            <Card key={p.id} variant={statut === 'ok' ? 'default' : statut}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-display font-bold text-sm text-bitume truncate flex-1">{p.designation}</p>
                <Badge variant={statut}>
                  {statut === 'rupture' ? 'Rupture' : statut === 'faible' ? 'Insuffisant' : 'En stock'}
                </Badge>
              </div>

              <p className="font-mono text-[10px] text-zinc-400 mb-2">
                {p.gamme}
                {p.code && ` · ${p.code}`}
                {dlcBadge && (
                  <span className={dlcBadge.cls}>{` · ${dlcBadge.prefix}${dlcBadge.label}`}</span>
                )}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <span className={`font-display tabular text-3xl font-bold ${
                    statut === 'rupture' ? 'text-pavillon' : statut === 'faible' ? 'text-eiffel' : 'text-signal'
                  }`}>
                    {p.st_actuel}
                  </span>
                  <span className="font-mono text-zinc-400 text-xs">/{p.st_min} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display tabular text-xl font-bold text-bitume">{p.pr_vente?.toFixed(2)} €</span>
                  <button
                    onClick={() => ouvrirModif(p)}
                    aria-label="Modifier"
                    className="p-2 rounded-xl bg-bitume/5 text-bitume hover:bg-bitume/10 transition"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setConfirmSupp(p)}
                    aria-label="Supprimer"
                    className="p-2 rounded-xl bg-pavillon/10 text-pavillon hover:bg-pavillon/20 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* ── MODAL AJOUT / MODIFICATION ────────────────────────────────────── */}
      {modalOuvert && createPortal(
        <div
          className="fixed inset-0 z-[55] bg-black/50 flex items-end sm:items-center sm:justify-center"
          onClick={e => { if (e.target === e.currentTarget) fermerModal() }}
        >
          <div className="bg-white w-full max-h-[92vh] rounded-t-3xl sm:rounded-3xl sm:max-w-md flex flex-col border-t-2 border-paname-700 sm:border-t-0">

            <div className="flex items-center justify-between px-4 py-4 border-b border-bitume/5 shrink-0">
              <h2 className="font-display font-bold text-lg text-bitume">
                {produitEnCours ? 'Modifier le produit' : 'Ajouter un produit'}
              </h2>
              <button onClick={fermerModal} className="p-2 rounded-xl bg-bitume/5 text-bitume">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={sauvegarder} className="flex-1 flex flex-col overflow-hidden">

              <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">

                <div>
                  <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Désignation <span className="text-pavillon">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.designation}
                    onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                    placeholder="Ex : Red Bull 250ml"
                    className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">Gamme</label>
                  <select
                    value={form.gamme}
                    onChange={e => setForm(f => ({ ...f, gamme: e.target.value }))}
                    className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                  >
                    {GAMMES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Code EAN (optionnel)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="input-code-ean"
                      type="text"
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (form.code.trim()) chercherSurOFF(form.code.trim())
                        }
                      }}
                      placeholder="Ex : 9002490100070"
                      className="flex-1 bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerOuvert(o => !o)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium shrink-0 transition-colors ${
                        scannerOuvert
                          ? 'bg-zinc-100 text-zinc-600'
                          : 'bg-paname-700/10 border border-paname-700/20 text-paname-700'
                      }`}
                    >
                      <ScanLine size={16} />
                      {scannerOuvert ? 'Fermer' : 'Scanner'}
                    </button>
                  </div>

                  {/* playsInline obligatoire sur iOS Safari pour éviter le plein-écran */}
                  {scannerOuvert && (
                    <div className="mt-2 rounded-2xl overflow-hidden border border-paname-700/30 bg-black">
                      <video ref={videoRef} className="w-full" playsInline muted />
                      <p className="text-center text-xs text-zinc-400 py-2 bg-white border-t border-bitume/5">
                        Pointez la caméra vers le code-barres
                      </p>
                    </div>
                  )}

                  {offLoading && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                      <Loader2 size={14} className="animate-spin text-paname-700" />
                      Recherche Open Food Facts…
                    </div>
                  )}

                  {offMessage && (
                    <p className="text-eiffel text-xs mt-1">{offMessage}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">Stock actuel</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.st_actuel}
                      onChange={e => setForm(f => ({ ...f, st_actuel: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">Stock minimum</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.st_min}
                      onChange={e => setForm(f => ({ ...f, st_min: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Prix vente CB (€) <span className="text-pavillon">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.pr_vente}
                    onChange={e => setForm(f => ({ ...f, pr_vente: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Prix espèces (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pr_vente_especes}
                    onChange={e => setForm(f => ({ ...f, pr_vente_especes: e.target.value }))}
                    placeholder="0.00"
                    className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none py-2 text-bitume text-sm transition-colors"
                  />
                  <p className="font-mono text-[10px] text-zinc-400 mt-1.5">
                    Laisser vide si le prix est identique en CB et en espèces.
                  </p>
                  {form.pr_vente_especes && form.pr_vente &&
                   Number(form.pr_vente_especes) >= Number(form.pr_vente) && (
                    <p className="font-mono text-[10px] text-eiffel mt-1">
                      ⚠ Le prix espèces est censé être inférieur au prix CB.
                    </p>
                  )}
                </div>

              </div>

              {/* pb-16 = hauteur bottom nav mobile, sm:pb-5 sur desktop */}
              <div className="flex gap-3 px-4 pt-3 pb-16 sm:pb-5 border-t border-bitume/5 shrink-0">
                <button
                  type="button"
                  onClick={fermerModal}
                  className="flex-1 py-3 rounded-xl border border-bitume/10 text-sm font-semibold text-bitume"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-paname-700 text-white text-sm font-semibold shadow-paname disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde…' : produitEnCours ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>

            </form>
          </div>
        </div>
      , document.body)}

      {/* ── DIALOG CONFIRMATION SUPPRESSION ───────────────────────────────── */}
      {confirmSupp && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 border border-bitume/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-pavillon/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-pavillon" />
              </div>
              <h2 className="font-display font-bold text-bitume">Supprimer ce produit ?</h2>
            </div>
            <p className="text-sm text-zinc-500 mb-6">
              <strong className="text-bitume">{confirmSupp.designation}</strong> sera
              définitivement supprimé du catalogue.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSupp(null)}
                className="flex-1 py-3 rounded-xl border border-bitume/10 text-sm font-semibold text-bitume"
              >
                Annuler
              </button>
              <button
                onClick={() => supprimer(confirmSupp.id)}
                className="flex-1 py-3 rounded-xl bg-pavillon text-white text-sm font-semibold shadow-rouge"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  )
}
