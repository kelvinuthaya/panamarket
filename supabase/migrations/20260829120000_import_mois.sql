-- Fix bug 29/08/2026 — top5 / nb_transactions / panier_moyen / nb_articles d'un
-- import PDF ou CSV ne vivaient que dans l'état React du Dashboard : au moindre
-- refresh ils retombaient sur les transactions internes (vides pour un mois
-- importé), donnant "aucune vente ce mois" et "0 article" malgré un CA affiché.
-- Le mois est le bon grain pour ces métriques : nb_transactions et panier_moyen
-- étaient jusqu'ici recopiés à l'identique sur chaque ligne jour de ca_importe,
-- ce qui était faux par construction.

CREATE TABLE IF NOT EXISTS public.import_mois (
  source          text NOT NULL CHECK (source IN ('pdf', 'csv')),
  label_mois      text NOT NULL,          -- ex "Mars 2026"
  mois            date NOT NULL,          -- 1er du mois, pour les requêtes
  nb_transactions int,
  panier_moyen    numeric,
  nb_articles     int,
  top5            jsonb,                  -- [{designation, qte, ca}]
  imported_by     uuid,
  PRIMARY KEY (source, mois)
);

ALTER TABLE public.import_mois ENABLE ROW LEVEL SECURITY;

-- Lecture pour tout utilisateur authentifié (même pattern que les autres tables).
CREATE POLICY import_mois_select ON public.import_mois
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Écriture réservée au gérant (seul rôle autorisé à importer, cf. Dashboard.jsx).
CREATE POLICY import_mois_write ON public.import_mois
  FOR ALL
  USING ("current_role"() = 'gerant'::text)
  WITH CHECK ("current_role"() = 'gerant'::text);
