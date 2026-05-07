import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { Search, X, ScanLine, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Constantes ───────────────────────────────────────────────────────────────

const GAMMES = [
  'Boissons énergétiques', 'Alcools', 'Confiseries',
  'Snacks', 'Hygiène', 'Autres',
]

const FORM_CREATION_VIDE = {
  designation: '', gamme: 'Boissons énergétiques',
  code: '', st_min: '', pr_vente: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStatut = (p) => {
  if (p.st_actuel === 0) return 'rupture'
  if (p.st_actuel < p.st_min) return 'insuffisant'
  return 'ok'
}

const ORDRE_MODAL = { insuffisant: 0, rupture: 1, ok: 2 }

// Traduit categories_tags Open Food Facts vers nos 6 gammes
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

// ─── Sous-composant ListeCourses ──────────────────────────────────────────────

const ListeCourses = ({
  listeCourses,
  setListeCourses,
  produitsCatalogue,
  toggleCheck,
  receptionItems,
  ajouterEtCocher,
  setOnglet,
}) => {
  const [modalAjout, setModalAjout] = useState(false)
  const [recherche, setRecherche] = useState('')

  const supprimerItem = (produitId) => {
    setListeCourses(prev => prev.filter(i => i.produit.id !== produitId))
  }

  const produitsDisponibles = produitsCatalogue
    .filter(p => !listeCourses.some(i => i.produit.id === p.id))
    .filter(p => p.designation.toLowerCase().includes(recherche.toLowerCase().trim()))
    .sort((a, b) => ORDRE_MODAL[getStatut(a)] - ORDRE_MODAL[getStatut(b)])

  const handleAjouter = (produit) => {
    ajouterEtCocher(produit)
    setModalAjout(false)
    setRecherche('')
  }

  const ruptures = listeCourses.filter(i => i.produit.st_actuel === 0)
  const insuff   = listeCourses.filter(i => i.produit.st_actuel > 0 && i.produit.st_actuel < i.produit.st_min)
  const manuels  = listeCourses.filter(i => i.produit.st_actuel >= i.produit.st_min)

  const nbCoches = receptionItems.length

  const renderItem = (item) => {
    const p = item.produit
    const statut = getStatut(p)
    const badgeClass = {
      rupture:     'bg-red-100 text-red-700',
      insuffisant: 'bg-orange-100 text-orange-700',
      ok:          'bg-green-100 text-green-700',
    }[statut]
    const badgeLabel = { rupture: 'Rupture', insuffisant: 'Insuffisant', ok: 'En stock' }[statut]

    return (
      <div
        key={p.id}
        className={`bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 transition-opacity ${
          item.checked ? 'opacity-40' : ''
        }`}
      >
        <input
          type="checkbox"
          checked={item.checked}
          onChange={() => toggleCheck(p.id)}
          className="w-5 h-5 accent-[#1D9E75] shrink-0 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium text-gray-800 truncate ${item.checked ? 'line-through' : ''}`}>
            {p.designation}
          </p>
          <p className="text-xs text-gray-400">
            {p.gamme} · stock {p.st_actuel}/{p.st_min} u.
          </p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
          {badgeLabel}
        </span>
        <button
          onClick={() => supprimerItem(p.id)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 shrink-0 transition-colors"
          aria-label="Retirer"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  const renderSection = (label, items) => {
    if (items.length === 0) return null
    return (
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
          {label} ({items.length})
        </p>
        <div className="flex flex-col gap-2">{items.map(renderItem)}</div>
      </div>
    )
  }

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-400">
          {listeCourses.length} produit{listeCourses.length !== 1 ? 's' : ''} à commander
        </p>
        <button
          onClick={() => setModalAjout(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1D9E75] text-white text-sm font-semibold rounded-xl active:opacity-80"
        >
          + Ajouter un produit
        </button>
      </div>

      {listeCourses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-gray-500">Aucun produit à commander</p>
          <p className="text-sm mt-1">Tous les stocks sont suffisants</p>
        </div>
      )}

      {renderSection('Ruptures totales', ruptures)}
      {renderSection('Stocks insuffisants', insuff)}
      {renderSection('Ajoutés manuellement', manuels)}

      {nbCoches > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3">
          <button
            onClick={() => setOnglet('reception')}
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 bg-[#1D9E75] text-white py-3.5 rounded-xl text-sm font-bold shadow-lg active:opacity-80"
          >
            📦 Passer à la réception
            <span className="bg-white text-[#1D9E75] text-xs font-bold px-2 py-0.5 rounded-full">
              {nbCoches}
            </span>
          </button>
        </div>
      )}

      {modalAjout && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) { setModalAjout(false); setRecherche('') } }}
        >
          <div className="bg-white w-full max-w-2xl mx-auto rounded-t-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-base font-semibold text-gray-800">Ajouter un produit</h3>
              <button
                onClick={() => { setModalAjout(false); setRecherche('') }}
                className="p-2 rounded-xl bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Rechercher un produit…"
                  value={recherche}
                  onChange={e => setRecherche(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2">
              {produitsDisponibles.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">Aucun produit disponible</p>
              )}
              {produitsDisponibles.map(p => {
                const statut = getStatut(p)
                const badgeClass = {
                  rupture:     'bg-red-100 text-red-700',
                  insuffisant: 'bg-orange-100 text-orange-700',
                  ok:          'bg-green-100 text-green-700',
                }[statut]
                const badgeLabel = { rupture: 'Rupture', insuffisant: 'Insuffisant', ok: 'En stock' }[statut]
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAjouter(p)}
                    className="w-full text-left flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-[#1D9E75] active:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
                      <p className="text-xs text-gray-400">{p.gamme} · {p.st_actuel}/{p.st_min} u.</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                      {badgeLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sous-composant Réception ─────────────────────────────────────────────────

const Reception = ({
  receptionItems,
  setReceptionItems,
  listeCourses,
  setListeCourses,
  validerAchats,
  validating,
}) => {
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const [offLoading, setOffLoading]       = useState(false)
  const [offMessage, setOffMessage]       = useState('')
  const [modalCreation, setModalCreation] = useState(false)
  const [formCreation, setFormCreation]   = useState(FORM_CREATION_VIDE)
  const [savingCreation, setSavingCreation] = useState(false)
  const videoRef  = useRef(null)
  const readerRef = useRef(null)

  // ── Scanner ZXing (même pattern que Catalogue.jsx) ───────────────────────
  // Délai 50 ms : attend que React ait monté le <video> dans le DOM avant ZXing
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
          handleScan(result.getText())
        }
      ).catch(err => {
        console.error('[Scan Réception] Caméra inaccessible :', err)
        if (!cancelled) setScannerOuvert(false)
      })
    }, 50)
    return () => {
      cancelled = true
      clearTimeout(timer)
      if (readerRef.current) { readerRef.current.reset(); readerRef.current = null }
    }
  }, [scannerOuvert])

  // ── Gestion du code scanné ───────────────────────────────────────────────
  async function handleScan(code) {
    const { data } = await supabase.from('produits').select('*').eq('code', code).single()
    if (data) {
      // Produit trouvé : ajouter ou incrémenter qtRecue
      setReceptionItems(prev => {
        const idx = prev.findIndex(i => i.produit.id === data.id)
        if (idx >= 0) {
          return prev.map((i, j) => j === idx ? { ...i, qtRecue: i.qtRecue + 1 } : i)
        }
        return [...prev, { produit: data, qtRecue: 1, dlc: '' }]
      })
    } else {
      // Produit inconnu : proposer création via Open Food Facts
      setFormCreation({ ...FORM_CREATION_VIDE, code })
      setOffMessage('')
      setModalCreation(true)
      chercherSurOFF(code)
    }
  }

  // ── Open Food Facts ──────────────────────────────────────────────────────
  async function chercherSurOFF(code) {
    setOffLoading(true)
    setOffMessage('')
    try {
      const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1) {
        const p = data.product
        setFormCreation(f => ({
          ...f,
          designation: p.product_name || f.designation,
          gamme:       detecterGamme(p.categories_tags),
        }))
      } else {
        setOffMessage('Produit non trouvé dans Open Food Facts')
      }
    } catch {
      setOffMessage('Erreur Open Food Facts')
    } finally {
      setOffLoading(false)
    }
  }

  // ── Créer le produit dans Supabase puis l'ajouter à la réception ─────────
  async function sauvegarderNouveauProduit(e) {
    e.preventDefault()
    setSavingCreation(true)
    const payload = {
      designation: formCreation.designation.trim(),
      gamme:       formCreation.gamme,
      code:        formCreation.code.trim() || null,
      st_actuel:   0,
      st_min:      parseFloat(formCreation.st_min) || 0,
      pr_vente:    parseFloat(formCreation.pr_vente) || 0,
    }
    const { data, error } = await supabase.from('produits').insert(payload).select().single()
    if (error) { console.error('[Création produit]', error); setSavingCreation(false); return }
    setReceptionItems(prev => [...prev, { produit: data, qtRecue: 1, dlc: '' }])
    setModalCreation(false)
    setFormCreation(FORM_CREATION_VIDE)
    setSavingCreation(false)
  }

  // ── Actions sur les items ────────────────────────────────────────────────
  const retirerItem = (produitId) => {
    setReceptionItems(prev => prev.filter(i => i.produit.id !== produitId))
    // Décoche aussi dans la liste de courses si l'item y était
    setListeCourses(prev =>
      prev.map(i => i.produit.id === produitId ? { ...i, checked: false } : i)
    )
  }

  const formatDLC = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2)
    return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4)
  }

  // Retourne true si la date est valide ou incomplète ; false si complète mais impossible
  const isDLCValide = (val) => {
    if (val.length < 10) return true
    const [dd, mm, yyyy] = val.split('/').map(Number)
    const d = new Date(yyyy, mm - 1, dd)
    return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd
  }

  const updateQty = (produitId, val) => {
    const n = Math.max(1, Number(val))
    setReceptionItems(prev =>
      prev.map(i => i.produit.id === produitId ? { ...i, qtRecue: n } : i)
    )
  }

  const updateDlc = (produitId, val) => {
    setReceptionItems(prev =>
      prev.map(i => i.produit.id === produitId ? { ...i, dlc: val } : i)
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="pb-28">
      {/* Bouton scanner */}
      <button
        onClick={() => setScannerOuvert(o => !o)}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold mb-4 transition-colors ${
          scannerOuvert
            ? 'bg-gray-200 text-gray-600'
            : 'bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20'
        }`}
      >
        <ScanLine size={18} />
        {scannerOuvert ? 'Fermer le scanner' : '📷 Scanner un produit reçu'}
      </button>

      {/* Zone caméra ZXing */}
      {scannerOuvert && (
        <div className="mb-4 rounded-xl overflow-hidden border border-[#1D9E75]/30 bg-black">
          {/* playsInline obligatoire sur iOS Safari pour éviter le plein-écran */}
          <video ref={videoRef} className="w-full" playsInline muted />
          <p className="text-center text-xs text-gray-400 py-2 bg-white border-t border-gray-100">
            Pointez la caméra vers le code-barres du produit reçu
          </p>
        </div>
      )}

      {receptionItems.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium text-gray-500">Aucune réception en attente</p>
          <p className="text-sm mt-1">Cochez des produits dans la liste de courses<br />ou scannez un code-barres</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {receptionItems.map(item => {
            const vientDeLaListe = listeCourses.some(i => i.produit.id === item.produit.id)
            return (
              <div key={item.produit.id} className="bg-white rounded-xl border border-gray-100 px-4 py-4">
                {/* Nom + badge liste + bouton retirer */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 mr-3">
                    <p className={`text-sm font-semibold truncate ${
                      vientDeLaListe ? 'text-[#1D9E75]' : 'text-gray-800'
                    }`}>
                      {item.produit.designation}
                    </p>
                    <p className="text-xs text-gray-400">{item.produit.gamme}</p>
                  </div>
                  <button
                    onClick={() => retirerItem(item.produit.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 shrink-0 transition-colors"
                    aria-label="Retirer"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1.5">Quantité reçue</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.produit.id, item.qtRecue - 1)}
                        className="w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 text-lg font-bold flex items-center justify-center active:bg-gray-100"
                      >−</button>
                      <span className="flex-1 text-center text-sm font-semibold text-gray-800">
                        {item.qtRecue}
                      </span>
                      <button
                        onClick={() => updateQty(item.produit.id, item.qtRecue + 1)}
                        className="w-9 h-9 rounded-xl border border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75] text-lg font-bold flex items-center justify-center active:bg-[#1D9E75]/20"
                      >+</button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1.5">DLC (optionnel)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength="10"
                      value={item.dlc}
                      onChange={e => updateDlc(item.produit.id, formatDLC(e.target.value))}
                      placeholder="JJ/MM/AAAA"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-colors ${
                        isDLCValide(item.dlc)
                          ? 'border-gray-200 focus:border-[#1D9E75]'
                          : 'border-red-400 focus:border-red-400 bg-red-50'
                      }`}
                    />
                    {!isDLCValide(item.dlc) && (
                      <p className="text-xs text-red-500 mt-1">Date impossible</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bouton valider — visible seulement si items présents */}
      {receptionItems.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3">
          <button
            onClick={validerAchats}
            disabled={validating || receptionItems.some(i => !isDLCValide(i.dlc))}
            className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 bg-[#1D9E75] text-white py-3.5 rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 active:opacity-80"
          >
            {validating ? (
              <><Loader2 size={16} className="animate-spin" /> Validation…</>
            ) : (
              <>✓ Valider les achats ({receptionItems.length} produit{receptionItems.length !== 1 ? 's' : ''})</>
            )}
          </button>
        </div>
      )}

      {/* ── Modal création produit (scan inconnu + OFF) ──────────────────── */}
      {modalCreation && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 flex items-end sm:items-center sm:justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModalCreation(false) }}
        >
          <div className="bg-white w-full max-h-[92vh] rounded-t-2xl sm:rounded-2xl sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Produit inconnu</h2>
                <p className="text-xs text-gray-400">Créer et ajouter à la réception</p>
              </div>
              <button onClick={() => setModalCreation(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={sauvegarderNouveauProduit} className="flex-1 flex flex-col overflow-hidden">
              <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

                {/* Feedback OFF */}
                {offLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
                    <Loader2 size={14} className="animate-spin text-[#1D9E75]" />
                    Recherche Open Food Facts…
                  </div>
                )}
                {offMessage && (
                  <p className="text-xs text-orange-500 bg-orange-50 rounded-xl px-3 py-2.5">{offMessage}</p>
                )}

                {/* Code EAN (pré-rempli, lecture seule) */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Code EAN</label>
                  <input
                    type="text"
                    value={formCreation.code}
                    readOnly
                    className="w-full px-3 py-2.5 border border-gray-100 rounded-xl text-sm bg-gray-50 text-gray-500 font-mono"
                  />
                </div>

                {/* Désignation */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Désignation <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCreation.designation}
                    onChange={e => setFormCreation(f => ({ ...f, designation: e.target.value }))}
                    placeholder="Ex : Red Bull 250ml"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                  />
                </div>

                {/* Gamme */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Gamme</label>
                  <select
                    value={formCreation.gamme}
                    onChange={e => setFormCreation(f => ({ ...f, gamme: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75] bg-white"
                  >
                    {GAMMES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {/* Stock min / Prix vente */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Stock minimum</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formCreation.st_min}
                      onChange={e => setFormCreation(f => ({ ...f, st_min: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      Prix vente (€) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formCreation.pr_vente}
                      onChange={e => setFormCreation(f => ({ ...f, pr_vente: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-600">
                    Le stock initial sera mis à jour automatiquement lors de la validation de la réception.
                  </p>
                </div>

              </div>

              <div className="flex gap-3 px-4 pt-3 pb-16 sm:pb-5 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalCreation(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingCreation || offLoading}
                  className="flex-1 py-3 rounded-xl bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {savingCreation ? 'Création…' : 'Créer et ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Historique ────────────────────────────────────────────────────────

function formaterDateLivraison(isoString) {
  const d = new Date(isoString)
  const datePart = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${datePart} à ${h}h${m}`
}

function formaterDlc(iso) {
  const [aaaa, mm, jj] = iso.split('-')
  return `${jj}/${mm}/${aaaa}`
}

function OngletHistorique({ historique }) {
  if (historique.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-medium text-gray-500">Aucune livraison enregistrée</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      {historique.map(livraison => {
        const lignes = livraison.stock_dlc ?? []
        const nbProduits = lignes.length
        return (
          <div key={livraison.id} className="bg-white rounded-xl border border-gray-100 px-4 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {formaterDateLivraison(livraison.created_at)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {nbProduits} produit{nbProduits !== 1 ? 's' : ''} reçu{nbProduits !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {lignes.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Aucun produit avec DLC enregistré</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lignes.map(ligne => (
                  <div key={ligne.id} className="flex items-center justify-between py-2">
                    <p className="text-sm text-gray-700 truncate flex-1 mr-3">
                      {ligne.designation}
                    </p>
                    <div className="flex items-center gap-3 shrink-0">
                      {ligne.dlc && (
                        <span className="text-xs text-gray-400">DLC {formaterDlc(ligne.dlc)}</span>
                      )}
                      <span className="text-xs font-semibold text-[#1D9E75]">
                        ×{ligne.quantite}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page principale Achats ───────────────────────────────────────────────────

const Achats = () => {
  const { user } = useAuth()
  const [onglet, setOnglet]                   = useState('liste')
  const [listeCourses, setListeCourses]       = useState([])
  const [receptionItems, setReceptionItems]   = useState([])
  const [produitsCatalogue, setProduitsCatalogue] = useState([])
  const [loading, setLoading]                 = useState(true)
  const [validating, setValidating]           = useState(false)
  const [toast, setToast]                     = useState('')
  const [historique, setHistorique]           = useState([])

  // Auto-dismiss du toast après 2.5 s
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    async function fetchProduits() {
      const { data, error } = await supabase.from('produits').select('*')
      if (error) { console.error(error); setLoading(false); return }

      const rupturesTotales = data.filter(p => p.st_actuel === 0)
      const insuff = data.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min)
      const initial = [...rupturesTotales, ...insuff].map(p => ({ produit: p, checked: false }))

      setProduitsCatalogue(data)
      setListeCourses(initial)
      setLoading(false)
    }
    fetchProduits()
  }, [])

  useEffect(() => {
    if (onglet !== 'historique') return
    supabase
      .from('livraisons')
      .select('*, stock_dlc(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistorique(data ?? []))
  }, [onglet])

  // ── Cocher = ajouter à receptionItems ; décocher = retirer ───────────────
  const toggleCheck = (produitId) => {
    const item = listeCourses.find(i => i.produit.id === produitId)
    if (!item) return
    const nowChecked = !item.checked
    setListeCourses(prev =>
      prev.map(i => i.produit.id === produitId ? { ...i, checked: nowChecked } : i)
    )
    if (nowChecked) {
      setReceptionItems(prev =>
        prev.some(i => i.produit.id === produitId)
          ? prev
          : [...prev, { produit: item.produit, qtRecue: 1, dlc: '' }]
      )
    } else {
      setReceptionItems(prev => prev.filter(i => i.produit.id !== produitId))
    }
  }

  // ── Ajouter depuis le modal et cocher directement ────────────────────────
  const ajouterEtCocher = (produit) => {
    setListeCourses(prev => {
      if (prev.some(i => i.produit.id === produit.id)) return prev
      return [...prev, { produit, checked: true }]
    })
    setReceptionItems(prev => {
      if (prev.some(i => i.produit.id === produit.id)) return prev
      return [...prev, { produit, qtRecue: 1, dlc: '' }]
    })
  }

  // ── Validation des achats ────────────────────────────────────────────────

  function convertirDlc(dlcStr) {
    const [jj, mm, aaaa] = dlcStr.split('/')
    return `${aaaa}-${mm}-${jj}`
  }

  const validerAchats = async () => {
    setValidating(true)
    try {
      // 1. Mettre à jour st_actuel de chaque produit (stock actuel + qté reçue)
      for (const item of receptionItems) {
        await supabase
          .from('produits')
          .update({ st_actuel: item.produit.st_actuel + item.qtRecue })
          .eq('id', item.produit.id)
      }

      // 2. Créer la livraison
      const { data: livraison, error: errLivraison } = await supabase
        .from('livraisons')
        .insert({ user_id: user?.id })
        .select()
        .single()

      if (errLivraison || !livraison) {
        console.error('Erreur création livraison', errLivraison)
        setToast('Erreur lors de la validation')
        setValidating(false)
        return
      }

      // 3. Insérer les lignes DLC pour les items qui en ont une
      const lignesDlc = receptionItems
        .filter(item => item.dlc)
        .map(item => ({
          produit_id:  item.produit.id,
          designation: item.produit.designation,
          quantite:    item.qtRecue,
          dlc:         convertirDlc(item.dlc),
          livraison_id: livraison.id,
        }))

      if (lignesDlc.length > 0) {
        await supabase.from('stock_dlc').insert(lignesDlc)
      }

      // 4. Reset
      setReceptionItems([])
      setListeCourses(prev => prev.map(i => ({ ...i, checked: false })))
      setToast('✓ Achats validés !')
      setOnglet('liste')
    } catch (err) {
      console.error('[validerAchats]', err)
      setToast('Erreur lors de la validation')
    }
    setValidating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-gray-800 text-white text-sm font-medium px-4 py-3 rounded-xl text-center shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Header sticky */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800 mb-3">🛒 Achats</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setOnglet('liste')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              onglet === 'liste'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            📋 Liste de courses
          </button>
          <button
            onClick={() => setOnglet('reception')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              onglet === 'reception'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            📦 Réception
            {receptionItems.length > 0 && (
              <span className="bg-[#1D9E75] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {receptionItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setOnglet('historique')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              onglet === 'historique'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            🕐 Historique
          </button>
        </div>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        {onglet === 'liste' && (
          <ListeCourses
            listeCourses={listeCourses}
            setListeCourses={setListeCourses}
            produitsCatalogue={produitsCatalogue}
            toggleCheck={toggleCheck}
            receptionItems={receptionItems}
            ajouterEtCocher={ajouterEtCocher}
            setOnglet={setOnglet}
          />
        )}
        {onglet === 'reception' && (
          <Reception
            receptionItems={receptionItems}
            setReceptionItems={setReceptionItems}
            listeCourses={listeCourses}
            setListeCourses={setListeCourses}
            validerAchats={validerAchats}
            validating={validating}
          />
        )}
        {onglet === 'historique' && (
          <OngletHistorique historique={historique} />
        )}
      </div>
    </div>
  )
}

export default Achats
