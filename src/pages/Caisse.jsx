import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { Search, Plus, Minus, FileText, Mail, ClipboardList, X, AlertTriangle } from 'lucide-react'

const today   = new Date().toISOString().slice(0, 10)
const todayFr = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})
const STORAGE_KEY = `caisse_${today}`

export default function Caisse() {
  const [produits, setProduits]       = useState([])
  const [quantites, setQuantites]     = useState({})
  const [recherche, setRecherche]     = useState('')
  const [loading, setLoading]         = useState(true)
  const [showRecap, setShowRecap]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Évite d'écraser la restauration initiale avec un save à {} avant que les données soient chargées
  const loadedRef = useRef(false)

  useEffect(() => {
    async function init() {
      const { data, error } = await supabase
        .from('produits')
        .select('id, designation, gamme, pr_vente')
        .order('designation')

      if (!error) {
        setProduits(data)
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const { quantites: savedQtes } = JSON.parse(saved)
            if (savedQtes) setQuantites(savedQtes)
          }
        } catch {}
      }
      loadedRef.current = true
      setLoading(false)
    }
    init()
  }, [])

  // Sauvegarde en temps réel à chaque changement de quantité
  useEffect(() => {
    if (!loadedRef.current) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, quantites }))
  }, [quantites])

  const produitsFiltrés = useMemo(() =>
    produits.filter(p =>
      p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
    ),
    [produits, recherche]
  )

  const vendus = useMemo(() =>
    produits.filter(p => (quantites[p.id] ?? 0) > 0),
    [produits, quantites]
  )

  const total = useMemo(() =>
    produits.reduce((sum, p) => sum + (quantites[p.id] ?? 0) * p.pr_vente, 0),
    [produits, quantites]
  )

  function changer(id, delta) {
    setQuantites(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }))
  }

  function réinitialiser() {
    setQuantites({})
    localStorage.removeItem(STORAGE_KEY)
    setShowConfirm(false)
  }

  function genererPDF() {
    const doc = new jsPDF()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text("Panam'arket", 10, 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('224 rue de Belleville, 75020 Paris', 10, 22)
    doc.text(`Ticket de caisse — ${todayFr}`, 10, 29)
    doc.line(10, 33, 200, 33)

    let y = 41
    doc.setFont('helvetica', 'bold')
    doc.text('Produit', 10, y)
    doc.text('Qté', 130, y)
    doc.text('P.U.', 150, y)
    doc.text('Total', 178, y)
    doc.setFont('helvetica', 'normal')
    doc.line(10, y + 3, 200, y + 3)
    y += 10

    vendus.forEach(p => {
      const qte = quantites[p.id]
      const label = p.designation.length > 50 ? p.designation.slice(0, 48) + '…' : p.designation
      doc.text(label, 10, y)
      doc.text(String(qte), 133, y)
      doc.text(`${p.pr_vente.toFixed(2)} €`, 152, y)
      doc.text(`${(qte * p.pr_vente).toFixed(2)} €`, 178, y)
      y += 7
      if (y > 270) { doc.addPage(); y = 15 }
    })

    doc.line(10, y, 200, y)
    y += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`TOTAL : ${total.toFixed(2)} €`, 140, y)
    doc.save(`ticket_${today}.pdf`)
  }

  function envoyerEmail() {
    const lignes = vendus
      .map(p => `${p.designation} x${quantites[p.id]} = ${(quantites[p.id] * p.pr_vente).toFixed(2)} €`)
      .join('%0A')
    const corps = `Ticket de caisse — ${todayFr}%0A%0A${lignes}%0A%0ATOTAL : ${total.toFixed(2)} €`
    window.location.href =
      `mailto:panamarket@gmail.com?subject=Ticket+caisse+${today}&body=${corps}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Chargement…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-36">

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
            {vendus.length > 0 && (
              <span className="bg-[#1D9E75] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {vendus.length}
              </span>
            )}
          </button>
        </div>

        <div className="relative mt-3">
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

      {/* ── LISTE PRODUITS ────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-2">
        {produitsFiltrés.length === 0 && (
          <p className="text-center text-gray-400 mt-16 text-sm">Aucun produit trouvé.</p>
        )}

        {produitsFiltrés.map(p => {
          const qte = quantites[p.id] ?? 0
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
                  <p className="text-xs text-gray-400">{p.gamme}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                  {p.pr_vente.toFixed(2)} €/u
                </span>
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

      {/* ── BARRE BAS : total + réinitialiser ────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">
            {vendus.length} article{vendus.length !== 1 ? 's' : ''} vendu{vendus.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xl font-bold text-gray-800">{total.toFixed(2)} €</span>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={vendus.length === 0}
          className="w-full border border-red-200 text-red-500 py-3 rounded-xl text-sm font-semibold disabled:opacity-30 active:bg-red-50"
        >
          Réinitialiser la journée
        </button>
      </div>

      {/* ── OVERLAY RÉCAP (bottom sheet) ──────────────────────────────────────── */}
      {showRecap && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) setShowRecap(false) }}
        >
          <div className="bg-white w-full max-h-[80vh] rounded-t-2xl flex flex-col">

            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Récap du jour</h2>
                <p className="text-xs text-gray-400 capitalize">{todayFr}</p>
              </div>
              <button
                onClick={() => setShowRecap(false)}
                className="p-2 rounded-xl bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* liste scrollable */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {vendus.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Aucune vente enregistrée.</p>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl overflow-hidden">
                    {vendus.map((p, i) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i !== vendus.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.designation}</p>
                          <p className="text-xs text-gray-400">
                            x{quantites[p.id]} × {p.pr_vente.toFixed(2)} €
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 shrink-0">
                          {(quantites[p.id] * p.pr_vente).toFixed(2)} €
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#1D9E75] text-white rounded-xl px-4 py-4 flex justify-between items-center">
                    <span className="text-sm font-semibold">CA de la journée</span>
                    <span className="text-xl font-bold">{total.toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 pb-6 pt-3 border-t border-gray-100 space-y-2 shrink-0">
              <button
                onClick={genererPDF}
                disabled={vendus.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <FileText size={18} />
                Générer ticket PDF
              </button>
              <button
                onClick={envoyerEmail}
                disabled={vendus.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
              >
                <Mail size={18} />
                Envoyer par email
              </button>
              <button
                onClick={() => setShowRecap(false)}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DIALOG CONFIRMATION RÉINITIALISATION ──────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-800">Réinitialiser la journée ?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Toutes les quantités seront remises à zéro. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={réinitialiser}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
