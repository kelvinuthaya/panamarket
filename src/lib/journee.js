// src/lib/journee.js — Helpers de la "journée commerciale" Panam'arket.
//
// SOURCE UNIQUE de la règle des 4h, partagée par la Caisse et l'Historique.
// Toute modification ici se propage aux deux pages : aucune divergence possible.
//
// Pourquoi 4h du matin ?
// • L'épicerie ferme à 2h. Une vente à 1h du matin doit être imputée à la
//   journée de la veille (CA, ticket récap, etc.), pas à celle du nouveau jour.
// • On choisit donc 4h comme "frontière" : marge de 2h après la fermeture pour
//   couvrir les régularisations / petits écarts d'horloge.
// • Une journée commerciale = [04:00 Paris jour J, 04:00 Paris jour J+1[
//
// Pourquoi Intl plutôt que +1/+2h codé en dur ?
// • Paris est en heure d'hiver (UTC+1) ou d'été (UTC+2). L'offset change deux
//   fois par an, et le passage à l'heure d'été supprime une heure (2h→3h).
// • Intl.DateTimeFormat avec timeZone:'Europe/Paris' connaît ces règles —
//   on s'appuie dessus plutôt que de réimplémenter les transitions DST.

const HEURE_BASCULE = 4
const TZ_PARIS = 'Europe/Paris'

