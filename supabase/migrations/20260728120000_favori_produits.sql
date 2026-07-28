-- Fix bug 28/07/2026 — les favoris de la Caisse ne persistaient jamais d'une
-- session à l'autre (localStorage, très probablement vidé par un profil
-- navigateur réinitialisé à chaque ouverture sur le poste caisse).
--
-- Les favoris deviennent une propriété du catalogue, durable et partagée
-- entre tous les postes/employés, au lieu d'un Set stocké côté navigateur.

ALTER TABLE produits ADD COLUMN IF NOT EXISTS favori boolean NOT NULL DEFAULT false;

-- La policy produits_update est réservée manager/gérant : un employé ne peut
-- pas modifier produits directement. RPC dédiée (même pattern que
-- decrementer_stock) qui ne touche QUE la colonne favori.
CREATE OR REPLACE FUNCTION public.toggle_favori(pid bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  nouveau boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'non authentifie';
  END IF;
  UPDATE produits SET favori = NOT favori WHERE id = pid RETURNING favori INTO nouveau;
  RETURN nouveau;
END;
$fn$;

REVOKE ALL ON FUNCTION public.toggle_favori(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_favori(bigint) TO authenticated;
