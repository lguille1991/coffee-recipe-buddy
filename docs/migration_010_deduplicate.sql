-- migration_010_deduplicate.sql
-- Use this helper before running migration_010 when active duplicates already exist.
-- This script is pre-migration-safe and does NOT require a duplicate_fingerprint column.
-- Strategy:
-- 1) Keep newest active profile per (user_id, duplicate_fingerprint)
-- 2) Re-link recipes from duplicate profiles to the kept profile
-- 3) Archive the extra duplicate profiles

BEGIN;

-- Canonical duplicate key (must match migration_010 normalization rules).
WITH normalized AS (
  SELECT
    id,
    user_id,
    archived_at,
    created_at,
    updated_at,
    'label=' || lower(regexp_replace(trim(coalesce(label, '')), '\s+', ' ', 'g')) ||
    '|roaster=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roaster', '')), '\s+', ' ', 'g')) ||
    '|bean_name=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'bean_name', '')), '\s+', ' ', 'g')) ||
    '|origin=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'origin', '')), '\s+', ' ', 'g')) ||
    '|process=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'process', '')), '\s+', ' ', 'g')) ||
    '|roast_level=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roast_level', '')), '\s+', ' ', 'g')) AS fingerprint
  FROM public.coffee_profiles
)
-- Inspect active duplicate groups first.
SELECT
  user_id,
  fingerprint AS duplicate_fingerprint,
  COUNT(*) AS active_count,
  ARRAY_AGG(id ORDER BY updated_at DESC, created_at DESC, id DESC) AS profile_ids
FROM normalized
WHERE archived_at IS NULL
GROUP BY user_id, fingerprint
HAVING COUNT(*) > 1
ORDER BY active_count DESC;

-- Re-link recipes to the winner profile in each duplicate group.
WITH normalized AS (
  SELECT
    id,
    user_id,
    archived_at,
    created_at,
    updated_at,
    'label=' || lower(regexp_replace(trim(coalesce(label, '')), '\s+', ' ', 'g')) ||
    '|roaster=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roaster', '')), '\s+', ' ', 'g')) ||
    '|bean_name=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'bean_name', '')), '\s+', ' ', 'g')) ||
    '|origin=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'origin', '')), '\s+', ' ', 'g')) ||
    '|process=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'process', '')), '\s+', ' ', 'g')) ||
    '|roast_level=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roast_level', '')), '\s+', ' ', 'g')) AS fingerprint
  FROM public.coffee_profiles
),
ranked AS (
  SELECT
    id,
    user_id,
    fingerprint,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, fingerprint
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM normalized
  WHERE archived_at IS NULL
),
winners AS (
  SELECT user_id, fingerprint, id AS winner_id
  FROM ranked
  WHERE rn = 1
),
losers AS (
  SELECT
    r.id AS loser_id,
    r.user_id,
    r.fingerprint,
    w.winner_id
  FROM ranked r
  JOIN winners w
    ON w.user_id = r.user_id
   AND w.fingerprint = r.fingerprint
  WHERE r.rn > 1
)
UPDATE public.recipes AS r
SET
  coffee_profile_id = l.winner_id,
  coffee_profile_user_id = l.user_id
FROM losers AS l
WHERE r.coffee_profile_id = l.loser_id
  AND r.user_id = l.user_id;

-- Archive extra active duplicates (keep only winner active).
WITH normalized AS (
  SELECT
    id,
    user_id,
    archived_at,
    created_at,
    updated_at,
    'label=' || lower(regexp_replace(trim(coalesce(label, '')), '\s+', ' ', 'g')) ||
    '|roaster=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roaster', '')), '\s+', ' ', 'g')) ||
    '|bean_name=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'bean_name', '')), '\s+', ' ', 'g')) ||
    '|origin=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'origin', '')), '\s+', ' ', 'g')) ||
    '|process=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'process', '')), '\s+', ' ', 'g')) ||
    '|roast_level=' || lower(regexp_replace(trim(coalesce(bean_profile_json->>'roast_level', '')), '\s+', ' ', 'g')) AS fingerprint
  FROM public.coffee_profiles
),
ranked AS (
  SELECT
    id,
    user_id,
    fingerprint,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, fingerprint
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM normalized
  WHERE archived_at IS NULL
)
UPDATE public.coffee_profiles AS cp
SET archived_at = NOW()
FROM ranked AS r
WHERE cp.id = r.id
  AND cp.user_id = r.user_id
  AND r.rn > 1;

COMMIT;

-- After this runs, execute docs/migration_010_coffee_profile_duplicate_fingerprint.sql
