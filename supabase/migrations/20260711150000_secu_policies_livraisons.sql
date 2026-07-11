-- Audit sécurité 11/07/2026 — Lot S1
-- Reliquats de l'audit du 24/06 : les deux policies étaient restées en littéral "true".
-- INSERT : chaque livraison doit porter le user_id de son auteur (le code l'envoie déjà,
-- cf. Achats.jsx validerAchats). UPDATE : personne ne modifie une livraison dans l'app,
-- on réserve au gérant.

ALTER POLICY livraisons_insert ON public.livraisons
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY livraisons_update ON public.livraisons
  USING ("current_role"() = 'gerant'::text);
