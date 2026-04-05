-- Migration 003: Add timemore_c2 to preferred_grinder allowed values
-- Run this against your Supabase project SQL editor.

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_preferred_grinder_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_grinder_check
  CHECK (preferred_grinder IN ('k_ultra', 'q_air', 'baratza_encore_esp', 'timemore_c2'));
