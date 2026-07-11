// Caisse PANAME OS — refonte dark mode (étape 4 migration)
//
// LOGIQUE PRÉSERVÉE :
// • State : produits, panier, transactions, recherche, loading, modePaiement,
//   montantRecu, showRecap, showConfirmVider, showConfirmCloturer, toast,
//   favoris (Set localStorage), sectionOuvertes (Set), scannerOuvert
// • Refs : videoRef, produitRefs, loadedRef
// • useEffects : init (load produits + panier localStorage + transactions du jour),
//   ouverture sections au 1er chargement, persist panier, toast auto-dismiss 2.5s,
//   scanner ZXing via useBarcodeScanner (src/lib/useBarcodeScanner.js)
// • Functions : toggleFavori, toggleSection, changer, validerVente,
//   supprimerTransaction, viderPanier, cloturerJournee, genererPDF, envoyerEmail
// • Sub-components : CarteProduit, SectionCategorie
//
// AJOUTÉ (purement décoratif, pas de logique métier) :
// • horloge (useState + useEffect setInterval 60s)

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Plus, Minus, FileText, Mail, X, AlertTriangle, ScanLine, Trash2, Printer } from 'lucide-react'
import ProduitFormModal from '../components/ProduitFormModal'
import { useAuth } from '../contexts/AuthContext'
import { bornesJourneeCommerciale, jourCommercial } from '../lib/journee'
import { genererRecapA4, genererRecapTicket80 } from '../lib/recapPdf'
import { agregerQuantites } from '../lib/agregats'
import { getStatut } from '../lib/produits'
import { useBarcodeScanner } from '../lib/useBarcodeScanner'

const today   = new Date().toLocaleDateString('en-CA')
const todayFr = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})
const STORAGE_KEY_PANIER = `caisse_${today}`

// "MODE SOIR" / "MODE JOUR" selon l'heure — purement cosmétique
const getMode = () => {
  const h = new Date().getHours()
  return h >= 17 || h < 6 ? 'MODE SOIR' : 'MODE JOUR'
}
const getHorloge = () =>
  new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// Prix appliqué selon le mode de paiement.
// pr_vente_especes nullable = pas de tarif espèces différencié → fallback prix CB.
const prixApplique = (p, mode) =>
  (mode === 'especes' && p.pr_vente_especes != null)
    ? p.pr_vente_especes
    : p.pr_vente

// ── Carte produit (mode browse) — version dark ─────────────────────────────
function CarteProduit({ p, qte, mode, onChanger, estFavori, onToggleFavori, innerRef }) {
  const prix = prixApplique(p, mode)
  const statut     = getStatut(p)
  const stockColor = statut === 'rupture' ? 'text-pavillon' : statut === 'faible' ? 'text-eiffel' : 'text-signal'
  return (
    <div
      ref={innerRef}
      className="relative bg-bitume-2 rounded-xl border border-white/5 px-3 py-2.5"
    >
      {/* Étoile favori — eiffel si épinglé, blanc dim sinon */}
      <button
        onClick={() => onToggleFavori(p.id)}
        className={`absolute top-1 right-1 text-sm leading-none transition-colors ${
          estFavori ? 'text-eiffel' : 'text-white/20 hover:text-white/40'
        }`}
        title={estFavori ? 'Retirer des favoris' : 'Épingler'}
      >
        {estFavori ? '★' : '☆'}
      </button>

      <div className="pr-5">
        <p className="text-sm font-medium text-white truncate">{p.designation}</p>
        <p className="font-mono text-[10px] text-zinc-500">
          {p.pr_vente_especes != null
            ? `${p.pr_vente.toFixed(2)} € CB · ${p.pr_vente_especes.toFixed(2)} € esp`
            : `${p.pr_vente.toFixed(2)} €/u`}
        </p>
        <p className={`font-mono text-[10px] mt-0.5 ${stockColor}`}>
          Stock : {p.st_actuel}
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChanger(-1)}
            disabled={qte === 0}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white disabled:opacity-25 active:bg-white/10"
          >
            <Minus size={14} />
          </button>
          <span className="font-display tabular w-5 text-center text-sm font-bold text-white">
            {qte}
          </span>
          <button
            onClick={() => onChanger(+1)}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-paname-700 to-paname-500 flex items-center justify-center text-white"
          >
            <Plus size={14} />
          </button>
        </div>
        <span className={`text-xs font-semibold tabular ${qte > 0 ? 'text-eiffel' : 'text-white/15'}`}>
          {(qte * prix).toFixed(2)} €
        </span>
      </div>
    </div>
  )
}

