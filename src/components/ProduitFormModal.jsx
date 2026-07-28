import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ScanLine, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { GAMMES, FORM_VIDE, chercherProduitOFF } from '../lib/produits'
import { useBarcodeScanner } from '../lib/useBarcodeScanner'

export default function ProduitFormModal({ produit, onClose, onSaved }) {
  const [form, setForm]                   = useState(FORM_VIDE)
  const [saving, setSaving]               = useState(false)
  const [scannerOuvert, setScannerOuvert] = useState(false)
  const [offLoading, setOffLoading]       = useState(false)
  const [offMessage, setOffMessage]       = useState('')

  const videoRef  = useRef(null)

  // (Re)initialise le form à chaque ouverture / changement de produit.
  useEffect(() => {
    if (produit) {
      setForm({
        ...FORM_VIDE,
        ...produit.id ? {
          designation:      produit.designation,
          // Si la gamme BDD ne correspond à aucune entrée connue, on revient à la première.
          // Évite le cas où le <select> affiche visuellement la 1ʳᵉ option sans que
          // form.gamme ait réellement cette valeur (onChange ne se déclenche alors pas).
          gamme:            GAMMES.includes(produit.gamme) ? produit.gamme : '',
          st_actuel:        produit.st_actuel ?? '',
          st_min:           produit.st_min ?? '',
          pr_vente:         produit.pr_vente ?? '',
          pr_vente_especes: produit.pr_vente_especes ?? '',
        } : {},
        code: produit.code ?? '',
      })
    } else {
      setForm(FORM_VIDE)
    }
    setScannerOuvert(false)
    setOffMessage('')
    setTimeout(() => { document.getElementById('input-code-ean')?.focus() }, 100)
  }, [produit])

  useBarcodeScanner(videoRef, scannerOuvert, (code) => {
    setScannerOuvert(false)
    setForm(f => ({ ...f, code }))
    setOffMessage('')
    chercherSurOFF(code)
  }, (err) => {
    console.error('[Scan] Caméra inaccessible :', err)
    setScannerOuvert(false)
  })

  async function chercherSurOFF(code) {
    setOffLoading(true)
    setOffMessage('')
    try {
      const trouve = await chercherProduitOFF(code)
      if (trouve) {
        setForm(f => ({
          ...f,
          designation: trouve.designation || f.designation,
          gamme:       trouve.gamme,
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

    const { error } = produit?.id
      ? await supabase.from('produits').update(payload).eq('id', produit.id)
      : await supabase.from('produits').insert(payload)

    if (error) {
      console.error('[ProduitFormModal] Sauvegarde :', error.message)
      toast.error('Échec de la sauvegarde du produit')
    } else {
      toast.success(produit?.id ? 'Produit modifié' : 'Produit ajouté')
      await onSaved()
      onClose()
    }
    setSaving(false)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[55] bg-black/50 flex items-end sm:items-center sm:justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white w-full max-h-[92vh] rounded-t-3xl sm:rounded-3xl sm:max-w-md flex flex-col border-t-2 border-paname-700 sm:border-t-0">

        <div className="flex items-center justify-between px-4 py-4 border-b border-bitume/5 shrink-0">
          <h2 className="font-display font-bold text-lg text-bitume">
            {produit?.id ? 'Modifier le produit' : 'Ajouter un produit'}
          </h2>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-bitume/5 text-bitume flex items-center justify-center">
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
                className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 block">Gamme</label>
              <select
                value={form.gamme}
                onChange={e => setForm(f => ({ ...f, gamme: e.target.value }))}
                className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
              >
                <option value="" disabled>— Gamme —</option>
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
                  className="flex-1 bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setScannerOuvert(o => !o)}
                  className={`flex items-center gap-1.5 px-3 h-12 rounded-xl text-sm font-medium shrink-0 transition-colors ${
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
                  className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
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
                  className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
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
                className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
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
                className="w-full bg-transparent border-b-2 border-zinc-200 focus:border-paname-700 outline-none h-12 text-bitume text-sm transition-colors"
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
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-bitume/10 text-sm font-semibold text-bitume active:bg-bitume/5 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-14 rounded-xl bg-paname-700 text-white text-sm font-semibold shadow-paname disabled:opacity-50 active:bg-paname-900 transition"
            >
              {saving ? 'Sauvegarde…' : produit?.id ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>

        </form>
      </div>
    </div>
  , document.body)
}
