# Saved Coffee Profiles Staging Rollout Checklist

## Preconditions
- [ ] Run SQL migration `docs/migration_009_coffee_profiles.sql` in staging.
- [ ] If `migration_010` fails with duplicate-profile conflict, run `docs/migration_010_deduplicate.sql` first.
- [ ] Run SQL migration `docs/migration_010_coffee_profile_duplicate_fingerprint.sql` in staging.
- [ ] Create private Supabase Storage bucket `coffee-bag-images` in staging.
- [ ] Ensure Storage RLS/policies allow only authenticated owner paths under `users/{user_id}/...`.
- [ ] Set env flag `NEXT_PUBLIC_ENABLE_SAVED_COFFEE_PROFILES=true` in staging.
- [ ] Confirm OpenRouter and Supabase env vars are present in staging deployment.

## Smoke Tests
- [ ] Authenticated user can scan a bag and reach analysis page.
- [ ] Analysis confirmation auto-saves a coffee profile (verify row in `coffee_profiles`).
- [ ] Profile image exists in `coffee_profile_images` and object exists in bucket.
- [ ] Saved Coffees list (`/coffees`) renders new profile.
- [ ] Coffee detail page (`/coffees/:id`) loads and shows image.
- [ ] Generate-from-profile creates a new recipe and redirects to recipe detail.
- [ ] Generated recipe row includes `coffee_profile_id` and `generation_context`.
- [ ] Archived profile blocks new generation with clear error.

## Security / Ownership Checks
- [ ] User A cannot fetch User B profile IDs via `/api/coffee-profiles/:id`.
- [ ] User A cannot upload/replace image for User B profile.
- [ ] User A cannot generate from User B profile ID.

## Failure / Recovery Checks
- [ ] Unsupported image type upload returns `415`.
- [ ] Invalid `from-profile` payload returns `400`.
- [ ] Feature flag OFF returns `404` for profile APIs and `/api/recipes/from-profile`.

## Observability Checks
- [ ] No sustained 5xx increase on `coffee-profiles` routes.
- [ ] No sustained 5xx increase on `/api/recipes/from-profile`.
- [ ] Storage object count growth aligns with profile creation volume.

## Production Go/No-Go
- [ ] All checks above pass in staging.
- [ ] QA sign-off complete.
- [ ] Product sign-off complete.
- [ ] Production env flag rollout plan approved.
