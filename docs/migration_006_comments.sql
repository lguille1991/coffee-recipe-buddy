-- Migration 006: recipe_comments table
-- Phase B: Comments on shared recipes

CREATE TABLE public.recipe_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token  text        NOT NULL REFERENCES public.shared_recipes(share_token) ON DELETE CASCADE,
  author_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body         text        NOT NULL CHECK (length(body) >= 1 AND length(body) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipe_comments_share_token_idx
  ON public.recipe_comments (share_token, created_at ASC);

ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can read comments for any share token
CREATE POLICY "recipe_comments: public read"
  ON public.recipe_comments FOR SELECT
  USING (true);

-- Authenticated users can insert their own comments
CREATE POLICY "recipe_comments: auth insert"
  ON public.recipe_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

-- Authors can delete only their own comments
CREATE POLICY "recipe_comments: author delete"
  ON public.recipe_comments FOR DELETE
  USING (author_id = auth.uid());
