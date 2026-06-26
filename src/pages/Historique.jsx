// Historique des journées de caisse — réservé au gérant.
//
// Permet de re-générer le ticket récap (80mm thermique ou A4) d'une journée
// passée, et de voir qui a encaissé quoi. Les transactions sont immuables :
// aucune action de suppression ou de modification ici.
//
// SOURCE DE VÉRITÉ pour les bornes de la journée commerciale (bascule 4h) :
// src/lib/journee.js — partagée avec Caisse.jsx.
//
// Périodes : jour | semaine | mois | année. Le sélecteur de date sert de
// point de référence, la période sélectionnée donne les bornes [debut, fin[
// envoyées à Supabase. Les périodes longues n'affichent PAS le détail des
// ventes à l'écran (illisible) ni dans le PDF (option sansDetailVentes).

import { useState, useEffect, useMemo } from 'react'
import { CalendarClock, FileText, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  bornesJourneeCommerciale, jourCommercial, formatJourFr,
  bornesSemaine, bornesMois, bornesAnnee,
  formatSemaineFr, formatMoisFr, formatAnneeFr,
  libelleSemaineIso, libelleMoisIso, libelleAnneeIso,
} from '../lib/journee'
import { genererRecapA4, genererRecapTicket80 } from '../lib/recapPdf'
import { agregerQuantites, totalQuantites } from '../lib/agregats'

// Calcule les bornes [debut, fin[ et le couple { dateFr, fileLabel } selon la période.
// Centralisé pour éviter les divergences entre la requête Supabase et le PDF.
function contexteDePeriode(periode, jourRef) {
  // dateRef ancrée à midi pour neutraliser les effets de fuseau au parsing
  const dateRef = new Date(jourRef + 'T12:00:00')
  switch (periode) {
    case 'semaine':
      return {
        ...bornesSemaine(dateRef),
        dateFr:    formatSemaineFr(dateRef),
        fileLabel: `semaine_${libelleSemaineIso(dateRef)}`,
      }
    case 'mois':
      return {
        ...bornesMois(dateRef),
        dateFr:    formatMoisFr(dateRef),
        fileLabel: `mois_${libelleMoisIso(dateRef)}`,
      }
    case 'annee':
      return {
        ...bornesAnnee(dateRef),
        dateFr:    formatAnneeFr(dateRef),
        fileLabel: `annee_${libelleAnneeIso(dateRef)}`,
      }
    case 'jour':
    default:
      return {
        ...bornesJourneeCommerciale(dateRef),
        dateFr:    formatJourFr(jourRef),
        fileLabel: jourRef,
      }
  }
}

