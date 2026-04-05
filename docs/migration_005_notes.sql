-- migration_005_notes.sql
-- Adds freeform notes field to saved recipes.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS notes text;
