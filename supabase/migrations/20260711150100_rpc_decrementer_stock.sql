-- Audit sécurité 11/07/2026 — Lot S2
-- La policy produits_update est réservée manager/gérant, or la Caisse (flux employé)
-- doit décrémenter le stock à la vente. Un UPDATE filtré par RLS échoue SANS erreur
-- (0 ligne) : les ventes employé n'ont jamais décrémenté le stock depuis l'activation RLS.
--
-- Solution : RPC SECURITY DEFINER qui ne touche QUE st_actuel, de façon atomique
-- (corrige au passage la race condition de deux caisses simultanées).
-- Gardes : utilisateur authentifié obligatoire, qte strictement positive (empêche
-- un incrément détourné via qte négative), plancher à 0.

CREATE OR REPLACE FUNCTION public.decrementer_stock(pid bigint, qte double precision)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE produits
  SET st_actuel = GREATEST(0, st_actuel - qte)
  WHERE id = pid
    AND auth.uid() IS NOT NULL
    AND qte > 0;
$fn$;

REVOKE ALL ON FUNCTION public.decrementer_stock(bigint, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrementer_stock(bigint, double precision) TO authenticated;