// ── Ligne panier (section PANIER en haut) — pleine largeur, plus large que carte
function LignePanier({ p, qte, mode, onChanger }) {
  const prix = prixApplique(p, mode)
  return (
    <div className="bg-bitume-2 rounded-2xl p-3 border border-white/5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm text-white truncate">{p.designation}</p>
        <p className="font-mono text-[10px] text-zinc-500 mt-0.5">
          {prix.toFixed(2)} €/u · TVA 20%
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onChanger(-1)}
          className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10"
          aria-label="Retirer un"
        >
          <Minus size={14} />
        </button>
        <span className="font-display tabular text-lg font-bold w-6 text-center text-white">
          {qte}
        </span>
        <button
          onClick={() => onChanger(+1)}
          className="w-8 h-8 rounded-lg bg-gradient-to-br from-paname-700 to-paname-500 text-white flex items-center justify-center"
          aria-label="Ajouter un"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Section dépliable par catégorie — version dark ─────────────────────────
function SectionCategorie({ titre, variant = 'default', produits, ouverte, onToggle, renderCarte }) {
  const headerCls =
    variant === 'favoris'
      ? 'bg-eiffel/10 border-eiffel/30 text-eiffel'
      : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'

  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-xl transition ${headerCls}`}
      >
        <span className="tag-street">
          {variant === 'favoris' && '★ '}
          {titre}
          <span className="ml-2 opacity-50">({produits.length})</span>
        </span>
        <span className={`text-xs transition-transform inline-block ${ouverte ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {ouverte && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {produits.map(renderCarte)}
        </div>
      )}
    </div>
  )
}

