// src/lib/recapPdf.js — Générateurs PDF du récap caisse (purs, réutilisables).
//
// Extraits de Caisse.jsx pour être utilisés aussi par la page Historique
// sans dupliquer le code. La mise en page (dimensions, polices, marges,
// calcul de hauteur du ticket 80mm) est identique au code d'origine —
// seules les variables auparavant lues par closure (transactions, todayFr,
// caJour, today) deviennent des paramètres explicites.
//
// Deux paramètres optionnels ajoutés (rétrocompat préservée) :
// • agregats         : tableau renvoyé par agregerQuantites() — si fourni,
//                      on insère un bloc "QUANTITÉS VENDUES" entre les
//                      totaux et le détail des ventes.
// • sansDetailVentes : true pour les tickets semaine/mois/année où on ne
//                      veut pas la liste vente-par-vente. CRITIQUE pour le
//                      ticket 80mm : la hauteur est fixée à la création du
//                      doc, donc ces lignes doivent être retirées du décompte.

import jsPDF from 'jspdf'
import { totalQuantites } from './agregats'

/**
 * PDF récapitulatif format A4.
 * @param {Array} transactions - liste { heure, produits:[{designation, quantite, prixUnitaire}], total, paiement }
 * @param {Object} opts
 * @param {string} opts.dateFr            - libellé long FR (ex. "jeudi 25 juin 2026" ou "Semaine du 22 au 28 juin 2026")
 * @param {number} opts.caJour            - chiffre d'affaires de la période
 * @param {string} opts.fileLabel         - libellé pour le nom de fichier (ex. '2026-06-25', '2026-06-22', '2026-06', '2026')
 * @param {Array}  [opts.agregats]        - sortie de agregerQuantites() — affiche le bloc quantités vendues
 * @param {boolean}[opts.sansDetailVentes]- true pour masquer le détail vente-par-vente
 */
