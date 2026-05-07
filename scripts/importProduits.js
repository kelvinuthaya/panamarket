// scripts/importProduits.js
// Script standalone : lit produits_actifs.csv à la racine et insère chaque ligne dans Supabase.
// Usage : node scripts/importProduits.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// __dirname n'existe pas en ESM — on le reconstitue ainsi
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 1. Charger les variables d'environnement depuis .env.local ──────────────
// Node ne charge pas .env.local automatiquement (c'est Vite qui le fait).
// On le parse manuellement : chaque ligne "CLE=valeur" devient process.env.CLE
const envPath = path.join(ROOT, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Fichier .env.local introuvable à la racine du projet.');
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  process.env[key.trim()] = rest.join('=').trim();
}

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant dans .env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 2. Lire et parser le CSV ─────────────────────────────────────────────────
// Nouveau fichier cible :
const csvPath = path.join(ROOT, 'produits_enrichis.csv');
if (!fs.existsSync(csvPath)) {
  console.error('Fichier produits_enrichis.csv introuvable à la racine du projet.');
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean); // supprimer les lignes vides

const [headerLine, ...dataLines] = lines;
const headers = headerLine.split(',').map(h => h.trim());

const produits = dataLines.map((line, i) => {
  const values = line.split(',').map(v => v.trim());
  if (values.length !== headers.length) {
    console.warn(`Ligne ${i + 2} ignorée (${values.length} colonnes, attendu ${headers.length}) : ${line}`);
    return null;
  }
  
  // Associer temporairement les valeurs de la ligne aux en-têtes correspondants
  const row = {};
  headers.forEach((col, idx) => {
    row[col] = values[idx];
  });

  // Construction de l'objet produit formaté pour Supabase
  return {
    designation: row.designation_pdf,
    code: row.code_ean || '',
    gamme: row.gamme || 'Autres',
    st_actuel: 5,
    st_min: 5,
    pr_vente: parseFloat(row.pr_vente) || 0
  };
}).filter(Boolean);

console.log(`\n${produits.length} produit(s) trouvé(s) dans le CSV.\n`);

// ── 3. Vider la table produits avant d'importer ──────────────────────────────
console.log("Suppression des anciens produits de la table...");
const { error: deleteError } = await supabase.from('produits').delete().neq('id', 0);

if (deleteError) {
  console.error("Erreur lors de la suppression des produits :", deleteError.message);
  process.exit(1);
}
console.log("Table 'produits' vidée avec succès.\n");

// ── 4. Insérer dans Supabase un par un pour un log précis ────────────────────
let success = 0;
let failure = 0;

console.log("Début de l'importation...");
for (const produit of produits) {
  const { error } = await supabase.from('produits').insert(produit);
  if (error) {
    console.error(`  ✗ ${produit.designation} — ${error.message}`);
    failure++;
  } else {
    console.log(`  ✓ ${produit.designation} (${produit.code})`);
    success++;
  }
}

// ── 5. Résumé final ───────────────────────────────────────────────────────────
console.log('\n─────────────────────────────');
console.log(`Import terminé : ${success} insérés, ${failure} erreur(s).`);
if (failure > 0) {
  console.log('Vérifiez les erreurs ci-dessus (doublons, type de donnée invalide…)');
}