export default function Caisse() {
  const { role, user } = useAuth()
  const [produits, setProduits]         = useState([])
  const [panier, setPanier]             = useState({})
  const [transactions, setTransactions] = useState([])
  const [recherche, setRecherche]       = useState('')
  const [loading, setLoading]           = useState(true)
  const [modePaiement, setModePaiement] = useState('cb')
  const [montantRecu, setMontantRecu]   = useState('')

  const [showRecap, setShowRecap]                     = useState(false)
  const [showConfirmVider, setShowConfirmVider]       = useState(false)
  const [showConfirmCloturer, setShowConfirmCloturer] = useState(false)
  const [toast, setToast] = useState('')
  const [codeInconnu, setCodeInconnu]         = useState(null)
  const [modalAjoutOuvert, setModalAjoutOuvert] = useState(false)

  // Horloge — décorative uniquement (étape 4 PANAME OS)
  const [horloge, setHorloge] = useState(getHorloge)
  const [visible, setVisible] = useState(20)

  // Favoris persistés en localStorage (Set d'ids)
  const [favoris, setFavoris] = useState(() => {
    const saved = localStorage.getItem('caisse_favoris')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  // Sections dépliées — les gammes s'ajoutent automatiquement au premier chargement
  const [sectionOuvertes, setSectionOuvertes] = useState(() => new Set(['favoris']))

  // Scanner
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const videoRef    = useRef(null)
  const produitRefs = useRef({})
  const loadedRef   = useRef(false)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data, error } = await supabase
        .from('produits')
        .select('id, code, designation, gamme, pr_vente, pr_vente_especes, st_actuel, st_min')
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

        // Bornes de la journée commerciale (bascule 4h Paris) — cf. src/lib/journee.js
        // À 1h du matin, on charge encore les ventes de la "veille" calendaire.
        const { debut, fin } = bornesJourneeCommerciale()
        const { data: txnData } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', debut.toISOString())
          .lt('created_at', fin.toISOString())
          .order('created_at')

        if (txnData) {
          setTransactions(txnData.map(t => ({
            id:        t.id,
            heure:     new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            produits:  t.produits,
            total:     parseFloat(t.total),
            paiement:  t.paiement,
            operateur: t.operateur,
          })))
        }
      }
      loadedRef.current = true
      setLoading(false)
    }
    init()
  }, [])

  // Ouvrir toutes les sections au premier chargement des produits
  useEffect(() => {
    if (produits.length > 0 && sectionOuvertes.size <= 1) {
      const gammes = [...new Set(produits.map(p => p.gamme || 'Autre'))]
      setSectionOuvertes(new Set(['favoris', ...gammes]))
    }
  }, [produits])

  // ── Persistance localStorage panier ───────────────────────────────────────
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

  // ── Horloge (refresh chaque minute) — décoratif ────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setHorloge(getHorloge()), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { setVisible(20) }, [recherche])

  // ── Scanner ZXing ──────────────────────────────────────────────────────────
  useBarcodeScanner(videoRef, scannerOuvert, (code) => {
    setScannerOuvert(false)

    const produit = produits.find(p => p.code === code)
    if (produit) {
      setRecherche('')
      setPanier(prev => ({ ...prev, [produit.id]: (prev[produit.id] ?? 0) + 1 }))
      setTimeout(() => {
        produitRefs.current[produit.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    } else {
      setCodeInconnu(code)
    }
  }, (err) => {
    console.error('[Scan Caisse] Caméra inaccessible :', err)
    setScannerOuvert(false)
  })

  // ── Scanner USB HID (clavier) ─────────────────────────────────────────────
  // Un scanner USB envoie les caractères en < 80 ms puis un Enter.
  // On accumule un buffer local tant que les touches arrivent vite.
  // Si le focus est dans un INPUT/TEXTAREA on laisse passer la frappe normalement.
  useEffect(() => {
    let buffer  = ''
    let lastKey = 0

    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const now = Date.now()

      if (e.key === 'Enter') {
        if (buffer.length >= 6) {
          const produit = produits.find(p => p.code === buffer)
          if (produit) {
            setPanier(prev => ({ ...prev, [produit.id]: (prev[produit.id] ?? 0) + 1 }))
          } else {
            setCodeInconnu(buffer)
          }
        }
        buffer  = ''
        lastKey = 0
        return
      }

      if (e.key.length === 1) {
        if (buffer.length === 0 || (now - lastKey) < 80) {
          buffer  += e.key
          lastKey  = now
        } else {
          // Délai > 80 ms : frappe humaine, on repart d'un nouveau buffer
          buffer  = e.key
          lastKey = now
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [produits])

  // ── Computed ───────────────────────────────────────────────────────────────
  const produitsFiltrés = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  const gammes = useMemo(() =>
    [...new Set(produits.map(p => p.gamme || 'Autre'))].sort(),
    [produits]
  )

  const articlesEnPanier = useMemo(() =>
    produits.filter(p => (panier[p.id] ?? 0) > 0),
    [produits, panier]
  )

  const totalPanier = useMemo(() =>
    produits.reduce((sum, p) => sum + (panier[p.id] ?? 0) * prixApplique(p, modePaiement), 0),
    [produits, panier, modePaiement]
  )

  const caJour = useMemo(() =>
    transactions.reduce((sum, t) => sum + t.total, 0),
    [transactions]
  )

  // Index { produitId → gamme } reconstitué depuis le catalogue local.
  // La gamme n'est PAS stockée dans le JSONB des transactions, on la lit
  // donc depuis l'état `produits` déjà chargé au montage.
  const gammeParId = useMemo(
    () => Object.fromEntries(produits.map(p => [p.id, p.gamme || 'Autre'])),
    [produits]
  )

  const monnaie = useMemo(() => {
    const recu = parseFloat(montantRecu)
    return !isNaN(recu) && recu >= totalPanier ? (recu - totalPanier).toFixed(2) : null
  }, [montantRecu, totalPanier])

  // ── Favoris ────────────────────────────────────────────────────────────────
  function toggleFavori(id) {
    setFavoris(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem('caisse_favoris', JSON.stringify([...next]))
      return next
    })
  }

  function toggleSection(gamme) {
    setSectionOuvertes(prev => {
      const next = new Set(prev)
      next.has(gamme) ? next.delete(gamme) : next.add(gamme)
      return next
    })
  }

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
      prixUnitaire: prixApplique(p, modePaiement),
    }))
    const total = parseFloat(totalPanier.toFixed(2))

    // Opérateur de la vente : nom dans user_metadata si défini, sinon partie locale de l'email
    const operateur = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'inconnu'

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert({
        produits: produitsTxn,
        total,
        paiement: modePaiement,
        user_id:  user?.id,
        operateur,
      })
      .select()
      .single()

    if (error) {
      setToast('Erreur d\'enregistrement — réessayez')
      return
    }

    const resultatsStock = await Promise.all(articlesEnPanier.map(p =>
      supabase.from('produits').update({
        st_actuel: Math.max(0, p.st_actuel - panier[p.id])
      }).eq('id', p.id)
    ))
    // La vente est déjà enregistrée : on signale seulement l'échec du stock
    const stockKo = resultatsStock.some(r => r.error)

    const heure = new Date(inserted.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    setTransactions(prev => [...prev, {
      id:       inserted.id,
      heure,
      produits: produitsTxn,
      total,
      paiement: modePaiement,
      operateur,
    }])

    setProduits(prev => prev.map(p => {
      const qte = panier[p.id]
      if (!qte) return p
      return { ...p, st_actuel: Math.max(0, p.st_actuel - qte) }
    }))

    setPanier({})
    setMontantRecu('')
    setToast(stockKo ? 'Vente enregistrée — échec de mise à jour du stock' : 'Vente enregistrée ✓')
  }

  async function supprimerTransaction(id) {
    const txn = transactions.find(t => t.id === id)
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      setToast('Erreur — transaction non supprimée')
      return
    }

    // La vente annulée rend son stock. On ignore les produits supprimés du
    // catalogue depuis la vente (leur id n'existe plus dans `produits`).
    const lignesConnues = (txn?.produits ?? []).filter(ligne =>
      produits.some(p => p.id === ligne.id)
    )
    const resultats = await Promise.all(lignesConnues.map(ligne => {
      const produit = produits.find(p => p.id === ligne.id)
      return supabase.from('produits')
        .update({ st_actuel: produit.st_actuel + ligne.quantite })
        .eq('id', ligne.id)
    }))

    setProduits(prev => prev.map(p => {
      const ligne = lignesConnues.find(l => l.id === p.id)
      return ligne ? { ...p, st_actuel: p.st_actuel + ligne.quantite } : p
    }))
    setTransactions(prev => prev.filter(t => t.id !== id))
    setToast(resultats.some(r => r.error)
      ? 'Transaction supprimée — échec de restauration du stock'
      : 'Transaction supprimée, stock restauré ✓')
  }

  async function onProduitAjoute() {
    const { data, error } = await supabase
      .from('produits')
      .select('id, code, designation, gamme, pr_vente, pr_vente_especes, st_actuel, st_min')
      .order('designation')
    if (error) return
    setProduits(data)
    const nouveau = data.find(p => p.code === codeInconnu)
    if (nouveau) {
      setPanier(prev => ({ ...prev, [nouveau.id]: (prev[nouveau.id] ?? 0) + 1 }))
      setToast('Produit créé et ajouté au panier ✓')
    }
    setModalAjoutOuvert(false)
    setCodeInconnu(null)
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

  // ── PDF : délégué à src/lib/recapPdf.js (partagé avec la page Historique) ──
  // fileLabel = jour commercial 'YYYY-MM-DD' pour rester cohérent même si on
  // imprime à 1h du matin (la vente du 24/06 à 01:30 produit un fichier ..._2026-06-24)
  function genererPDF() {
    const agregats = agregerQuantites(transactions, gammeParId)
    genererRecapA4(transactions, {
      dateFr:    todayFr,
      caJour,
      fileLabel: jourCommercial(),
      agregats,
    })
  }

  function genererRecapTicket() {
    const agregats = agregerQuantites(transactions, gammeParId)
    genererRecapTicket80(transactions, {
      dateFr:    todayFr,
      caJour,
      fileLabel: jourCommercial(),
      agregats,
    })
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

  // ── Helper de rendu — carte liée aux états du panier et des favoris ────────
  const renderCarte = (p) => (
    <CarteProduit
      key={p.id}
      p={p}
      qte={panier[p.id] ?? 0}
      mode={modePaiement}
      onChanger={(delta) => changer(p.id, delta)}
      estFavori={favoris.has(p.id)}
      onToggleFavori={toggleFavori}
      innerRef={(el) => { produitRefs.current[p.id] = el }}
    />
  )

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="-mx-4 -mt-4 md:-mt-6 bg-bitume min-h-[100dvh] flex items-center justify-center">
        <p className="tag-street text-eiffel">CHARGEMENT…</p>
      </div>
    )
  }

  const rechercheActive = recherche.trim() !== ''

  return (
    // -mx-4 -mt-4 md:-mt-6 : casse le padding d'AppShell pour s'étendre full bg-bitume
    <div className="-mx-4 -mt-4 md:-mt-6 bg-bitume text-white min-h-[100dvh]">

      {/* ── TOAST ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[60] bg-eiffel text-yellow-950 font-bold tag-street px-4 py-3 rounded-2xl text-center shadow-or pointer-events-none">
          {toast}
        </div>
      )}

      {/* Padding intérieur — pb-[280px] réserve l'espace pour le footer sticky */}
      <div className="px-4 pt-4 md:pt-6 pb-[280px]">

        {/* ── HEADER : mode + horloge + RÉCAP ─────────────────────────────────── */}
        <header className="flex items-center justify-between mb-5">
          <div>
            <p className="tag-street text-eiffel">CAISSE · {getMode()}</p>
            <p className="font-display text-3xl font-bold text-white tabular leading-none mt-1">
              {horloge}
            </p>
          </div>
          <button
            onClick={() => setShowRecap(true)}
            className="bg-eiffel text-yellow-950 px-3 py-2 rounded-xl tag-street flex items-center gap-2 shadow-or"
          >
            <span>📊 RÉCAP</span>
            {transactions.length > 0 && (
              <span className="bg-yellow-950 text-eiffel px-1.5 py-0.5 rounded-md text-[10px] tabular leading-none">
                {transactions.length}
              </span>
            )}
          </button>
        </header>

        {/* ── SEARCH + SCAN ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Rechercher un produit…"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-zinc-500 outline-none focus:border-paname-500 transition-colors"
            />
          </div>
          <button
            onClick={() => setScannerOuvert(o => !o)}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-paname-700 to-paname-500 shadow-paname text-white flex items-center justify-center shrink-0"
            aria-label={scannerOuvert ? 'Fermer le scanner' : 'Scanner un produit'}
          >
            {scannerOuvert ? <X size={20} /> : <ScanLine size={20} />}
          </button>
        </div>

        {/* ── ZONE CAMÉRA ─────────────────────────────────────────────────────── */}
        {scannerOuvert && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
            <video ref={videoRef} className="w-full" playsInline muted />
            <p className="text-center font-mono text-[10px] text-zinc-400 py-2 bg-bitume-2 border-t border-white/10">
              Pointez la caméra vers le code-barres
            </p>
          </div>
        )}

        {/* ── PANIER (lignes pleine largeur) — visible si articles en cours ───── */}
        {articlesEnPanier.length > 0 && (
          <section className="mb-5">
            <p className="tag-street text-zinc-500 mb-2">
              PANIER · {articlesEnPanier.length} ARTICLE{articlesEnPanier.length !== 1 ? 'S' : ''}
            </p>
            <div className="space-y-2">
              {articlesEnPanier.map(p => (
                <LignePanier
                  key={p.id}
                  p={p}
                  qte={panier[p.id]}
                  mode={modePaiement}
                  onChanger={(delta) => changer(p.id, delta)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── BROWSE PRODUITS ─────────────────────────────────────────────────── */}
        {/* Mode recherche — liste plate (comportement original) */}
        {rechercheActive && (
          <div>
            <p className="tag-street text-zinc-500 mb-2">RÉSULTATS · {produitsFiltrés.length}</p>
            <div className="grid grid-cols-2 gap-2">
              {produitsFiltrés.length === 0 ? (
                <p className="col-span-2 text-center text-zinc-500 mt-8 text-sm">
                  Aucun produit trouvé.
                </p>
              ) : (
                produitsFiltrés.slice(0, visible).map(renderCarte)
              )}
            </div>
            {visible < produitsFiltrés.length && (
              <button
                onClick={() => setVisible(v => v + 20)}
                className="w-full py-3 mt-2 rounded-2xl border border-bitume/10 tag-street text-zinc-500"
              >
                VOIR PLUS · {produitsFiltrés.length - visible} restants
              </button>
            )}
          </div>
        )}

        {/* Mode catégories — sections dépliables */}
        {!rechercheActive && (
          <>
            <p className="tag-street text-zinc-500 mb-2">CATALOGUE</p>

            {/* Section Favoris — visible uniquement si au moins un produit épinglé */}
            {favoris.size > 0 && (
              <SectionCategorie
                titre="FAVORIS"
                variant="favoris"
                ouverte={sectionOuvertes.has('favoris')}
                onToggle={() => toggleSection('favoris')}
                produits={produits.filter(p => favoris.has(p.id))}
                renderCarte={renderCarte}
              />
            )}

            {/* Une section par gamme */}
            {gammes.map((gamme) => (
              <SectionCategorie
                key={gamme}
                titre={gamme.toUpperCase()}
                ouverte={sectionOuvertes.has(gamme)}
                onToggle={() => toggleSection(gamme)}
                produits={produits.filter(p => (p.gamme || 'Autre') === gamme)}
                renderCarte={renderCarte}
              />
            ))}
          </>
        )}
      </div>

      {/* ── FOOTER STICKY ────────────────────────────────────────────────────────
          fixed + bottom calc(64px + safe-area) pour passer au-dessus de la BottomNav.
          md:!bottom-0 force bottom=0 sur desktop (pas de BottomNav, !important bat le inline style). */}
      <div
        className="fixed left-0 right-0 md:left-60 md:!bottom-0 z-30 bg-bitume-2 border-t-2 border-eiffel px-4 pt-3 pb-3"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        {/* Total */}
        <div className="flex items-baseline justify-between mb-3">
          <span className="tag-street text-zinc-500">TOTAL</span>
          <span className="font-display text-4xl font-bold tabular text-white leading-none">
            {totalPanier.toFixed(2)}
            <span className="text-eiffel ml-1">€</span>
          </span>
        </div>

        {/* CB / Espèces */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => setModePaiement('cb')}
            className={`flex-1 py-2.5 rounded-xl tag-street transition ${
              modePaiement === 'cb'
                ? 'bg-gradient-to-br from-paname-700 to-paname-500 text-white shadow-paname'
                : 'bg-white/5 border border-white/10 text-white/60'
            }`}
          >
            💳 CB
          </button>
          <button
            onClick={() => setModePaiement('especes')}
            className={`flex-1 py-2.5 rounded-xl tag-street transition ${
              modePaiement === 'especes'
                ? 'bg-gradient-to-br from-paname-700 to-paname-500 text-white shadow-paname'
                : 'bg-white/5 border border-white/10 text-white/60'
            }`}
          >
            💵 ESPÈCES
          </button>
        </div>

        {/* Reçu — espèces uniquement */}
        {modePaiement === 'especes' && (
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] text-zinc-400 shrink-0">REÇU</span>
            <input
              type="number"
              min={totalPanier}
              step="0.01"
              value={montantRecu}
              onChange={e => setMontantRecu(e.target.value)}
              placeholder={totalPanier.toFixed(2)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-right outline-none focus:border-paname-500 placeholder:text-zinc-500 tabular"
            />
            {monnaie !== null && (
              <div className="text-right shrink-0">
                <p className="font-mono text-[10px] text-zinc-400 leading-none">MONNAIE</p>
                <p className="text-sm font-bold text-eiffel tabular">{monnaie} €</p>
              </div>
            )}
          </div>
        )}

        {/* Valider */}
        <button
          onClick={validerVente}
          disabled={articlesEnPanier.length === 0}
          className="w-full py-3.5 rounded-2xl bg-eiffel text-yellow-950 font-bold tag-street shadow-or disabled:opacity-30 transition"
        >
          VALIDER LA VENTE →
        </button>

        {/* Vider */}
        <button
          onClick={() => setShowConfirmVider(true)}
          disabled={articlesEnPanier.length === 0}
          className="w-full mt-1.5 py-2 rounded-xl border border-pavillon/40 text-pavillon font-medium text-xs disabled:opacity-30 hover:bg-pavillon/10 transition"
        >
          Vider le panier
        </button>
      </div>

      {/* ── OVERLAY RÉCAP (bottom sheet dark) ───────────────────────────────── */}
      {showRecap && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) setShowRecap(false) }}
        >
          <div
            className="bg-bitume-2 w-full max-h-[85vh] rounded-t-3xl flex flex-col border-t-2 border-eiffel md:ml-60"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 shrink-0">
              <div>
                <p className="tag-street text-eiffel">RÉCAP DU JOUR</p>
                <p className="font-mono text-[10px] text-zinc-400 capitalize mt-0.5">{todayFr}</p>
              </div>
              <button
                onClick={() => setShowRecap(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-center text-zinc-500 py-12 tag-street">
                  AUCUNE VENTE AUJOURD'HUI
                </p>
              ) : (
                <>
                  {transactions.map((t, i) => (
                    <div key={t.id} className="bg-bitume-3 rounded-2xl border border-white/5 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                        <div>
                          <p className="font-display font-bold text-sm text-white">
                            Vente #{i + 1}
                            <span className="text-zinc-500 font-normal font-mono text-[10px] ml-2">{t.heure}</span>
                          </p>
                          <p className="font-mono text-[10px] text-zinc-400">
                            {t.paiement === 'cb' ? '💳 CB' : '💵 Espèces'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display tabular text-base font-bold text-white">
                            {t.total.toFixed(2)} €
                          </span>
                          {role === 'gerant' && (
                            <button
                              onClick={() => supprimerTransaction(t.id)}
                              className="p-1.5 rounded-lg bg-pavillon/20 text-pavillon hover:bg-pavillon/30"
                              aria-label="Supprimer cette transaction"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      {t.produits.map((p, j) => (
                        <div key={j} className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400">
                          <span className="flex-1 truncate mr-2">{p.designation}</span>
                          <span className="shrink-0 font-mono tabular">
                            x{p.quantite} × {p.prixUnitaire.toFixed(2)} € = {(p.quantite * p.prixUnitaire).toFixed(2)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* CA bandeau gradient paname */}
                  <div className="bg-gradient-to-r from-paname-700 to-paname-500 rounded-2xl px-4 py-4 flex justify-between items-center shadow-paname">
                    <span className="tag-street text-white/80">CA DE LA JOURNÉE</span>
                    <span className="font-display text-3xl font-bold tabular text-white">
                      {caJour.toFixed(2)}
                      <span className="text-eiffel ml-1">€</span>
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 pt-3 pb-4 border-t border-white/10 space-y-2 shrink-0">
              <button
                onClick={genererRecapTicket}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-30 hover:bg-white/10 transition"
              >
                <Printer size={18} />
                Ticket caisse 80mm
              </button>
              <button
                onClick={genererPDF}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-30 hover:bg-white/10 transition"
              >
                <FileText size={18} />
                Générer ticket PDF
              </button>
              <button
                onClick={envoyerEmail}
                disabled={transactions.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-paname-700 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-30 hover:bg-paname-900 transition shadow-paname"
              >
                <Mail size={18} />
                Envoyer par email
              </button>
              <button
                onClick={() => setShowConfirmCloturer(true)}
                className="w-full border border-pavillon/40 text-pavillon py-3 rounded-xl text-sm font-semibold hover:bg-pavillon/10 transition"
              >
                Clôturer la journée
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUIT INCONNU — dialog de proposition ──────────────────────────── */}
      {codeInconnu && !modalAjoutOuvert && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6">
          <div className="bg-bitume-2 border border-white/10 rounded-3xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-eiffel/20 flex items-center justify-center shrink-0">
                <ScanLine size={20} className="text-eiffel" />
              </div>
              <h2 className="font-display font-bold text-base text-white">Produit inconnu</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-1">
              Code scanné :
            </p>
            <p className="font-mono text-sm text-eiffel mb-6">{codeInconnu}</p>
            <p className="text-sm text-zinc-400 mb-6">
              Ce code-barres ne correspond à aucun produit du catalogue.
              Voulez-vous l'ajouter maintenant ?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCodeInconnu(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Ignorer
              </button>
              <button
                onClick={() => setModalAjoutOuvert(true)}
                className="flex-1 py-3 rounded-xl bg-eiffel text-yellow-950 text-sm font-semibold shadow-or"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AJOUT PRODUIT (depuis scan inconnu) ────────────────────────── */}
      {modalAjoutOuvert && (
        <ProduitFormModal
          produit={{ code: codeInconnu }}
          onClose={() => { setModalAjoutOuvert(false); setCodeInconnu(null) }}
          onSaved={onProduitAjoute}
        />
      )}

      {/* ── CONFIRM : VIDER LE PANIER ─────────────────────────────────────────── */}
      {showConfirmVider && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6">
          <div className="bg-bitume-2 border border-white/10 rounded-3xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-pavillon/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-pavillon" />
              </div>
              <h2 className="font-display font-bold text-base text-white">Vider le panier ?</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              Les articles du panier en cours seront remis à zéro.
              Les ventes déjà enregistrées ne sont pas affectées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmVider(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Annuler
              </button>
              <button
                onClick={viderPanier}
                className="flex-1 py-3 rounded-xl bg-pavillon text-white text-sm font-semibold shadow-rouge"
              >
                Vider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM : CLÔTURER LA JOURNÉE ─────────────────────────────────────── */}
      {showConfirmCloturer && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-6">
          <div className="bg-bitume-2 border border-white/10 rounded-3xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-pavillon/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-pavillon" />
              </div>
              <h2 className="font-display font-bold text-base text-white">Clôturer la journée ?</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-6">
              L'affichage de la journée repart à zéro et le panier est vidé.
              Les ventes restent enregistrées dans l'historique.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmCloturer(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition"
              >
                Annuler
              </button>
              <button
                onClick={cloturerJournee}
                className="flex-1 py-3 rounded-xl bg-pavillon text-white text-sm font-semibold shadow-rouge"
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
