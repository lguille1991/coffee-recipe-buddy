-- Migration 004 — Recipe Sharing
-- Run this in the Supabase SQL Editor after migration_003.

-- ─── shared_recipes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shared_recipes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id     uuid        NOT NULL REFERENCES public.recipes(id)  ON DELETE CASCADE,
  snapshot_json jsonb       NOT NULL,          -- copy of current_recipe_json + bean_info + image_url + owner_display_name at share time
  share_token   text        UNIQUE NOT NULL,   -- short random slug, e.g. 16-char hex
  title         text,                          -- optional display name set by sharer
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One active share per recipe
CREATE UNIQUE INDEX IF NOT EXISTS shared_recipes_recipe_unique_idx ON public.shared_recipes (recipe_id);
CREATE        INDEX IF NOT EXISTS shared_recipes_token_idx         ON public.shared_recipes (share_token);
CREATE        INDEX IF NOT EXISTS shared_recipes_owner_idx         ON public.shared_recipes (owner_id);

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.shared_recipes ENABLE ROW LEVEL SECURITY;

-- Owner can create share links for their own recipes
CREATE POLICY "shared_recipes: owner insert"
  ON public.shared_recipes
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Owner can revoke their own share links
CREATE POLICY "shared_recipes: owner delete"
  ON public.shared_recipes
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Anyone (including unauthenticated / anon role) can read by share_token
CREATE POLICY "shared_recipes: public read"
  ON public.shared_recipes
  FOR SELECT
  USING (true);
