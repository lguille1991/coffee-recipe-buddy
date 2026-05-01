-- Migration 009: Saved coffee profiles, profile images, and recipe linkage

CREATE TABLE IF NOT EXISTS public.coffee_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bean_profile_json jsonb       NOT NULL DEFAULT '{}',
  label             text        NOT NULL,
  scan_source       text        NOT NULL DEFAULT 'scan' CHECK (scan_source IN ('scan', 'manual', 'mixed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz,
  archived_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS coffee_profiles_id_user_unique
  ON public.coffee_profiles (id, user_id);

CREATE INDEX IF NOT EXISTS coffee_profiles_user_created_idx
  ON public.coffee_profiles (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coffee_profiles_user_last_used_idx
  ON public.coffee_profiles (user_id, last_used_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS coffee_profiles_active_idx
  ON public.coffee_profiles (user_id, archived_at)
  WHERE archived_at IS NULL;

CREATE TRIGGER coffee_profiles_updated_at
  BEFORE UPDATE ON public.coffee_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.coffee_profile_images (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coffee_profile_id uuid        NOT NULL,
  user_id           uuid        NOT NULL,
  storage_bucket    text        NOT NULL DEFAULT 'coffee-bag-images',
  storage_path      text        NOT NULL UNIQUE,
  mime_type         text        NOT NULL,
  width             integer     NOT NULL,
  height            integer     NOT NULL,
  size_bytes        integer     NOT NULL,
  sha256            text,
  is_primary        boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coffee_profile_images_profile_owner_fkey
    FOREIGN KEY (coffee_profile_id, user_id)
    REFERENCES public.coffee_profiles(id, user_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS coffee_profile_images_primary_unique
  ON public.coffee_profile_images (coffee_profile_id)
  WHERE is_primary = true;

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS coffee_profile_id uuid,
  ADD COLUMN IF NOT EXISTS coffee_profile_user_id uuid,
  ADD COLUMN IF NOT EXISTS generation_context jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipes_coffee_profile_owner_fkey'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_coffee_profile_owner_fkey
      FOREIGN KEY (coffee_profile_id, coffee_profile_user_id)
      REFERENCES public.coffee_profiles(id, user_id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.coffee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_profile_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coffee_profiles'
      AND policyname = 'coffee_profiles: owner only'
  ) THEN
    CREATE POLICY "coffee_profiles: owner only"
      ON public.coffee_profiles
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coffee_profile_images'
      AND policyname = 'coffee_profile_images: owner only'
  ) THEN
    CREATE POLICY "coffee_profile_images: owner only"
      ON public.coffee_profile_images
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
