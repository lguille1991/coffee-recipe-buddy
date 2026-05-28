-- Migration 013: allow Fellow Opus as a persisted preferred grinder value.
--
-- Apply in Supabase SQL editor.

alter table public.profiles
  drop constraint if exists profiles_preferred_grinder_check;

alter table public.profiles
  add constraint profiles_preferred_grinder_check
  check (preferred_grinder in ('k_ultra', 'fellow_opus', 'q_air', 'baratza_encore_esp', 'timemore_c2'));
