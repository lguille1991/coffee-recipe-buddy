-- Migration 001 — Phase 3 initial schema
-- Run this in the Supabase SQL Editor after creating your project.

-- ─── profiles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      text,
  default_volume_ml integer     NOT NULL DEFAULT 250,
  temp_unit         text        NOT NULL DEFAULT 'C' CHECK (temp_unit IN ('C', 'F')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ─── recipes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schema_version        integer     NOT NULL DEFAULT 1,
  bean_info             jsonb       NOT NULL DEFAULT '{}',
  method                text        NOT NULL,
  original_recipe_json  jsonb       NOT NULL DEFAULT '{}',
  current_recipe_json   jsonb       NOT NULL DEFAULT '{}',
  feedback_history      jsonb       NOT NULL DEFAULT '[]',
  image_url             text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  archived              boolean     NOT NULL DEFAULT false
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS recipes_user_created_idx  ON public.recipes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recipes_user_method_idx   ON public.recipes (user_id, method);
CREATE INDEX IF NOT EXISTS recipes_bean_info_gin_idx ON public.recipes USING gin (bean_info);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes  ENABLE ROW LEVEL SECURITY;

-- profiles: all ops restricted to the owner
CREATE POLICY "profiles: owner only" ON public.profiles
  FOR ALL
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- recipes: all ops restricted to the owner
CREATE POLICY "recipes: owner only" ON public.recipes
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
