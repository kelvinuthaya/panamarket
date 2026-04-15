// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

// Récupération des variables d'environnement (syntaxe spécifique à Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Création et exportation du client Supabase
// "export" permet d'utiliser ce client dans n'importe quel autre fichier (ex: dans tes pages)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);