import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Upload } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import ProduitFormModal from '../components/ProduitFormModal'
import { GAMMES } from '../lib/produits'

// Calcul du badge DLC : couleur + préfixe selon l'urgence (cf. ancien Catalogue)
function badgeDLC(dlcIso) {
  if (!dlcIso) return null
  const [yyyy, mm, dd] = dlcIso.split('-')
  const label = `${dd}/${mm}/${yyyy}`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dlcDate = new Date(dlcIso); dlcDate.setHours(0, 0, 0, 0)
  const jours = Math.ceil((dlcDate - today) / 86400000)
  if (jours < 3)  return { label, cls: 'text-pavillon', prefix: '⚠ DLC : ' }
  if (jours < 14) return { label, cls: 'text-eiffel',   prefix: '🕐 DLC : ' }
  return              { label, cls: 'text-zinc-400',  prefix: 'DLC : ' }
}

export default function Catalogue() {
  const { role, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [produits, setProduits]           = useState([])
  const [dlcParProduit, setDlcParProduit] = useState({})
  const [loading, setLoading]             = useState(true)

  const [recherche, setRecherche]       = useState('')
  const [gammeFiltre, setGammeFiltre]   = useState('')   // '' = toutes
  const [statutFiltre, setStatutFiltre] = useState('tous')

  const [modalOuvert, setModalOuvert]       = useState(false)
  const [produitEnCours, setProduitEnCours] = useState(null)

  const [confirmSupp, setConfirmSupp] = useState(null)
  const [visible, setVisible]         = useState(20)

  // 3 niveaux de rôle : employé voit en lecture seule, manager peut éditer,
  // seul le gérant accède à l'import (qui mène au Dashboard, gérant-only)
  const peutModifier = role === 'manager' || role === 'gerant'
  const peutImporter = role === 'gerant'

  useEffect(() => { fetchProduits() }, [])

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

    // Pour chaque produit : on garde l'entrée DLC la plus proche, en ignorant les entrées sans DLC.
    const map = {}
    dlcData?.forEach(entry => {
      if (!entry.dlc) return
      const existing = map[entry.produit_id]
      if (!existing || entry.dlc < existing.dlc) map[entry.produit_id] = entry
    })
    setDlcParProduit(map)
    setLoading(false)
  }

  function fermerModal() { setModalOuvert(false) }
  function ouvrirAjout()  { setProduitEnCours(null); setModalOuvert(true) }
  function ouvrirModif(p) { setProduitEnCours(p);    setModalOuvert(true) }

  async function supprimer(id) {
    const { error } = await supabase.from('produits').delete().eq('id', id)
    if (error) {
      console.error('[Catalogue] Suppression :', error.message)
      toast.error('Échec de la suppression')
      return
    }
    toast.success('Produit supprimé')
    setProduits(prev => prev.filter(p => p.id !== id))
    setConfirmSupp(null)
  }

  // Compteurs basés sur la liste complète (indépendants de la recherche et des filtres)
  const nbRuptures = produits.filter(p => p.st_actuel === 0).length
  const nbFaibles  = produits.filter(p => p.st_actuel > 0 && p.st_actuel < p.st_min).length
  const nbOk       = produits.filter(p => p.st_actuel >= p.st_min).length

  // Reset de la pagination dès qu'un filtre bouge — sinon "voir plus" peut afficher 0
  useEffect(() => { setVisible(20) }, [recherche, gammeFiltre, statutFiltre])

  const produitsFiltres = useMemo(() => {
    return produits.filter(p => {
      const matchTexte = p.designation.toLowerCase().includes(recherche.toLowerCase().trim())
      const matchGamme = !gammeFiltre || p.gamme === gammeFiltre
      const statut = p.st_actuel === 0 ? 'rupture' : p.st_actuel < p.st_min ? 'faible' : 'ok'
      const matchStatut = statutFiltre === 'tous' || statut === statutFiltre
      return matchTexte && matchGamme && matchStatut
    })
  }, [produits, recherche, gammeFiltre, statutFiltre])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="tag-street text-eiffel">CHARGEMENT…</p>
      </div>
    )
  }

  // Classes communes pour les pastilles (statut + gamme)
  const pillBase = 'tag-street px-3 py-2 rounded-xl border whitespace-nowrap transition'
  const pillInactive = 'bg-white text-zinc-500 border-bitume/10'

  return (
    <div className="pb-20">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <p className="font-display text-3xl font-bold text-bitume">Catalogue</p>
        <div className="flex gap-2 pt-1 shrink-0">
          {peutImporter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5"
            >
              <Upload size={14} />
              IMPORT
            </Button>
          )}
          {peutModifier && (
            <Button
              variant="primary"
              size="sm"
              onClick={ouvrirAjout}
              className="flex items-center gap-1.5"
            >
              <Plus size={14} />
              NOUVEAU
            </Button>
          )}
        </div>
      </div>

      {/* ── BARRE DE RECHERCHE ─────────────────────────────────────────────── */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Rechercher un produit…"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-bitume/10 rounded-2xl text-sm outline-none focus:border-paname-700 transition-colors"
        />
      </div>

      {/* ── PASTILLES STATUT (ligne 1) ─────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-2 scrollbar-hide">
        <button
          onClick={() => setStatutFiltre('tous')}
          className={`${pillBase} ${
            statutFiltre === 'tous' ? 'bg-bitume text-white border-bitume' : pillInactive
          }`}
        >
          TOUS
        </button>
        <button
          onClick={() => setStatutFiltre('rupture')}
          className={`${pillBase} ${
            statutFiltre === 'rupture' ? 'bg-pavillon text-white border-pavillon shadow-rouge' : pillInactive
          }`}
        >
          RUPTURES {nbRuptures > 0 && `· ${nbRuptures}`}
        </button>
        <button
          onClick={() => setStatutFiltre('faible')}
          className={`${pillBase} ${
            statutFiltre === 'faible' ? 'bg-eiffel text-yellow-950 border-eiffel shadow-or' : pillInactive
          }`}
        >
          INSUFF. {nbFaibles > 0 && `· ${nbFaibles}`}
        </button>
        <button
          onClick={() => setStatutFiltre('ok')}
          className={`${pillBase} ${
            statutFiltre === 'ok' ? 'bg-signal text-white border-signal' : pillInactive
          }`}
        >
          EN STOCK {nbOk > 0 && `· ${nbOk}`}
        </button>
      </div>

      {/* ── PASTILLES GAMME (ligne 2) ──────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
        <button
          onClick={() => setGammeFiltre('')}
          className={`${pillBase} ${
            gammeFiltre === '' ? 'bg-bitume text-white border-bitume' : pillInactive
          }`}
        >
          TOUTES
        </button>
        {GAMMES.map(g => (
          <button
            key={g}
            onClick={() => setGammeFiltre(g)}
            className={`${pillBase} ${
              gammeFiltre === g ? 'bg-bitume text-white border-bitume' : pillInactive
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* ── TOTAL ──────────────────────────────────────────────────────────── */}
      <p className="font-mono text-[11px] text-zinc-400 mb-4">
        {produits.length} produits
      </p>

      {/* ── TABLE DESKTOP (md+) ────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="bg-white rounded-2xl border border-bitume/5 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="bg-calcaire border-b border-bitume/5">
                <th className="tag-street text-zinc-500 text-left px-4 py-3 font-normal">Produit</th>
                <th className="tag-street text-zinc-500 text-left px-4 py-3 font-normal">Code-barres</th>
                <th className="tag-street text-zinc-500 text-left px-4 py-3 font-normal">Gamme</th>
                <th className="tag-street text-zinc-500 text-right px-4 py-3 font-normal">Stock</th>
                <th className="tag-street text-zinc-500 text-right px-4 py-3 font-normal">Prix</th>
                <th className="tag-street text-zinc-500 text-center px-4 py-3 font-normal">Statut</th>
                {peutModifier && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody>
              {produitsFiltres.length === 0 && (
                <tr>
                  <td colSpan={peutModifier ? 7 : 6} className="px-4 py-16 text-center">
                    <p className="text-3xl mb-2">📦</p>
                    <p className="tag-street text-zinc-400 mb-1">AUCUN PRODUIT</p>
                    <p className="font-mono text-[10px] text-zinc-400">
                      Modifie les filtres ou ajoute un produit
                    </p>
                  </td>
                </tr>
              )}
              {produitsFiltres.slice(0, visible).map(p => {
                const statut = p.st_actuel === 0 ? 'rupture' : p.st_actuel < p.st_min ? 'faible' : 'ok'
                const stockColor = statut === 'rupture' ? 'text-pavillon' : statut === 'faible' ? 'text-eiffel' : 'text-signal'
                const dlc = badgeDLC(dlcParProduit[p.id]?.dlc)
                return (
                  <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-display font-bold text-sm text-bitume truncate">{p.designation}</p>
                      {dlc && (
                        <p className={`font-mono text-[10px] mt-0.5 ${dlc.cls}`}>
                          {dlc.prefix}{dlc.label}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400 max-w-[140px] truncate">
                      {p.code ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {p.gamme}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-mono tabular font-bold text-sm ${stockColor}`}>
                        {p.st_actuel}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">/{p.st_min}</span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular text-sm font-semibold text-bitume text-right whitespace-nowrap">
                      {p.pr_vente?.toFixed(2)} €
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statut}>
                        {statut === 'rupture' ? 'Rupture' : statut === 'faible' ? 'Insuffisant' : 'En stock'}
                      </Badge>
                    </td>
                    {peutModifier && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => ouvrirModif(p)}
                            aria-label="Modifier"
                            className="p-2 rounded-xl bg-bitume/5 text-bitume hover:bg-bitume/10 transition"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmSupp(p)}
                            aria-label="Supprimer"
                            className="p-2 rounded-xl bg-pavillon/10 text-pavillon hover:bg-pavillon/20 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {visible < produitsFiltres.length && (
          <button
            onClick={() => setVisible(v => v + 20)}
            className="w-full py-3 mt-2 rounded-2xl border border-bitume/10 tag-street text-zinc-500"
          >
            VOIR PLUS · {produitsFiltres.length - visible} restants
          </button>
        )}
      </div>

      {/* ── CARDS MOBILE (<md) ─────────────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {produitsFiltres.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-2">📦</p>
            <p className="tag-street text-zinc-400 mb-1">AUCUN PRODUIT</p>
            <p className="font-mono text-[10px] text-zinc-400">
              Modifie les filtres ou ajoute un produit
            </p>
          </div>
        )}
        {produitsFiltres.slice(0, visible).map(p => {
          const statut = p.st_actuel === 0 ? 'rupture' : p.st_actuel < p.st_min ? 'faible' : 'ok'
          const stockColor = statut === 'rupture' ? 'text-pavillon' : statut === 'faible' ? 'text-eiffel' : 'text-signal'
          const dlc = badgeDLC(dlcParProduit[p.id]?.dlc)
          return (
            <Card key={p.id} variant={statut === 'ok' ? 'default' : statut}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-display font-bold text-sm text-bitume truncate flex-1">
                  {p.designation}
                </p>
                <Badge variant={statut}>
                  {statut === 'rupture' ? 'Rupture' : statut === 'faible' ? 'Insuffisant' : 'En stock'}
                </Badge>
              </div>

              <p className="font-mono text-[10px] text-zinc-400 mb-2">
                {p.gamme}
                {p.code && ` · ${p.code}`}
                {dlc && (
                  <span className={dlc.cls}>{` · ${dlc.prefix}${dlc.label}`}</span>
                )}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <span className={`font-display tabular text-3xl font-bold ${stockColor}`}>
                    {p.st_actuel}
                  </span>
                  <span className="font-mono text-zinc-400 text-xs">/{p.st_min} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display tabular text-xl font-bold text-bitume">
                    {p.pr_vente?.toFixed(2)} €
                  </span>
                  {peutModifier && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
        {visible < produitsFiltres.length && (
          <button
            onClick={() => setVisible(v => v + 20)}
            className="w-full py-3 mt-2 rounded-2xl border border-bitume/10 tag-street text-zinc-500"
          >
            VOIR PLUS · {produitsFiltres.length - visible} restants
          </button>
        )}
      </div>

      {/* ── MODAL AJOUT / MODIFICATION ─────────────────────────────────────── */}
      {modalOuvert && (
        <ProduitFormModal
          produit={produitEnCours}
          onClose={fermerModal}
          onSaved={fetchProduits}
        />
      )}

      {/* ── DIALOG CONFIRMATION SUPPRESSION ────────────────────────────────── */}
      {confirmSupp && (
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
      )}

    </div>
  )
}
