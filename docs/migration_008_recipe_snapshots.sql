-- Migration 008: immutable recipe snapshots

CREATE TABLE IF NOT EXISTS public.recipe_snapshots (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id          uuid        NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_index     integer     NOT NULL CHECK (snapshot_index > 0),
  snapshot_kind      text        NOT NULL CHECK (snapshot_kind IN ('initial', 'manual_edit', 'auto_adjust', 'clone')),
  snapshot_recipe_json jsonb     NOT NULL DEFAULT '{}',
  change_summary     jsonb       NOT NULL DEFAULT '[]',
  created_at         timestamptz NOT NULL DEFAULT now(),
  source_snapshot_id uuid        REFERENCES public.recipe_snapshots(id) ON DELETE SET NULL,
  UNIQUE (recipe_id, snapshot_index)
);

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS live_snapshot_id uuid;

CREATE INDEX IF NOT EXISTS recipe_snapshots_recipe_idx
  ON public.recipe_snapshots (recipe_id, snapshot_index DESC);

CREATE INDEX IF NOT EXISTS recipe_snapshots_user_idx
  ON public.recipe_snapshots (user_id, created_at DESC);

INSERT INTO public.recipe_snapshots (
  recipe_id,
  user_id,
  snapshot_index,
  snapshot_kind,
  snapshot_recipe_json,
  change_summary,
  created_at
)
SELECT
  r.id,
  r.user_id,
  1,
  'initial',
  r.current_recipe_json,
  '[]'::jsonb,
  r.created_at
FROM public.recipes r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.recipe_snapshots rs
  WHERE rs.recipe_id = r.id
);

UPDATE public.recipes r
SET live_snapshot_id = rs.id
FROM public.recipe_snapshots rs
WHERE rs.recipe_id = r.id
  AND rs.snapshot_index = (
    SELECT MAX(inner_rs.snapshot_index)
    FROM public.recipe_snapshots inner_rs
    WHERE inner_rs.recipe_id = r.id
  )
  AND r.live_snapshot_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipes_live_snapshot_id_fkey'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_live_snapshot_id_fkey
      FOREIGN KEY (live_snapshot_id)
      REFERENCES public.recipe_snapshots(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.recipe_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_snapshots'
      AND policyname = 'recipe_snapshots: owner read'
  ) THEN
    CREATE POLICY "recipe_snapshots: owner read"
      ON public.recipe_snapshots
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_snapshots'
      AND policyname = 'recipe_snapshots: owner insert'
  ) THEN
    CREATE POLICY "recipe_snapshots: owner insert"
      ON public.recipe_snapshots
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
