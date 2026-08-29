-- Fix bug 29/08/2026 — la répartition TVA du Dashboard vivait uniquement
-- dans l'état React donneesCsv.caParTva : jamais persistée, jamais rattachée
-- à un mois. Elle affichait donc toujours celle du dernier fichier importé,
-- peu importe le mois affiché — y compris un mois sans aucune donnée. Même
-- classe de bug que top5/nb_articles (cf. import_mois), même remède :
-- stocker par mois plutôt que dans un état de session.

ALTER TABLE public.import_mois ADD COLUMN IF NOT EXISTS ca_par_tva jsonb;
-- Format : { "2.00": 56.00, "5.50": 5044.55, "10.00": 15.60, "20.00": 419.50 }
-- (TTC cumulé du mois par taux)
