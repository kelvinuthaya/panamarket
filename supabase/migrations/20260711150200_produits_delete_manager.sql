-- Audit sécurité 11/07/2026 — Lot S3
-- Le cahier des charges donne la gestion du catalogue (dont suppression) au manager,
-- mais la policy DELETE était gérant seul : le bouton Supprimer du Catalogue affichait
-- un faux succès pour le manager (DELETE filtré par RLS = 0 ligne, sans erreur).

ALTER POLICY produits_delete ON public.produits
  USING ("current_role"() = ANY (ARRAY['manager'::text, 'gerant'::text]));
