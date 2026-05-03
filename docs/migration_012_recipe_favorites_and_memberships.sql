-- Migration 012 — Recipient memberships + per-user recipe favorites
-- Supports: shared-with-me list, remove-from-my-list, and per-user favorites.

-- ─── Recipient-based sharing membership ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipe_share_memberships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     uuid        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  owner_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  hidden_at     timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_share_memberships_recipe_recipient_unique_idx
  ON public.recipe_share_memberships (recipe_id, recipient_id);
CREATE INDEX IF NOT EXISTS recipe_share_memberships_recipient_hidden_idx
  ON public.recipe_share_memberships (recipient_id, hidden_at, created_at DESC);
CREATE INDEX IF NOT EXISTS recipe_share_memberships_owner_idx
  ON public.recipe_share_memberships (owner_id);

ALTER TABLE public.recipe_share_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_share_memberships: owner insert"
  ON public.recipe_share_memberships
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "recipe_share_memberships: recipient read"
  ON public.recipe_share_memberships
  FOR SELECT
  USING (auth.uid() = recipient_id OR auth.uid() = owner_id);

CREATE POLICY "recipe_share_memberships: recipient hide"
  ON public.recipe_share_memberships
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "recipe_share_memberships: owner delete"
  ON public.recipe_share_memberships
  FOR DELETE
  USING (auth.uid() = owner_id);

-- ─── Per-user favorites ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipe_user_favorites (
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipe_id   uuid        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS recipe_user_favorites_recipe_idx
  ON public.recipe_user_favorites (recipe_id);
CREATE INDEX IF NOT EXISTS recipe_user_favorites_user_created_idx
  ON public.recipe_user_favorites (user_id, created_at DESC);

ALTER TABLE public.recipe_user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipe_user_favorites: owner select"
  ON public.recipe_user_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recipe_user_favorites: owner insert"
  ON public.recipe_user_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recipe_user_favorites: owner delete"
  ON public.recipe_user_favorites
  FOR DELETE
  USING (auth.uid() = user_id);
