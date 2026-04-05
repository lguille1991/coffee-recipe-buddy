-- Migration 002: Add preferred_grinder to profiles
-- Run this against your Supabase project SQL editor.

ALTER TABLE public.profiles
  ADD COLUMN preferred_grinder text NOT NULL DEFAULT 'k_ultra'
  CHECK (preferred_grinder IN ('k_ultra', 'q_air', 'baratza_encore_esp'));
