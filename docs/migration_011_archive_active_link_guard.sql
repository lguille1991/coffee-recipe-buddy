-- Migration 011: Archive guard should only block linked active recipes
--
-- Deployment notes:
-- 1) Apply this migration before (or in same wave as) API/UI changes that rely on active-only archive blocking.
-- 2) App rollback does not revert this DB change automatically.
-- 3) Reverse migration (if required): restore previous trigger function body and message.

CREATE OR REPLACE FUNCTION public.prevent_archiving_linked_coffee_profiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL
     AND OLD.archived_at IS NULL
     AND EXISTS (
       SELECT 1
       FROM public.recipes r
       WHERE r.coffee_profile_id = NEW.id
         AND r.user_id = NEW.user_id
         AND r.archived = false
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Cannot archive coffee profile while it is linked to existing active recipes';
  END IF;

  RETURN NEW;
END;
$$;
