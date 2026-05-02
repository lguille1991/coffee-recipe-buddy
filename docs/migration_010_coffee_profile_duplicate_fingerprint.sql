-- migration_010_coffee_profile_duplicate_fingerprint.sql

CREATE OR REPLACE FUNCTION public.normalize_duplicate_key_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

ALTER TABLE public.coffee_profiles
  ADD COLUMN IF NOT EXISTS duplicate_fingerprint text;

UPDATE public.coffee_profiles
SET duplicate_fingerprint =
  'label=' || public.normalize_duplicate_key_text(label) ||
  '|roaster=' || public.normalize_duplicate_key_text(bean_profile_json->>'roaster') ||
  '|bean_name=' || public.normalize_duplicate_key_text(bean_profile_json->>'bean_name') ||
  '|origin=' || public.normalize_duplicate_key_text(bean_profile_json->>'origin') ||
  '|process=' || public.normalize_duplicate_key_text(bean_profile_json->>'process') ||
  '|roast_level=' || public.normalize_duplicate_key_text(bean_profile_json->>'roast_level')
WHERE duplicate_fingerprint IS NULL;

ALTER TABLE public.coffee_profiles
  ALTER COLUMN duplicate_fingerprint SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.coffee_profiles
    WHERE archived_at IS NULL
    GROUP BY user_id, duplicate_fingerprint
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve active duplicate coffee profiles before applying unique index on duplicate_fingerprint';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS coffee_profiles_user_duplicate_fingerprint_active_unique
  ON public.coffee_profiles (user_id, duplicate_fingerprint)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS coffee_profiles_user_duplicate_fingerprint_idx
  ON public.coffee_profiles (user_id, duplicate_fingerprint);