export default function Historique() {
  const { role } = useAuth()
  const [jour, setJour]                 = useState(() => jourCommercial())
  const [periode, setPeriode]           = useState('jour') // jour | semaine | mois | annee
  const [transactions, setTransactions] = useState([])
  const [gammeParId, setGammeParId]     = useState({})
  const [loading, setLoading]           = useState(false)
  const estGerant = role === 'gerant'

  // ── Chargement de l'index gamme par produit (une seule fois) ──────────────
  // La gamme n'est pas stockée dans le JSONB des transactions, on la reconstitue
  // depuis la table `produits`. Une requête au montage suffit : la liste change
  // peu et on évite de recharger à chaque changement de date.
  useEffect(() => {
    if (!estGerant) return
    let cancelled = false
    async function loadGammes() {
      const { data, error } = await supabase.from('produits').select('id, gamme')
      if (cancelled || error || !data) return
      setGammeParId(Object.fromEntries(data.map(p => [p.id, p.gamme || 'Autre'])))
    }
    loadGammes()
    return () => { cancelled = true }
  }, [estGerant])

  // ── Contexte de période (mémo : recalculé seulement si jour/periode change) ─
  const ctx = useMemo(() => contexteDePeriode(periode, jour), [periode, jour])

  // ── Chargement des ventes de la période sélectionnée ──────────────────────
  // Tous les hooks doivent être déclarés AVANT tout early return — règle React.
  useEffect(() => {
    if (!estGerant) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', ctx.debut.toISOString())
        .lt('created_at', ctx.fin.toISOString())
        .order('created_at')

      if (cancelled) return
      if (error || !data) {
        setTransactions([])
      } else {
        setTransactions(data.map(t => ({
          id:        t.id,
          heure:     new Date(t.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          produits:  t.produits,
          total:     parseFloat(t.total),
          paiement:  t.paiement,
          operateur: t.operateur,
        })))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ctx, estGerant])

  // ── Computed ───────────────────────────────────────────────────────────────
  const caJour = useMemo(
    () => transactions.reduce((sum, t) => sum + t.total, 0),
    [transactions]
  )

  const agregats = useMemo(
    () => agregerQuantites(transactions, gammeParId),
    [transactions, gammeParId]
  )

  const estPeriodeLongue = periode !== 'jour'

  // ── Garde de rôle ─────────────────────────────────────────────────────────
  // RLS bloque déjà l'accès aux données côté serveur ; ceci n'est que la couche UX.
  if (!estGerant) {
    return (
      <div className="-mx-4 -mt-4 md:-mt-6 bg-bitume min-h-[100dvh] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="tag-street text-pavillon mb-2">ACCÈS RESTREINT</p>
          <p className="font-display text-2xl font-bold text-white mb-3">
            Réservé au gérant
          </p>
          <p className="text-sm text-zinc-400">
            L'historique des journées de caisse n'est accessible
            qu'aux comptes gérant.
          </p>
        </div>
      </div>
    )
  }

  // ── Exports PDF ────────────────────────────────────────────────────────────
  // Périodes longues : on masque le détail vente-par-vente (illisible et inutile).
  // Le récap des quantités vendues reste, c'est l'info clé du gérant.
  const exporterTicket80 = () =>
    genererRecapTicket80(transactions, {
      dateFr:    ctx.dateFr,
      caJour,
      fileLabel: ctx.fileLabel,
      agregats,
      sansDetailVentes: estPeriodeLongue,
    })
  const exporterPdfA4 = () =>
    genererRecapA4(transactions, {
      dateFr:    ctx.dateFr,
      caJour,
      fileLabel: ctx.fileLabel,
      agregats,
      sansDetailVentes: estPeriodeLongue,
    })

  // ── Onglets de période — réutilise le style "pills" PANAME OS ─────────────
  const PERIODES = [
    { id: 'jour',    label: 'JOUR'    },
    { id: 'semaine', label: 'SEMAINE' },
    { id: 'mois',    label: 'MOIS'    },
    { id: 'annee',   label: 'ANNÉE'   },
  ]

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="-mx-4 -mt-4 md:-mt-6 bg-bitume text-white min-h-[100dvh]">
      <div className="px-4 pt-4 md:pt-6 pb-12">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="mb-5">
          <p className="tag-street text-eiffel">HISTORIQUE</p>
          <p className="font-display text-3xl font-bold text-white tabular leading-none mt-1 capitalize">
            {ctx.dateFr}
          </p>
        </header>

        {/* ── ONGLETS DE PÉRIODE ─────────────────────────────────────────── */}
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {PERIODES.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriode(p.id)}
              className={`py-2 rounded-xl tag-street text-[10px] transition ${
                periode === p.id
                  ? 'bg-gradient-to-br from-paname-700 to-paname-500 text-white shadow-paname'
                  : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* ── SÉLECTEUR DE DATE ─────────────────────────────────────────── */}
        <div className="mb-5 bg-bitume-2 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-eiffel/15 flex items-center justify-center shrink-0">
            <CalendarClock size={18} className="text-eiffel" />
          </div>
          <div className="flex-1">
            <label htmlFor="date-journee" className="tag-street text-zinc-500 block mb-1">
              DATE DE RÉFÉRENCE
            </label>
            <input
              id="date-journee"
              type="date"
              value={jour}
              max={jourCommercial()}
              onChange={e => setJour(e.target.value)}
              className="w-full bg-transparent text-white text-sm font-medium outline-none"
            />
          </div>
        </div>

        {/* ── ÉTAT DE CHARGEMENT ─────────────────────────────────────────── */}
        {loading && (
          <p className="text-center text-eiffel py-12 tag-street">
            CHARGEMENT…
          </p>
        )}

        {/* ── AUCUNE VENTE ────────────────────────────────────────────────── */}
        {!loading && transactions.length === 0 && (
          <div className="bg-bitume-2 border border-white/5 rounded-2xl px-4 py-10 text-center">
            <p className="tag-street text-zinc-500">
              AUCUNE VENTE ENREGISTRÉE POUR CETTE PÉRIODE
            </p>
          </div>
        )}

        {/* ── AFFICHAGE JOUR : détail des ventes ─────────────────────────── */}
        {!loading && transactions.length > 0 && !estPeriodeLongue && (
          <>
            <div className="space-y-3 mb-3">
              {transactions.map((t, i) => (
                <div key={t.id} className="bg-bitume-3 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="flex items-start justify-between px-4 py-3 border-b border-white/5 gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm text-white">
                        Vente #{i + 1}
                        <span className="text-zinc-500 font-normal font-mono text-[10px] ml-2">{t.heure}</span>
                      </p>
                      <p className="font-mono text-[10px] text-zinc-400 mt-0.5">
                        {t.paiement === 'cb' ? '💳 CB' : '💵 Espèces'}
                      </p>
                      {/* Badge opérateur : bien visible, sur ligne dédiée */}
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-paname-700/40 border border-paname-500/30 text-paname-300 tag-street text-[9px]">
                        OP · {t.operateur ?? '—'}
                      </span>
                    </div>
                    <span className="font-display tabular text-base font-bold text-white shrink-0">
                      {t.total.toFixed(2)} €
                    </span>
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
            </div>
          </>
        )}

        {/* ── AFFICHAGE PÉRIODE LONGUE : synthèse uniquement ─────────────── */}
        {!loading && transactions.length > 0 && estPeriodeLongue && (
          <>
            {/* Carte stats : CA + nombre de ventes + total articles */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-bitume-2 border border-white/5 rounded-2xl px-3 py-3">
                <p className="tag-street text-zinc-500 text-[9px]">VENTES</p>
                <p className="font-display tabular text-xl font-bold text-white mt-1">
                  {transactions.length}
                </p>
              </div>
              <div className="bg-bitume-2 border border-white/5 rounded-2xl px-3 py-3">
                <p className="tag-street text-zinc-500 text-[9px]">ARTICLES</p>
                <p className="font-display tabular text-xl font-bold text-white mt-1">
                  {totalQuantites(agregats)}
                </p>
              </div>
              <div className="bg-bitume-2 border border-white/5 rounded-2xl px-3 py-3">
                <p className="tag-street text-zinc-500 text-[9px]">PANIER MOY.</p>
                <p className="font-display tabular text-xl font-bold text-white mt-1">
                  {(caJour / transactions.length).toFixed(2)}<span className="text-eiffel ml-0.5 text-xs">€</span>
                </p>
              </div>
            </div>

            {/* Récap quantités par gamme */}
            <div className="space-y-2 mb-3">
              {agregats.map(groupe => (
                <div key={groupe.gamme} className="bg-bitume-3 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-white/5">
                    <p className="tag-street text-eiffel text-[11px]">{groupe.gamme}</p>
                    <span className="font-mono text-[10px] text-zinc-400 tabular">
                      {groupe.totalGamme} articles
                    </span>
                  </div>
                  {groupe.produits.map((p, j) => (
                    <div key={j} className="flex items-center justify-between px-4 py-2 text-xs text-zinc-400">
                      <span className="flex-1 truncate mr-2">{p.designation}</span>
                      <span className="shrink-0 font-mono tabular text-white">
                        ×{p.quantite}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── CA bandeau gradient paname (commun à toutes les périodes) ──── */}
        {!loading && transactions.length > 0 && (
          <div className="bg-gradient-to-r from-paname-700 to-paname-500 rounded-2xl px-4 py-4 flex justify-between items-center shadow-paname mb-4">
            <span className="tag-street text-white/80">
              CA {estPeriodeLongue ? 'DE LA PÉRIODE' : 'DE LA JOURNÉE'}
            </span>
            <span className="font-display text-3xl font-bold tabular text-white">
              {caJour.toFixed(2)}
              <span className="text-eiffel ml-1">€</span>
            </span>
          </div>
        )}

        {/* ── BOUTONS EXPORT ──────────────────────────────────────────────── */}
        <div className="space-y-2 mt-2">
          <button
            onClick={exporterTicket80}
            disabled={transactions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            <Printer size={18} />
            Ticket caisse 80mm
          </button>
          <button
            onClick={exporterPdfA4}
            disabled={transactions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-30 hover:bg-white/10 transition"
          >
            <FileText size={18} />
            Générer ticket PDF
          </button>
        </div>
      </div>
    </div>
  )
}