export function genererRecapA4(transactions, { dateFr, caJour, fileLabel, agregats, sansDetailVentes } = {}) {
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text("Panam'arket", 10, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('224 rue de Belleville, 75020 Paris', 10, 22)
  doc.text(`Récapitulatif — ${dateFr}`, 10, 29)
  doc.line(10, 33, 200, 33)

  let y = 41

  // ── Bloc QUANTITÉS VENDUES (optionnel) ─────────────────────────────────
  // Inséré AVANT le détail des ventes pour qu'il reste visible même si on
  // doit pousser le détail sur une 2e page (cas mois chargés).
  if (agregats && agregats.length > 0) {
    if (y > 250) { doc.addPage(); y = 15 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Quantités vendues', 10, y)
    y += 8
    doc.setFontSize(10)

    for (const groupe of agregats) {
      if (y > 260) { doc.addPage(); y = 15 }
      doc.setFont('helvetica', 'bold')
      doc.text(`— ${groupe.gamme} —`, 10, y)
      y += 6
      doc.setFont('helvetica', 'normal')

      for (const p of groupe.produits) {
        if (y > 270) { doc.addPage(); y = 15 }
        const label = p.designation.length > 50 ? p.designation.slice(0, 48) + '…' : p.designation
        doc.text(label, 14, y)
        doc.text(`x${p.quantite}`, 180, y, { align: 'right' })
        y += 6
      }
    }

    if (y > 270) { doc.addPage(); y = 15 }
    doc.setFont('helvetica', 'bold')
    doc.text(`Total articles : ${totalQuantites(agregats)}`, 10, y)
    y += 4
    doc.line(10, y, 200, y)
    y += 6
    doc.setFont('helvetica', 'normal')
  }

  // ── Détail des ventes (sauf si masqué pour les périodes longues) ───────
  if (!sansDetailVentes) {
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
  }

  if (y > 265) { doc.addPage(); y = 15 }
  doc.line(10, y, 200, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  // "JOURNÉE" pour les tickets jour (rétrocompat), "PÉRIODE" pour semaine/mois/année
  const labelCA = sansDetailVentes ? 'CA DE LA PÉRIODE' : 'CA DE LA JOURNÉE'
  doc.text(`${labelCA} : ${caJour.toFixed(2)} €`, 140, y)
  doc.save(`recap_caisse_${fileLabel}.pdf`)
}

/**
 * Ticket imprimante thermique 80mm (style journal Secure Caisse).
 * Hauteur calculée AVANT création du doc — sinon papier vide éjecté.
 *
 * @param {Array} transactions  - même structure que genererRecapA4
 * @param {Object} opts
 * @param {string} opts.dateFr            - libellé date affiché dans le ticket
 * @param {number} opts.caJour
 * @param {string} opts.fileLabel
 * @param {Array}  [opts.agregats]
 * @param {boolean}[opts.sansDetailVentes]
 */
export function genererRecapTicket80(transactions, { dateFr, caJour, fileLabel, agregats, sansDetailVentes } = {}) {
  const eur = (n) => Number(n).toFixed(2).replace('.', ',')
  const SEP = '-'.repeat(38) // pleine largeur en courier 8 ≈ 38 caractères

  const MARGE_HAUT = 4
  const MARGE_BAS  = 8
  const INTERLIGNE = 4

  // ── Calcul de hauteur (CRITIQUE : papier thermique = format fixé à la
  //    création du doc, impossible d'agrandir ensuite). On compte chaque
  //    ligne qui sera réellement écrite par le code de rendu plus bas.

  // 16 = en-tête + totaux + "< DÉTAIL DES VENTES >" final.
  // Si sansDetailVentes, on retire la ligne titre "< DÉTAIL DES VENTES >".
  const lignesFixesBase = sansDetailVentes ? 15 : 16

  // Bloc QUANTITÉS VENDUES : 3 lignes fixes (titre, "Total articles", SEP)
  // + 1 ligne par gamme (titre "-- gamme --") + 1 ligne par produit.
  const lignesQuantites = (agregats && agregats.length > 0)
    ? 3 + agregats.length + agregats.reduce((n, g) => n + g.produits.length, 0)
    : 0

  // Bloc détail : 2 par transaction (entête + marge SEP final) + 1 par produit.
  // Formule conservée à l'identique du code d'origine pour stabilité d'impression.
  const lignesDetail = sansDetailVentes
    ? 0
    : transactions.reduce((n, t) => n + 2 + t.produits.length, 0)

  const nbLignes = lignesFixesBase + lignesQuantites + lignesDetail
  const hauteur  = MARGE_HAUT + nbLignes * INTERLIGNE + MARGE_BAS

  const doc = new jsPDF({ unit: 'mm', format: [80, hauteur] })
  // Bords thermiques rognés : zone utile 4mm → 76mm
  const LEFT  = 4
  const RIGHT = 76

  // ── Agrégats financiers ──────────────────────────────────────────────
  const totalEspeces = transactions.filter(t => t.paiement === 'especes')
                                   .reduce((s, t) => s + t.total, 0)
  const totalCB      = transactions.filter(t => t.paiement === 'cb')
                                   .reduce((s, t) => s + t.total, 0)
  const totalGeneral = caJour
  const heures       = transactions.map(t => t.heure)
  const periodeDebut = heures[0] ?? '--'
  const periodeFin   = heures[heures.length - 1] ?? '--'
  const numDoc       = Date.now().toString().slice(-6)

  // ── Curseur + helper d'écriture ──────────────────────────────────────
  let y = MARGE_HAUT
  const ligne = (txt, align) => {
    doc.text(txt, align === 'right' ? RIGHT : align === 'center' ? 40 : LEFT, y,
             align ? { align } : undefined)
    y += INTERLIGNE
  }

  // ── En-tête ──────────────────────────────────────────────────────────
  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  ligne("PANAM'ARKET", 'center')
  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  ligne(`JOURNAL FINANCIER #${numDoc}`, 'center')
  ligne(SEP)
  ligne(`N° Document : ${numDoc}`)
  ligne(`Opérateur   : PANAM'ARKET`)
  ligne(`Date        : ${dateFr}`)
  ligne(`Période     : ${periodeDebut} > ${periodeFin}`)
  ligne(SEP)

  // ── En-tête colonnes (Opération à gauche, Euro à droite) ────────────
  doc.text('Opération', LEFT, y)
  doc.text('Euro', RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  ligne(SEP)

  // ── Totaux par mode de paiement ─────────────────────────────────────
  doc.text('Total espèces', LEFT, y)
  doc.text(eur(totalEspeces), RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  doc.text('Total C.B.', LEFT, y)
  doc.text(eur(totalCB), RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  ligne(SEP)

  // ── Total général + CA en gras ──────────────────────────────────────
  doc.setFont('courier', 'bold')
  doc.text('TOTAL GÉNÉRAL', LEFT, y)
  doc.text(eur(totalGeneral), RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  doc.text('C.A. TOTAL', LEFT, y)
  doc.text(eur(totalGeneral), RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  doc.setFont('courier', 'normal')
  ligne(SEP)

  // ── Nb ventes ────────────────────────────────────────────────────────
  doc.text('Nb ventes', LEFT, y)
  doc.text(String(transactions.length), RIGHT, y, { align: 'right' })
  y += INTERLIGNE
  ligne(SEP)

  // ── Bloc QUANTITÉS VENDUES (optionnel) ───────────────────────────────
  // Placé AVANT le détail des ventes pour rester en haut du ticket même
  // sur une journée chargée — l'épicier voit ses tops produits d'un coup d'œil.
  if (agregats && agregats.length > 0) {
    doc.setFont('courier', 'bold')
    ligne('< QUANTITÉS VENDUES >')
    doc.setFont('courier', 'normal')

    for (const groupe of agregats) {
      doc.setFont('courier', 'bold')
      ligne(`-- ${groupe.gamme} --`)
      doc.setFont('courier', 'normal')

      for (const p of groupe.produits) {
        // Designation tronquée à 26 caractères pour laisser la place à la qté
        const lib = p.designation.slice(0, 26)
        doc.text(lib, LEFT, y)
        doc.text(String(p.quantite), RIGHT, y, { align: 'right' })
        y += INTERLIGNE
      }
    }

    doc.setFont('courier', 'bold')
    ligne(`Total articles : ${totalQuantites(agregats)}`)
    doc.setFont('courier', 'normal')
    ligne(SEP)
  }

  // ── Détail de chaque vente (sauf si masqué pour les périodes longues) ─
  if (!sansDetailVentes) {
    ligne('< DÉTAIL DES VENTES >')
    transactions.forEach((t, i) => {
      ligne(`${t.heure}  Vente #${i + 1}  ${t.paiement === 'cb' ? 'CB' : 'ESP'}`)
      t.produits.forEach(p => {
        const lib   = p.designation.slice(0, 22)
        const total = eur(p.quantite * p.prixUnitaire)
        doc.text(`${lib}  x${p.quantite}`, LEFT, y)
        doc.text(total, RIGHT, y, { align: 'right' })
        y += INTERLIGNE
      })
    })
    ligne(SEP)
  }

  doc.save(`recap_secure_${fileLabel}.pdf`)
}
