import { useState, useEffect, useMemo, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/library'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { Search, Plus, Minus, FileText, Mail, ClipboardList, X, AlertTriangle, ScanLine, Trash2 } from 'lucide-react'

const today   = new Date().toLocaleDateString('en-CA')
const todayFr = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})
const STORAGE_KEY_PANIER = `caisse_${today}`

export default function Caisse() {
  const [produits, setProduits]   = useState([])
  const [panier, setPanier]       = useState({})        // { [id]: quantite } — temporaire
  const [transactions, setTransactions] = useState([]) // ventes validées de la journée
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading]     = useState(true)
  const [modePaiement, setModePaiement] = useState('cb') // 'cb' | 'especes'
  const [montantRecu, setMontantRecu]   = useState('')

  const [showRecap, setShowRecap]                   = useState(false)
  const [showConfirmVider, setShowConfirmVider]     = useState(false)
  const [showConfirmCloturer, setShowConfirmCloturer] = useState(false)
  const [toast, setToast] = useState('')

  // Scanner
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const videoRef    = useRef(null)
  const readerRef   = useRef(null)
  const produitRefs = useRef({})
  const loadedRef   = useRef(false)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data, error } = await supabase
        .from('produits')
        .select('id, code, designation, gamme, pr_vente, st_actuel')
        .order('designation')

      if (!error) {
        setProduits(data)
        try {
          const saved = localStorage.getItem(STORAGE_KEY_PANIER)
          if (saved) {
            const parsed = JSON.parse(saved)
            if (parsed.panier)       setPanier(parsed.panier)
            if (parsed.modePaiement) setModePaiement(parsed.modePaiement)
          }
        } catch {}

        // Fetch transactions du jour depuis Supabase
        const debutJour = new Date()
        debutJour.setHours(0, 0, 0, 0)
        const { data: txnData } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', debutJour.toISOString())
          .order('created_at')

        if (txnData) {
          setTransactions(txnData.map(t => ({
            id:       t.id,
            heure:    new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            produits: t.produits,
            total:    parseFloat(t.total),
            paiement: t.paiement,
          })))
        }
      }
      loadedRef.current = true
      setLoading(false)
    }
    init()
  }, [])

  // ── Persistance localStorage ───────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(STORAGE_KEY_PANIER, JSON.stringify({ panier, modePaiement }))
  }, [panier, modePaiement])

  // ── Toast auto-dismiss 2.5 s ───────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ── Scanner ZXing ──────────────────────────────────────────────────────────
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

          const code    = result.getText()
          const produit = produits.find(p => p.code === code)
          if (produit) {
            setRecherche('')
            setPanier(prev => ({ ...prev, [produit.id]: (prev[produit.id] ?? 0) + 1 }))
            setTimeout(() => {
              produitRefs.current[produit.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 80)
          } else {
            setToast('Produit non reconnu')
          }
        }
      ).catch(err => {
        console.error('[Scan Caisse] Caméra inaccessible :', err)
        if (!cancelled) setScannerOuvert(false)
      })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (readerRef.current) { readerRef.current.reset(); readerRef.current = null }
    }
  }, [scannerOuvert, produits])

  // ── Computed ───────────────────────────────────────────────────────────────
  const produitsFiltrés = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  const articlesEnPanier = useMemo(() =>
    produits.filter(p => (panier[p.id] ?? 0) > 0),
    [produits, panier]
  )

  const totalPanier = useMemo(() =>
    produits.reduce((sum, p) => sum + (panier[p.id] ?? 0) * p.pr_vente, 0),
    [produits, panier]
  )

  const caJour = useMemo(() =>
    transactions.reduce((sum, t) => sum + t.total, 0),
    [transactions]
  )

  const monnaie = useMemo(() => {
    const recu = parseFloat(montantRecu)
    return !isNaN(recu) && recu >= totalPanier ? (recu - totalPanier).toFixed(2) : null
  }, [montantRecu, totalPanier])

  // ── Actions ────────────────────────────────────────────────────────────────
  function changer(id, delta) {
    setPanier(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }))
  }

  async function validerVente() {
    if (articlesEnPanier.length === 0) return

    const produitsTxn = articlesEnPanier.map(p => ({
      id:           p.id,
      designation:  p.designation,
      quantite:     panier[p.id],
      prixUnitaire: p.pr_vente,
    }))
    const total = parseFloat(totalPanier.toFixed(2))

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({ produits: produitsTxn, total, paiement: modePaiement })
      .select()
      .single()

    if (error) {
      setToast('Erreur d\'enregistrement — réessayez')
      return
    }

    await Promise.all(articlesEnPanier.map(p =>
      supabase.from('produits').update({
        st_actuel: Math.max(0, p.st_actuel - panier[p.id])
      }).eq('id', p.id)
    ))

    const heure = new Date(inserted.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setTransactions(prev => [...prev, {
      id:       inserted.id,
      heure,
      produits: produitsTxn,
      total,
      paiement: modePaiement,
    }])

    setProduits(prev => prev.map(p => {
      const qte = panier[p.id]
      if (!qte) return p
      return { ...p, st_actuel: Math.max(0, p.st_actuel - qte) }
    }))

    setPanier({})
    setMontantRecu('')
    setToast('Vente enregistrée ✓')
  }

  async function supprimerTransaction(id) {
    await supabase.from('transactions').delete().eq('id', id)
    setTransactions(prev => prev.filter(t => t.id !== id))
  }

  function viderPanier() {
    setPanier({})
    setMontantRecu('')
    setShowConfirmVider(false)
  }

  function cloturerJournee() {
    setTransactions([])
    setPanier({})
    setMontantRecu('')
    setModePaiement('cb')
    localStorage.removeItem(STORAGE_KEY_PANIER)
    setShowConfirmCloturer(false)
    setShowRecap(false)
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  function genererPDF() {
    const doc = new jsPDF()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text("Panam'arket", 10, 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('224 rue de Belleville, 75020 Paris', 10, 22)
    doc.text(`Récapitulatif — ${todayFr}`, 10, 29)
    doc.line(10, 33, 200, 33)

    let y = 41
    transactions.forEach((t, idx) => {
      if (y > 250) { doc.addPage(); y = 15 }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(`${t.heure}  Vente #${idx + 1} — ${t.paiement === 'cb' ? 'CB' : 'Espèces'}`, 10, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      t.produits.forEach(p => {
        if (y > 265) { doc.addPage(); y = 15 }
        const label = p.designation.length > 40 ? p.designation.slice(0, 38) + '…' : p.designation
        doc.text(label, 14, y)
        doc.text(`x${p.quantite}`, 128, y)
        doc.text(`${p.prixUnitaire.toFixed(2)} €`, 145, y)
        doc.text(`${(p.quantite * p.prixUnitaire).toFixed(2)} €`, 178, y)
        y += 6
      })
      doc.setFont('helvetica', 'bold')
      doc.text(`Total : ${t.total.toFixed(2)} €`, 155, y)
      y += 10
    })

    doc.line(10, y, 200, y)
    y += 8
    doc.setFontSize(13)
    doc.text(`CA DE LA JOURNÉE : ${caJour.toFixed(2)} €`, 140, y)
    doc.save(`recap_caisse_${today}.pdf`)
  }

  // ── Email ──────────────────────────────────────────────────────────────────
  function envoyerEmail() {
    const lignes = transactions.map((t, i) => {
      const details = t.produits
        .map(p => `  ${p.designation} x${p.quantite} = ${(p.quantite * p.prixUnitaire).toFixed(2)} €`)
        .join('%0A')
      return `[${t.heure}] Vente #${i + 1} — ${t.paiement === 'cb' ? 'CB' : 'Espèces'}%0A${details}%0A  Total : ${t.total.toFixed(2)} €`
    }).join('%0A%0A')
    const corps = `Récapitulatif — ${todayFr}%0A%0A${lignes}%0A%0ACA total : ${caJour.toFixed(2)} €`
    window.location.href = `mailto:panamarket@gmail.com?subject=Caisse+${today}&body=${corps}`
  }

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-96">

      {/* ── TOAST ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-gray-800 text-white text-sm font-medium px-4 py-3 rounded-xl text-center shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Caisse</h1>
            <p className="text-xs text-gray-400 capitalize">{todayFr}</p>
          </div>
          <button
            onClick={() => setShowRecap(true)}
            className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-medium"
          >
            <ClipboardList size={15} />
            Récap du jour
            {transactions.length > 0 && (
              <span className="bg-[#1D9E75] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {transactions.length}
              </span>
            )}
          </button>
        </div>

        {/* Recherche + scanner */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un produit…"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#1D9E75]"
            />
          </div>
          <button
            onClick={() => setScannerOuvert(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium shrink-0 transition-colors ${
              scannerOuvert ? 'bg-gray-200 text-gray-600' : 'bg-[#1D9E75]/10 text-[#1D9E75]'
            }`}
          >
            <ScanLine size={16} />
            {scannerOuvert ? 'Fermer' : 'Scanner'}
          </button>
        </div>
      </header>

      {/* ── ZONE CAMÉRA ───────────────────────────────────────────────────────── */}
      {scannerOuvert && (
        <div className="bg-white border-b border-gray-100 px-4 pb-4">
          <div className="rounded-xl overflow-hidden border border-[#1D9E75]/30 bg-black">
            <video ref={videoRef} className="w-full" playsInline muted />
            <p className="text-center text-xs text-gray-400 py-2 bg-white border-t border-gray-100">
              Pointez la caméra vers le code-barres du produit
            </p>
          </div>
        </div>
      )}

      {/* ── LISTE PRODUITS ────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-2">
        {produitsFiltrés.length === 0 && (
          <p className="text-center text-gray-400 mt-16 text-sm">Aucun produit trouvé.</p>
        )}
        {produitsFiltrés.map(p => {
          const qte = panier[p.id] ?? 0
          return (
            <div
              key={p.id}
              ref={el => { produitRefs.current[p.id] = el }}
              className="bg-white rounded-xl border border-gray-100 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
                  <p className="text-xs text-gray-400">{p.gamme}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">{p.pr_vente.toFixed(2)} €/u</span>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => changer(p.id, -1)}
                    disabled={qte === 0}
                    className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-25 active:bg-gray-50"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-gray-800">{qte}</span>
                  <button
                    onClick={() => changer(p.id, +1)}
                    className="w-9 h-9 rounded-lg bg-[#1D9E75] flex items-center justify-center text-white active:opacity-80"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className={`text-sm font-semibold ${qte > 0 ? 'text-[#1D9E75]' : 'text-gray-200'}`}>
                  {(qte * p.pr_vente).toFixed(2)} €
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── BARRE BAS ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-4">

        {/* Toggle CB / Espèces */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setModePaiement('cb')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              modePaiement === 'cb' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            💳 CB
          </button>
          <button
            onClick={() => setModePaiement('especes')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              modePaiement === 'especes' ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            💵 Espèces
          </button>
        </div>

        {/* Champ montant reçu + monnaie (espèces uniquement) */}
        {modePaiement === 'especes' && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 shrink-0">Reçu</span>
            <input
              type="number"
              min={totalPanier}
              step="0.01"
              value={montantRecu}
              onChange={e => setMontantRecu(e.target.value)}
              placeholder={totalPanier.toFixed(2)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-right outline-none focus:border-[#1D9E75]"
            />
            {monnaie !== null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 leading-none mb-0.5">Monnaie</p>
                <p className="text-sm font-bold text-[#1D9E75]">{monnaie} €</p>
              </div>
            )}
          </div>
        )}

        {/* Articles + total panier */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            {articlesEnPanier.length} article{articlesEnPanier.length !== 1 ? 's' : ''} au panier
          </span>
          <span className="text-xl font-bold text-gray-800">{totalPanier.toFixed(2)} €</span>
        </div>

        {/* Valider la vente */}
        <button
          onClick={validerVente}
          disabled={articlesEnPanier.length === 0}
          className="w-full bg-[#1D9E75] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-30 active:opacity-80 mb-2"
        >
          Valider la vente →
        </button>

        {/* Vider le panier */}
        <button
          onClick={() => setShowConfirmVider(true)}
          disabled={articlesEnPanier.length === 0}
          className="w-full border border-red-200 text-red-400 py-2.5 rounded-xl text-sm font-medium disabled:opacity-30 active:bg-red-50"
        >
          Vider le panier
        </button>
      </div>

      {/* ── OVERLAY RÉCAP ─────────────────────────────────────────────────────── */}
      {showRecap && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) setShowRecap(false) }}
        >
          <div className="bg-white w-full max-h-[85vh] rounded-t-2xl flex flex-col">

            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Récap du jour</h2>
                <p className="text-xs text-gray-400 capitalize">{todayFr}</p>
              </div>
              <button onClick={() => setShowRecap(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Liste des transactions */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucune vente enregistrée aujourd'hui.</p>
              ) : (
                <>
                  {transactions.map((t, i) => (
                    <div key={t.id} className="bg-gray-50 rounded-xl overflow-hidden">

                      {/* En-tête de la transaction */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            Vente #{i + 1}
                            <span className="text-gray-400 font-normal"> · {t.heure}</span>
                          </p>
                          <p className="text-xs text-gray-400">
                            {t.paiement === 'cb' ? '💳 CB' : '💵 Espèces'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{t.total.toFixed(2)} €</span>
                          <button
                            onClick={() => supprimerTransaction(t.id)}
                            className="p-1.5 rounded-lg bg-red-50 text-red-400 active:bg-red-100"
                            aria-label="Supprimer cette transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Lignes produits */}
                      {t.produits.map((p, j) => (
                        <div
                          key={j}
                          className="flex items-center justify-between px-4 py-2 text-xs text-gray-600"
                        >
                          <span className="flex-1 truncate mr-2">{p.designation}</span>
                          <span className="shrink-0 tabular-nums">
                            x{p.quantite} × {p.prixUnitaire.toFixed(2)} € = {(p.quantite * p.prixUnitaire).toFixed(2)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* CA total journée */}
                  <div className="bg-[#1D9E75] text-white rounded-xl px-4 py-4 flex justify-between items-center">
                    <span className="text-sm font-semibold">CA de la journée</span>
                    <span className="text-xl font-bold">{caJour.toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="px-4 pb-6 pt-3 border-t border-gray-100 space-y-2 shrink-0">
              <button
                onClick={genererPDF}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <FileText size={18} />
                Générer ticket PDF
              </button>
              <button
                onClick={envoyerEmail}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <Mail size={18} />
                Envoyer par email
              </button>
              <button
                onClick={() => setShowConfirmCloturer(true)}
                className="w-full border border-red-200 text-red-500 py-3 rounded-xl text-sm font-semibold active:bg-red-50"
              >
                Clôturer la journée
              </button>
              <button
                onClick={() => setShowRecap(false)}
                className="w-full border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM : VIDER LE PANIER ─────────────────────────────────────────── */}
      {showConfirmVider && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Vider le panier ?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Les articles du panier en cours seront remis à zéro.
              Les ventes déjà enregistrées ne sont pas affectées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmVider(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={viderPanier}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                Vider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM : CLÔTURER LA JOURNÉE ─────────────────────────────────────── */}
      {showConfirmCloturer && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Clôturer la journée ?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Toutes les transactions et le CA seront remis à zéro.
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmCloturer(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={cloturerJournee}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                Clôturer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
