-- Migration 007: Auto Adjust — parent recipe linking and scale factor

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS parent_recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scale_factor numeric(4,2);