// Découpe une Date en composants "wall clock" Paris (année, mois, jour, heure…)
function partsParis(date) {
  // en-CA donne le format ISO (YYYY-MM-DD) — plus facile à parser
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_PARIS,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const map = Object.fromEntries(
    fmt.formatToParts(date)
       .filter(p => p.type !== 'literal')
       .map(p => [p.type, p.value])
  )
  // hour12:false peut renvoyer "24" pour minuit selon le runtime — on normalise
  const hour = Number(map.hour) === 24 ? 0 : Number(map.hour)
  return {
    year:   Number(map.year),
    month:  Number(map.month),
    day:    Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

// Convertit une heure murale Paris (Y/M/D/h/m/s) en Date UTC absolue.
// Astuce : on fait une "première supposition" en traitant les nombres comme
// du UTC, on regarde ce que Paris afficherait à cet instant, et on corrige
// l'écart. Ça suit automatiquement la DST sans la coder en dur.
function parisToDate(year, month, day, hour, minute = 0, second = 0) {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute, second)
  const observed = partsParis(new Date(guessMs))
  const observedMs = Date.UTC(
    observed.year, observed.month - 1, observed.day,
    observed.hour, observed.minute, observed.second
  )
  // offset = ce que Paris voit - ce qu'on voulait. On soustrait pour corriger.
  const offset = observedMs - guessMs
  return new Date(guessMs - offset)
}

/**
 * Retourne les bornes { debut, fin } de la journée commerciale contenant dateRef.
 * • debut = HEURE_BASCULE:00 Paris du jour commercial
 * • fin   = debut + 24h (intervalle semi-ouvert : [debut, fin[)
 *
 * Exemple :
 *   bornesJourneeCommerciale(new Date('2026-06-25T01:30:00+02:00'))
 *   → debut = 24/06/2026 04:00 Paris, fin = 25/06/2026 04:00 Paris
 *   (la vente à 1h30 du 25 appartient bien à la journée du 24)
 */
export function bornesJourneeCommerciale(dateRef = new Date()) {
  const p = partsParis(dateRef)
  let { year, month, day } = p

  // Avant 4h du matin → on est encore dans la journée commerciale de la veille
  if (p.hour < HEURE_BASCULE) {
    // Décrémente d'un jour en se servant de Date.UTC qui normalise les bords
    // de mois (Date.UTC(2026, 0, 0) → 31/12/2025, Date.UTC(2026, 2, 0) → 28/02/2026)
    const prev = new Date(Date.UTC(year, month - 1, day - 1))
    year  = prev.getUTCFullYear()
    month = prev.getUTCMonth() + 1
    day   = prev.getUTCDate()
  }

  const debut = parisToDate(year, month, day, HEURE_BASCULE, 0, 0)
  const fin   = new Date(debut.getTime() + 24 * 60 * 60 * 1000)
  return { debut, fin }
}

/**
 * Retourne la date 'YYYY-MM-DD' du jour commercial contenant dateRef.
 * Sert d'étiquette et de clé de regroupement (URL, input[type=date]…).
 */
export function jourCommercial(dateRef = new Date()) {
  const { debut } = bornesJourneeCommerciale(dateRef)
  // On reformate debut en wall-clock Paris pour obtenir la date "vue" par l'épicerie
  const p = partsParis(debut)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * Formate 'YYYY-MM-DD' en libellé français long : "jeudi 25 juin 2026".
 * On ancre la Date à midi UTC pour neutraliser tout effet de fuseau au formatage.
 */
export function formatJourFr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: TZ_PARIS,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
//  BORNES DE PÉRIODE (semaine, mois, année) — calées sur la journée
//  commerciale (début 4h Paris), DST géré via Intl comme pour la journée.
//
//  Toutes les bornes retournent { debut, fin } en Date UTC absolue, avec
//  fin EXCLUSIVE (intervalle semi-ouvert [debut, fin[) — adapté aux .gte
//  et .lt de Supabase pour éviter les doubles comptages aux frontières.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Jour de la semaine (lundi=1, dimanche=7) du jour commercial Paris contenant dateRef.
 * On reconstitue une Date "neutre" à midi UTC pour appliquer getUTCDay() sans
 * risque de glissement de fuseau, puis on normalise dim=0 → 7.
 */
function isoDayOfWeek(p) {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  const dow = d.getUTCDay() // 0=dimanche, 1=lundi, ..., 6=samedi
  return dow === 0 ? 7 : dow
}

/**
 * Bornes de la semaine ISO (lundi → dimanche) calées sur la bascule 4h.
 * debut = LUNDI 04:00 Paris ; fin = LUNDI suivant 04:00 Paris (exclusif).
 * dateRef peut tomber n'importe quel jour de la semaine.
 */
export function bornesSemaine(dateRef = new Date()) {
  const { debut: debutJour } = bornesJourneeCommerciale(dateRef)
  const p = partsParis(debutJour)
  const dow = isoDayOfWeek(p) // 1..7

  // Lundi de la semaine = jour commercial - (dow - 1) jours
  // Date.UTC normalise les bords de mois/année (jour 0 = dernier jour du mois précédent)
  const lundiUtc = new Date(Date.UTC(p.year, p.month - 1, p.day - (dow - 1)))
  const ly = lundiUtc.getUTCFullYear()
  const lm = lundiUtc.getUTCMonth() + 1
  const ld = lundiUtc.getUTCDate()

  const debut = parisToDate(ly, lm, ld, HEURE_BASCULE, 0, 0)
  // Lundi suivant : +7 jours en arithmétique calendaire (DST-safe via parisToDate)
  const lundiSuivantUtc = new Date(Date.UTC(ly, lm - 1, ld + 7))
  const fin = parisToDate(
    lundiSuivantUtc.getUTCFullYear(),
    lundiSuivantUtc.getUTCMonth() + 1,
    lundiSuivantUtc.getUTCDate(),
    HEURE_BASCULE, 0, 0
  )
  return { debut, fin }
}

/**
 * Bornes du mois calendaire calées sur la bascule 4h.
 * debut = 1er du mois 04:00 Paris ; fin = 1er du mois suivant 04:00 Paris.
 */
export function bornesMois(dateRef = new Date()) {
  const { debut: debutJour } = bornesJourneeCommerciale(dateRef)
  const p = partsParis(debutJour)
  const debut = parisToDate(p.year, p.month, 1, HEURE_BASCULE, 0, 0)
  // parisToDate accepte un mois "13" (= janvier de l'année suivante) — Date.UTC normalise
  const fin = parisToDate(p.year, p.month + 1, 1, HEURE_BASCULE, 0, 0)
  return { debut, fin }
}

/**
 * Bornes de l'année civile calées sur la bascule 4h.
 * debut = 1er janvier 04:00 Paris ; fin = 1er janvier suivant 04:00 Paris.
 */
export function bornesAnnee(dateRef = new Date()) {
  const { debut: debutJour } = bornesJourneeCommerciale(dateRef)
  const p = partsParis(debutJour)
  const debut = parisToDate(p.year, 1, 1, HEURE_BASCULE, 0, 0)
  const fin = parisToDate(p.year + 1, 1, 1, HEURE_BASCULE, 0, 0)
  return { debut, fin }
}

// ── Libellés FR pour affichage à l'écran et dans les tickets ─────────────

/**
 * "Semaine du 22 au 28 juin 2026" (même mois)
 * "Semaine du 29 juin au 5 juillet 2026" (mois différents, même année)
 * "Semaine du 30 décembre 2025 au 5 janvier 2026" (années différentes)
 */
export function formatSemaineFr(dateRef = new Date()) {
  const { debut, fin } = bornesSemaine(dateRef)
  // fin = lundi suivant 4h → le dimanche est le dernier jour, soit fin - 1ms
  const dimanche = new Date(fin.getTime() - 1)
  const pDebut = partsParis(debut)
  const pDim   = partsParis(dimanche)

  // Ancrage à midi UTC pour éviter tout glissement au formatage
  const dDebut = new Date(Date.UTC(pDebut.year, pDebut.month - 1, pDebut.day, 12))
  const dDim   = new Date(Date.UTC(pDim.year,   pDim.month   - 1, pDim.day,   12))

  const optsJour      = { day: 'numeric', timeZone: TZ_PARIS }
  const optsJourMois  = { day: 'numeric', month: 'long', timeZone: TZ_PARIS }
  const optsComplet   = { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ_PARIS }
  const fr = 'fr-FR'

  const sameYear  = pDebut.year  === pDim.year
  const sameMonth = sameYear && pDebut.month === pDim.month

  if (sameMonth) {
    return `Semaine du ${dDebut.toLocaleDateString(fr, optsJour)} au ${dDim.toLocaleDateString(fr, optsComplet)}`
  }
  if (sameYear) {
    return `Semaine du ${dDebut.toLocaleDateString(fr, optsJourMois)} au ${dDim.toLocaleDateString(fr, optsComplet)}`
  }
  return `Semaine du ${dDebut.toLocaleDateString(fr, optsComplet)} au ${dDim.toLocaleDateString(fr, optsComplet)}`
}

/** "Juin 2026" (première lettre capitalisée). */
export function formatMoisFr(dateRef = new Date()) {
  const { debut } = bornesMois(dateRef)
  const p = partsParis(debut)
  const date = new Date(Date.UTC(p.year, p.month - 1, 15, 12))
  const label = date.toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric', timeZone: TZ_PARIS,
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** "2026" — l'année civile du jour commercial contenant dateRef. */
export function formatAnneeFr(dateRef = new Date()) {
  const { debut } = bornesAnnee(dateRef)
  return String(partsParis(debut).year)
}

// ── Libellés ISO pour les noms de fichier PDF ────────────────────────────

/** 'YYYY-MM-DD' du lundi de la semaine. */
export function libelleSemaineIso(dateRef = new Date()) {
  const { debut } = bornesSemaine(dateRef)
  const p = partsParis(debut)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** 'YYYY-MM' du mois. */
export function libelleMoisIso(dateRef = new Date()) {
  const { debut } = bornesMois(dateRef)
  const p = partsParis(debut)
  return `${p.year}-${String(p.month).padStart(2, '0')}`
}

/** 'YYYY' de l'année. */
export function libelleAnneeIso(dateRef = new Date()) {
  const { debut } = bornesAnnee(dateRef)
  return String(partsParis(debut).year)
}
