# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
npm run test     # Vitest
```

Requires `OPENROUTER_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (see `.env.example`).

`NEXT_PUBLIC_APP_VERSION` is optional but used by the settings page to display the in-app version label.

## Architecture

**Coffee Recipe Buddy** (package name: `crp`) is a mobile-first Next.js 16 (App Router) coffee recipe app.

### User flows

```
/ (home) → /scan → /analysis → /methods → /recipe        ← image-first flow
/ (home) → /manual → /methods → /recipe                  ← manual entry flow
/recipes → /recipes/[id]                                  ← saved recipe detail
/share/[token]                                            ← public shared recipe view
/auth                                                     ← sign in / sign up
/settings                                                 ← preferences
```

### Session state (unauthenticated flow)

State is passed between pages via `sessionStorage`. No global state manager.

| Key stored | Set by | Read by |
|---|---|---|
| `extractionResult` | `/scan` after API call | `/analysis` |
| `confirmedBean` | `/analysis` on confirm | `/methods` |
| `methodRecommendations` | `/analysis` (client-side) | `/methods` |
| `recipe` | `/methods` after API call | `/recipe` |

### Persistence (Supabase)

Auth, recipe storage, and sharing all use Supabase (Postgres + Auth + Storage).

- **Auth**: email/password + Google OAuth via Supabase Auth; session via `@supabase/ssr` with httpOnly cookies
- **Google profile sync**: Google OAuth names are copied from Supabase auth metadata into `profiles.display_name` when the profile row is blank
- **`recipes` table**: stores full recipe JSON (`original_recipe_json`, `current_recipe_json`), bean info, feedback history, image URL, schema version, notes, archived flag
- **`profiles` table**: display name, default volume, temperature unit preference
- **`shared_recipes` table**: public share token → snapshot JSON + owner metadata
- **`recipe_comments` table**: public comments on shared recipes (author linked to profiles)

Supabase client setup:
- `src/lib/supabase/client.ts` — browser client
- `src/lib/supabase/server.ts` — server client (for API routes and Server Components)
- `src/lib/supabase/middleware.ts` — session refresh middleware

### API routes

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/extract-bean` | No | Vision extraction of bean info from image |
| `POST /api/generate-recipe` | No | LLM recipe generation (retries up to 2×) |
| `POST /api/adjust-recipe` | No | Deterministic Block 9 feedback adjustment |
| `GET /api/recipes` | Required | List saved recipes (paginated, filterable) |
| `POST /api/recipes` | Required | Save a recipe |
| `GET /api/recipes/[id]` | Required | Single recipe detail |
| `PATCH /api/recipes/[id]` | Required | Update recipe + append feedback round |
| `POST /api/recipes/[id]/auto-adjust` | Required | Scale and/or LLM-adjust a saved recipe; pure-scale path is deterministic and recalculates all grinder settings via a per-scale click offset |
| `DELETE /api/recipes/[id]` | Required | Soft-delete (archive) |
| `GET /api/recipes/[id]/share` | Required | Get existing share token/URL |
| `POST /api/recipes/[id]/share` | Required | Create share link (idempotent) |
| `DELETE /api/recipes/[id]/share` | Required | Revoke share link |
| `GET /api/share/[token]` | No | Public snapshot for shared recipe |
| `GET /api/share/[token]/comments` | No | Paginated comments (50/page) |
| `POST /api/share/[token]/comments` | Required | Post a comment |
| `DELETE /api/share/[token]/comments/[id]` | Required | Delete own comment |
| `POST /api/share/[token]/clone` | Required | Clone a shared recipe into own library |
| `GET /api/profile` | Required | Get user preferences |
| `PATCH /api/profile` | Required | Update preferences |

LLM routes use OpenRouter (OpenAI-compatible SDK, `baseURL: https://openrouter.ai/api/v1`). `POST /api/recipes/[id]/auto-adjust` tries `google/gemma-4-31b-it:free` first and falls back to `openai/gpt-5-nano`; the other LLM routes remain on `google/gemini-2.0-flash-001`.
OpenRouter request attribution and analytics metadata are centralized in `src/lib/openrouter.ts`; use that helper instead of constructing ad hoc OpenRouter clients in route handlers.

### Key lib modules

- `src/lib/method-decision-engine.ts` — pure scoring engine: takes `BeanProfile`, returns top-3 `MethodRecommendation[]` ranked by process/roast/variety/flavor/altitude rules. Runs **client-side** in `/analysis`.
- `src/lib/grinder-converter.ts` — converts K-Ultra clicks ↔ microns ↔ Q-Air settings ↔ Baratza Encore ESP clicks ↔ Timemore C2 clicks. K-Ultra is the primary reference; all others convert through microns via piecewise-linear tables.
- `src/lib/adjustment-engine.ts` — Block 9 feedback rules + Block 10 conflict checks. One variable per round, clamped within `final_operating_range`. Used by `/api/adjust-recipe`.
- `src/lib/freshness-recalculator.ts` — client-side freshness recalculation on re-brew. Compares saved `freshness_offset` to today's window; applies grind/temp delta if the window has shifted.
- `src/lib/recipe-migrations.ts` — schema version migration transforms (run on read when `schema_version` is behind).
- `src/lib/prompt-builder.ts` — builds system/user prompts for both LLM API routes.
- `src/lib/recipe-validator.ts` — validates `Recipe` JSON and builds retry prompts.
- `src/lib/image-compressor.ts` — client-side image compression before upload.
- `src/lib/openrouter.ts` — shared OpenRouter client factory, referer/title headers, authenticated and guest analytics user IDs.
- `src/lib/auth-profile.ts` — syncs `profiles.display_name` from Supabase auth metadata for Google/email auth users.

### Hooks

- `src/hooks/useAuth.ts` — Supabase auth state (user, session, sign-in, sign-out)
- `src/hooks/useProfile.ts` — user profile preferences with local optimistic update
- `src/hooks/useTheme.ts` — theme preference (system/light/dark)

### Key components

- `src/components/NavGuardContext.tsx` — `NavGuardProvider` + `useNavGuard` hook. Pages call `setGuard(fn)` to register a navigation blocker (e.g. unsaved edits); `BottomNav` calls `requestNavigate(href)` so the guard can intercept. Provider is mounted in the root layout wrapping everything.

### Types

All domain types live in `src/types/recipe.ts` and are defined as Zod schemas with inferred TypeScript types. Supported brew methods: `v60`, `origami`, `orea_v4`, `hario_switch`, `kalita_wave`, `chemex`, `ceado_hoop`, `pulsar`, `aeropress`.

`total_time` accepts either a single time (`3:30`) or a range (`3:30 – 4:00`), both in `m:ss` format.

### Styling

Tailwind CSS v4 with no custom config file — configuration is inline via CSS variables. Fixed palette: `#333333` (primary), `#5B5F66` / `#6B6B6B` (secondary text), `#F5F4F2` (background), `#E1E2E5` (borders). All screens are `max-w-sm mx-auto` mobile-first.

## Phase docs

Product specs for each phase live in the repo root:

- `phase1_image_first_range_system.md` — completed
- `phase2_feedback_block9_manual_fallback.md` — completed
- `phase3_persistence_accounts_final.md` — completed (auth, recipes CRUD, sharing, comments, clone, re-brew freshness)

## Versioning

The app version is stored in `package.json`. **Always bump the version before committing changes** using Semantic Versioning (SemVer):

| Bump | Trigger | Examples |
|------|---------|----------|
| **MAJOR** (X.0.0) | Breaking user-facing changes | API route removals, database migrations breaking backward compatibility, auth flow changes, removed features |
| **MINOR** (0.X.0) | New features / enhancements | New API endpoints, new brew methods, new UI flows, new settings/options, non-breaking additions |
| **PATCH** (0.0.X) | Fixes / refinements | Bug fixes, typo corrections, styling tweaks, performance improvements, refactors with no behavior change |

**When to skip**: Documentation-only changes (README updates), test additions, dependency updates with no API changes.

**How to bump**: Edit `package.json` directly and update the `"version"` field.

## Commit Message Suggestion

When an AI agent finishes implementing a plan, it must always include at least one concise suggested commit message in its final handoff.

## Plan Mode Output

When operating in **plan mode**, AI coding agents MUST ALWAYS store generated output as an `.md` file in `.claude/plans/` directory. The output MUST be in **checklist format** with actionable items that can be tracked and checked off during implementation.

<!-- autoskills:start -->

Summary generated by `autoskills`. Check the full files inside `.claude/skills`.

## Accessibility (a11y)

Audit and improve web accessibility following WCAG 2.2 guidelines. Use when asked to "improve accessibility", "a11y audit", "WCAG compliance", "screen reader support", "keyboard navigation", or "make accessible".

- `.claude/skills/accessibility/SKILL.md`
- `.claude/skills/accessibility/references/A11Y-PATTERNS.md`: Practical, copy-paste-ready patterns for common accessibility requirements. Each pattern is self-contained and linked from the main [SKILL.md](../SKILL.md).
- `.claude/skills/accessibility/references/WCAG.md`

## Design Thinking

Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beaut...

- `.claude/skills/frontend-design/SKILL.md`

## Next.js Best Practices

Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling

- `.claude/skills/next-best-practices/SKILL.md`
- `.claude/skills/next-best-practices/async-patterns.md`: In Next.js 15+, `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous.
- `.claude/skills/next-best-practices/bundling.md`: Fix common bundling issues with third-party packages.
- `.claude/skills/next-best-practices/data-patterns.md`: Choose the right data fetching pattern for each use case.
- `.claude/skills/next-best-practices/debug-tricks.md`: Tricks to speed up debugging Next.js applications.
- `.claude/skills/next-best-practices/directives.md`: These are React directives, not Next.js specific.
- `.claude/skills/next-best-practices/error-handling.md`: Handle errors gracefully in Next.js applications.
- `.claude/skills/next-best-practices/file-conventions.md`: Next.js App Router uses file-based routing with special file conventions.
- `.claude/skills/next-best-practices/font.md`: Use `next/font` for automatic font optimization with zero layout shift.
- `.claude/skills/next-best-practices/functions.md`: Next.js function APIs.
- `.claude/skills/next-best-practices/hydration-error.md`: Diagnose and fix React hydration mismatch errors.
- `.claude/skills/next-best-practices/image.md`: Use `next/image` for automatic image optimization.
- `.claude/skills/next-best-practices/metadata.md`: Add SEO metadata to Next.js pages using the Metadata API.
- `.claude/skills/next-best-practices/parallel-routes.md`: Parallel routes render multiple pages in the same layout. Intercepting routes show a different UI when navigating from within your app vs direct URL access. Together they enable modal patterns.
- `.claude/skills/next-best-practices/route-handlers.md`: Create API endpoints with `route.ts` files.
- `.claude/skills/next-best-practices/rsc-boundaries.md`: Detect and prevent invalid patterns when crossing Server/Client component boundaries.
- `.claude/skills/next-best-practices/runtime-selection.md`: Use the default Node.js runtime for new routes and pages. Only use Edge runtime if the project already uses it or there's a specific requirement.
- `.claude/skills/next-best-practices/scripts.md`: Loading third-party scripts in Next.js.
- `.claude/skills/next-best-practices/self-hosting.md`: Deploy Next.js outside of Vercel with confidence.
- `.claude/skills/next-best-practices/suspense-boundaries.md`: Client hooks that cause CSR bailout without Suspense boundaries.

## Cache Components (Next.js 16+)

Next.js 16 Cache Components - PPR, use cache directive, cacheLife, cacheTag, updateTag

- `.claude/skills/next-cache-components/SKILL.md`

## Upgrade Next.js

Upgrade Next.js to the latest version following official migration guides and codemods

- `.claude/skills/next-upgrade/SKILL.md`

## Node.js Backend Patterns

Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.

- `.claude/skills/nodejs-backend-patterns/SKILL.md`
- `.claude/skills/nodejs-backend-patterns/references/advanced-patterns.md`: Advanced patterns for dependency injection, database integration, authentication, caching, and API response formatting.

## Node.js Best Practices

Node.js development principles and decision-making. Framework selection, async patterns, security, and architecture. Teaches thinking, not copying.

- `.claude/skills/nodejs-best-practices/SKILL.md`

## SEO optimization

Optimize for search engine visibility and ranking. Use when asked to "improve SEO", "optimize for search", "fix meta tags", "add structured data", "sitemap optimization", or "search engine optimization".

- `.claude/skills/seo/SKILL.md`

## Supabase Postgres Best Practices

Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations.

- `.claude/skills/supabase-postgres-best-practices/SKILL.md`
- `.claude/skills/supabase-postgres-best-practices/AGENTS.md`: Comprehensive performance optimization guide for Postgres, maintained by Supabase. Contains rules across 8 categories, prioritized by impact to guide automated query optimization and schema design.
- `.claude/skills/supabase-postgres-best-practices/CLAUDE.md`: Comprehensive performance optimization guide for Postgres, maintained by Supabase. Contains rules across 8 categories, prioritized by impact to guide automated query optimization and schema design.
- `.claude/skills/supabase-postgres-best-practices/README.md`: This skill contains Postgres performance optimization references optimized for AI agents and LLMs. It follows the [Agent Skills Open Standard](https://agentskills.io/).
- `.claude/skills/supabase-postgres-best-practices/references/_contributing.md`: This document provides guidelines for creating effective Postgres best practice references that work well with AI agents and LLMs.
- `.claude/skills/supabase-postgres-best-practices/references/_sections.md`: This file defines the rule categories for Postgres best practices. Rules are automatically assigned to sections based on their filename prefix.
- `.claude/skills/supabase-postgres-best-practices/references/_template.md`: [1-2 sentence explanation of the problem and why it matters. Focus on performance impact.]
- `.claude/skills/supabase-postgres-best-practices/references/advanced-full-text-search.md`: LIKE with wildcards can't use indexes. Full-text search with tsvector is orders of magnitude faster.
- `.claude/skills/supabase-postgres-best-practices/references/advanced-jsonb-indexing.md`: JSONB queries without indexes scan the entire table. Use GIN indexes for containment queries.
- `.claude/skills/supabase-postgres-best-practices/references/conn-idle-timeout.md`: Idle connections waste resources. Configure timeouts to automatically reclaim them.
- `.claude/skills/supabase-postgres-best-practices/references/conn-limits.md`: Too many connections exhaust memory and degrade performance. Set limits based on available resources.
- `.claude/skills/supabase-postgres-best-practices/references/conn-pooling.md`: Postgres connections are expensive (1-3MB RAM each). Without pooling, applications exhaust connections under load.
- `.claude/skills/supabase-postgres-best-practices/references/conn-prepared-statements.md`: Prepared statements are tied to individual database connections. In transaction-mode pooling, connections are shared, causing conflicts.
- `.claude/skills/supabase-postgres-best-practices/references/data-batch-inserts.md`: Individual INSERT statements have high overhead. Batch multiple rows in single statements or use COPY.
- `.claude/skills/supabase-postgres-best-practices/references/data-n-plus-one.md`: N+1 queries execute one query per item in a loop. Batch them into a single query using arrays or JOINs.
- `.claude/skills/supabase-postgres-best-practices/references/data-pagination.md`: OFFSET-based pagination scans all skipped rows, getting slower on deeper pages. Cursor pagination is O(1).
- `.claude/skills/supabase-postgres-best-practices/references/data-upsert.md`: Using separate SELECT-then-INSERT/UPDATE creates race conditions. Use INSERT ... ON CONFLICT for atomic upserts.
- `.claude/skills/supabase-postgres-best-practices/references/lock-advisory.md`: Advisory locks provide application-level coordination without requiring database rows to lock.
- `.claude/skills/supabase-postgres-best-practices/references/lock-deadlock-prevention.md`: Deadlocks occur when transactions lock resources in different orders. Always acquire locks in a consistent order.
- `.claude/skills/supabase-postgres-best-practices/references/lock-short-transactions.md`: Long-running transactions hold locks that block other queries. Keep transactions as short as possible.
- `.claude/skills/supabase-postgres-best-practices/references/lock-skip-locked.md`: When multiple workers process a queue, SKIP LOCKED allows workers to process different rows without waiting.
- `.claude/skills/supabase-postgres-best-practices/references/monitor-explain-analyze.md`: EXPLAIN ANALYZE executes the query and shows actual timings, revealing the true performance bottlenecks.
- `.claude/skills/supabase-postgres-best-practices/references/monitor-pg-stat-statements.md`: pg_stat_statements tracks execution statistics for all queries, helping identify slow and frequent queries.
- `.claude/skills/supabase-postgres-best-practices/references/monitor-vacuum-analyze.md`: Outdated statistics cause the query planner to make poor decisions. VACUUM reclaims space, ANALYZE updates statistics.
- `.claude/skills/supabase-postgres-best-practices/references/query-composite-indexes.md`: When queries filter on multiple columns, a composite index is more efficient than separate single-column indexes.
- `.claude/skills/supabase-postgres-best-practices/references/query-covering-indexes.md`: Covering indexes include all columns needed by a query, enabling index-only scans that skip the table entirely.
- `.claude/skills/supabase-postgres-best-practices/references/query-index-types.md`: Different index types excel at different query patterns. The default B-tree isn't always optimal.
- `.claude/skills/supabase-postgres-best-practices/references/query-missing-indexes.md`: Queries filtering or joining on unindexed columns cause full table scans, which become exponentially slower as tables grow.
- `.claude/skills/supabase-postgres-best-practices/references/query-partial-indexes.md`: Partial indexes only include rows matching a WHERE condition, making them smaller and faster when queries consistently filter on the same condition.
- `.claude/skills/supabase-postgres-best-practices/references/schema-constraints.md`: PostgreSQL does not support `ADD CONSTRAINT IF NOT EXISTS`. Migrations using this syntax will fail.
- `.claude/skills/supabase-postgres-best-practices/references/schema-data-types.md`: Using the right data types reduces storage, improves query performance, and prevents bugs.
- `.claude/skills/supabase-postgres-best-practices/references/schema-foreign-key-indexes.md`: Postgres does not automatically index foreign key columns. Missing indexes cause slow JOINs and CASCADE operations.
- `.claude/skills/supabase-postgres-best-practices/references/schema-lowercase-identifiers.md`: PostgreSQL folds unquoted identifiers to lowercase. Quoted mixed-case identifiers require quotes forever and cause issues with tools, ORMs, and AI assistants that may not recognize them.
- `.claude/skills/supabase-postgres-best-practices/references/schema-partitioning.md`: Partitioning splits a large table into smaller pieces, improving query performance and maintenance operations.
- `.claude/skills/supabase-postgres-best-practices/references/schema-primary-keys.md`: Primary key choice affects insert performance, index size, and replication efficiency.
- `.claude/skills/supabase-postgres-best-practices/references/security-privileges.md`: Grant only the minimum permissions required. Never use superuser for application queries.
- `.claude/skills/supabase-postgres-best-practices/references/security-rls-basics.md`: Row Level Security (RLS) enforces data access at the database level, ensuring users only see their own data.
- `.claude/skills/supabase-postgres-best-practices/references/security-rls-performance.md`: Poorly written RLS policies can cause severe performance issues. Use subqueries and indexes strategically.

## Tailwind CSS Development Patterns

Provides comprehensive Tailwind CSS utility-first styling patterns including responsive design, layout utilities, flexbox, grid, spacing, typography, colors, and modern CSS best practices. Use when styling React/Vue/Svelte components, building responsive layouts, implementing design systems, or o...

- `.claude/skills/tailwind-css-patterns/SKILL.md`
- `.claude/skills/tailwind-css-patterns/references/accessibility.md`
- `.claude/skills/tailwind-css-patterns/references/animations.md`: Usage:
- `.claude/skills/tailwind-css-patterns/references/component-patterns.md`
- `.claude/skills/tailwind-css-patterns/references/configuration.md`: Use the `@theme` directive for CSS-based configuration:
- `.claude/skills/tailwind-css-patterns/references/layout-patterns.md`: Basic flex container:
- `.claude/skills/tailwind-css-patterns/references/performance.md`: Configure content sources for optimal purging:
- `.claude/skills/tailwind-css-patterns/references/reference.md`: Tailwind CSS is a utility-first CSS framework that generates styles by scanning HTML, JavaScript, and template files for class names. It provides a comprehensive design system through CSS utility classes, enabling rapid UI development without writing custom CSS. The framework operates at build-ti...
- `.claude/skills/tailwind-css-patterns/references/responsive-design.md`: Enable dark mode in tailwind.config.js:

## TypeScript Advanced Types

Master TypeScript's advanced type system including generics, conditional types, mapped types, template literals, and utility types for building type-safe applications. Use when implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript pr...

- `.claude/skills/typescript-advanced-types/SKILL.md`

## React Composition Patterns

Composition patterns for building flexible, maintainable React components. Avoid boolean prop proliferation by using compound components, lifting state, and composing internals. These patterns make codebases easier for both humans and AI agents to work with as they scale.

- `.claude/skills/vercel-composition-patterns/SKILL.md`
- `.claude/skills/vercel-composition-patterns/AGENTS.md`: **Version 1.0.0** Engineering January 2026
- `.claude/skills/vercel-composition-patterns/README.md`: A structured repository for React composition patterns that scale. These patterns help avoid boolean prop proliferation by using compound components, lifting state, and composing internals.
- `.claude/skills/vercel-composition-patterns/rules/_sections.md`: This file defines all sections, their ordering, impact levels, and descriptions. The section ID (in parentheses) is the filename prefix used to group rules.
- `.claude/skills/vercel-composition-patterns/rules/_template.md`: Brief explanation of the rule and why it matters.
- `.claude/skills/vercel-composition-patterns/rules/architecture-avoid-boolean-props.md`: Don't add boolean props like `isThread`, `isEditing`, `isDMThread` to customize component behavior. Each boolean doubles possible states and creates unmaintainable conditional logic. Use composition instead.
- `.claude/skills/vercel-composition-patterns/rules/architecture-compound-components.md`: Structure complex components as compound components with a shared context. Each subcomponent accesses shared state via context, not props. Consumers compose the pieces they need.
- `.claude/skills/vercel-composition-patterns/rules/patterns-children-over-render-props.md`: Use `children` for composition instead of `renderX` props. Children are more readable, compose naturally, and don't require understanding callback signatures.
- `.claude/skills/vercel-composition-patterns/rules/patterns-explicit-variants.md`: Instead of one component with many boolean props, create explicit variant components. Each variant composes the pieces it needs. The code documents itself.
- `.claude/skills/vercel-composition-patterns/rules/react19-no-forwardref.md`: In React 19, `ref` is now a regular prop (no `forwardRef` wrapper needed), and `use()` replaces `useContext()`.
- `.claude/skills/vercel-composition-patterns/rules/state-context-interface.md`: Define a **generic interface** for your component context with three parts: can implement—enabling the same UI components to work with completely different state implementations.
- `.claude/skills/vercel-composition-patterns/rules/state-decouple-implementation.md`: The provider component should be the only place that knows how state is managed. UI components consume the context interface—they don't know if state comes from useState, Zustand, or a server sync.
- `.claude/skills/vercel-composition-patterns/rules/state-lift-state.md`: Move state management into dedicated provider components. This allows sibling components outside the main UI to access and modify state without prop drilling or awkward refs.

## Vercel React Best Practices

React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimizati...

- `.claude/skills/vercel-react-best-practices/SKILL.md`
- `.claude/skills/vercel-react-best-practices/AGENTS.md`: **Version 1.0.0** Vercel Engineering January 2026
- `.claude/skills/vercel-react-best-practices/README.md`: A structured repository for creating and maintaining React Best Practices optimized for agents and LLMs.
- `.claude/skills/vercel-react-best-practices/rules/_sections.md`: This file defines all sections, their ordering, impact levels, and descriptions. The section ID (in parentheses) is the filename prefix used to group rules.
- `.claude/skills/vercel-react-best-practices/rules/_template.md`: **Impact: MEDIUM (optional impact description)**
- `.claude/skills/vercel-react-best-practices/rules/advanced-effect-event-deps.md`: Effect Event functions do not have a stable identity. Their identity intentionally changes on every render. Do not include the function returned by `useEffectEvent` in a `useEffect` dependency array. Keep the actual reactive values as dependencies and call the Effect Event from inside the effect...
- `.claude/skills/vercel-react-best-practices/rules/advanced-event-handler-refs.md`: Store callbacks in refs when used in effects that shouldn't re-subscribe on callback changes.
- `.claude/skills/vercel-react-best-practices/rules/advanced-init-once.md`: Do not put app-wide initialization that must run once per app load inside `useEffect([])` of a component. Components can remount and effects will re-run. Use a module-level guard or top-level init in the entry module instead.
- `.claude/skills/vercel-react-best-practices/rules/advanced-use-latest.md`: Access latest values in callbacks without adding them to dependency arrays. Prevents effect re-runs while avoiding stale closures.
- `.claude/skills/vercel-react-best-practices/rules/async-api-routes.md`: In API routes and Server Actions, start independent operations immediately, even if you don't await them yet.
- `.claude/skills/vercel-react-best-practices/rules/async-cheap-condition-before-await.md`: When a branch uses `await` for a flag or remote value and also requires a **cheap synchronous** condition (local props, request metadata, already-loaded state), evaluate the cheap condition **first**. Otherwise you pay for the async call even when the compound condition can never be true.
- `.claude/skills/vercel-react-best-practices/rules/async-defer-await.md`: Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.
- `.claude/skills/vercel-react-best-practices/rules/async-dependencies.md`: For operations with partial dependencies, use `better-all` to maximize parallelism. It automatically starts each task at the earliest possible moment.
- `.claude/skills/vercel-react-best-practices/rules/async-parallel.md`: When async operations have no interdependencies, execute them concurrently using `Promise.all()`.
- `.claude/skills/vercel-react-best-practices/rules/async-suspense-boundaries.md`: Instead of awaiting data in async components before returning JSX, use Suspense boundaries to show the wrapper UI faster while data loads.
- `.claude/skills/vercel-react-best-practices/rules/bundle-barrel-imports.md`: Import directly from source files instead of barrel files to avoid loading thousands of unused modules. **Barrel files** are entry points that re-export multiple modules (e.g., `index.js` that does `export * from './module'`).
- `.claude/skills/vercel-react-best-practices/rules/bundle-conditional.md`: Load large data or modules only when a feature is activated.
- `.claude/skills/vercel-react-best-practices/rules/bundle-defer-third-party.md`: Analytics, logging, and error tracking don't block user interaction. Load them after hydration.
- `.claude/skills/vercel-react-best-practices/rules/bundle-dynamic-imports.md`: Use `next/dynamic` to lazy-load large components not needed on initial render.
- `.claude/skills/vercel-react-best-practices/rules/bundle-preload.md`: Preload heavy bundles before they're needed to reduce perceived latency.
- `.claude/skills/vercel-react-best-practices/rules/client-event-listeners.md`: Use `useSWRSubscription()` to share global event listeners across component instances.
- `.claude/skills/vercel-react-best-practices/rules/client-localstorage-schema.md`: Add version prefix to keys and store only needed fields. Prevents schema conflicts and accidental storage of sensitive data.
- `.claude/skills/vercel-react-best-practices/rules/client-passive-event-listeners.md`: Add `{ passive: true }` to touch and wheel event listeners to enable immediate scrolling. Browsers normally wait for listeners to finish to check if `preventDefault()` is called, causing scroll delay.
- `.claude/skills/vercel-react-best-practices/rules/client-swr-dedup.md`: SWR enables request deduplication, caching, and revalidation across component instances.
- `.claude/skills/vercel-react-best-practices/rules/js-batch-dom-css.md`: Avoid interleaving style writes with layout reads. When you read a layout property (like `offsetWidth`, `getBoundingClientRect()`, or `getComputedStyle()`) between style changes, the browser is forced to trigger a synchronous reflow.
- `.claude/skills/vercel-react-best-practices/rules/js-cache-function-results.md`: Use a module-level Map to cache function results when the same function is called repeatedly with the same inputs during render.
- `.claude/skills/vercel-react-best-practices/rules/js-cache-property-access.md`: Cache object property lookups in hot paths.
- `.claude/skills/vercel-react-best-practices/rules/js-cache-storage.md`: **Incorrect (reads storage on every call):**
- `.claude/skills/vercel-react-best-practices/rules/js-combine-iterations.md`: Multiple `.filter()` or `.map()` calls iterate the array multiple times. Combine into one loop.
- `.claude/skills/vercel-react-best-practices/rules/js-early-exit.md`: Return early when result is determined to skip unnecessary processing.
- `.claude/skills/vercel-react-best-practices/rules/js-flatmap-filter.md`: **Impact: LOW-MEDIUM (eliminates intermediate array)**
- `.claude/skills/vercel-react-best-practices/rules/js-hoist-regexp.md`: Don't create RegExp inside render. Hoist to module scope or memoize with `useMemo()`.
- `.claude/skills/vercel-react-best-practices/rules/js-index-maps.md`: Multiple `.find()` calls by the same key should use a Map.
- `.claude/skills/vercel-react-best-practices/rules/js-length-check-first.md`: When comparing arrays with expensive operations (sorting, deep equality, serialization), check lengths first. If lengths differ, the arrays cannot be equal.
- `.claude/skills/vercel-react-best-practices/rules/js-min-max-loop.md`: Finding the smallest or largest element only requires a single pass through the array. Sorting is wasteful and slower.
- `.claude/skills/vercel-react-best-practices/rules/js-request-idle-callback.md`: **Impact: MEDIUM (keeps UI responsive during background tasks)**
- `.claude/skills/vercel-react-best-practices/rules/js-set-map-lookups.md`: Convert arrays to Set/Map for repeated membership checks.
- `.claude/skills/vercel-react-best-practices/rules/js-tosorted-immutable.md`: **Incorrect (mutates original array):**
- `.claude/skills/vercel-react-best-practices/rules/rendering-activity.md`: Use React's `<Activity>` to preserve state/DOM for expensive components that frequently toggle visibility.
- `.claude/skills/vercel-react-best-practices/rules/rendering-animate-svg-wrapper.md`: Many browsers don't have hardware acceleration for CSS3 animations on SVG elements. Wrap SVG in a `<div>` and animate the wrapper instead.
- `.claude/skills/vercel-react-best-practices/rules/rendering-conditional-render.md`: Use explicit ternary operators (`? :`) instead of `&&` for conditional rendering when the condition can be `0`, `NaN`, or other falsy values that render.
- `.claude/skills/vercel-react-best-practices/rules/rendering-content-visibility.md`: Apply `content-visibility: auto` to defer off-screen rendering.
- `.claude/skills/vercel-react-best-practices/rules/rendering-hoist-jsx.md`: Extract static JSX outside components to avoid re-creation.
- `.claude/skills/vercel-react-best-practices/rules/rendering-hydration-no-flicker.md`: When rendering content that depends on client-side storage (localStorage, cookies), avoid both SSR breakage and post-hydration flickering by injecting a synchronous script that updates the DOM before React hydrates.
- `.claude/skills/vercel-react-best-practices/rules/rendering-hydration-suppress-warning.md`: In SSR frameworks (e.g., Next.js), some values are intentionally different on server vs client (random IDs, dates, locale/timezone formatting). For these *expected* mismatches, wrap the dynamic text in an element with `suppressHydrationWarning` to prevent noisy warnings. Do not use this to hide r...
- `.claude/skills/vercel-react-best-practices/rules/rendering-resource-hints.md`: **Impact: HIGH (reduces load time for critical resources)**
- `.claude/skills/vercel-react-best-practices/rules/rendering-script-defer-async.md`: **Impact: HIGH (eliminates render-blocking)**
- `.claude/skills/vercel-react-best-practices/rules/rendering-svg-precision.md`: Reduce SVG coordinate precision to decrease file size. The optimal precision depends on the viewBox size, but in general reducing precision should be considered.
- `.claude/skills/vercel-react-best-practices/rules/rendering-usetransition-loading.md`: Use `useTransition` instead of manual `useState` for loading states. This provides built-in `isPending` state and automatically manages transitions.
- `.claude/skills/vercel-react-best-practices/rules/rerender-defer-reads.md`: Don't subscribe to dynamic state (searchParams, localStorage) if you only read it inside callbacks.
- `.claude/skills/vercel-react-best-practices/rules/rerender-dependencies.md`: Specify primitive dependencies instead of objects to minimize effect re-runs.
- `.claude/skills/vercel-react-best-practices/rules/rerender-derived-state-no-effect.md`: If a value can be computed from current props/state, do not store it in state or update it in an effect. Derive it during render to avoid extra renders and state drift. Do not set state in effects solely in response to prop changes; prefer derived values or keyed resets instead.
- `.claude/skills/vercel-react-best-practices/rules/rerender-derived-state.md`: Subscribe to derived boolean state instead of continuous values to reduce re-render frequency.
- `.claude/skills/vercel-react-best-practices/rules/rerender-functional-setstate.md`: When updating state based on the current state value, use the functional update form of setState instead of directly referencing the state variable. This prevents stale closures, eliminates unnecessary dependencies, and creates stable callback references.
- `.claude/skills/vercel-react-best-practices/rules/rerender-lazy-state-init.md`: Pass a function to `useState` for expensive initial values. Without the function form, the initializer runs on every render even though the value is only used once.
- `.claude/skills/vercel-react-best-practices/rules/rerender-memo-with-default-value.md`: When memoized component has a default value for some non-primitive optional parameter, such as an array, function, or object, calling the component without that parameter results in broken memoization. This is because new value instances are created on every rerender, and they do not pass strict...
- `.claude/skills/vercel-react-best-practices/rules/rerender-memo.md`: Extract expensive work into memoized components to enable early returns before computation.
- `.claude/skills/vercel-react-best-practices/rules/rerender-move-effect-to-event.md`: If a side effect is triggered by a specific user action (submit, click, drag), run it in that event handler. Do not model the action as state + effect; it makes effects re-run on unrelated changes and can duplicate the action.
- `.claude/skills/vercel-react-best-practices/rules/rerender-no-inline-components.md`: **Impact: HIGH (prevents remount on every render)**
- `.claude/skills/vercel-react-best-practices/rules/rerender-simple-expression-in-memo.md`: When an expression is simple (few logical or arithmetical operators) and has a primitive result type (boolean, number, string), do not wrap it in `useMemo`. Calling `useMemo` and comparing hook dependencies may consume more resources than the expression itself.
- `.claude/skills/vercel-react-best-practices/rules/rerender-split-combined-hooks.md`: When a hook contains multiple independent tasks with different dependencies, split them into separate hooks. A combined hook reruns all tasks when any dependency changes, even if some tasks don't use the changed value.
- `.claude/skills/vercel-react-best-practices/rules/rerender-transitions.md`: Mark frequent, non-urgent state updates as transitions to maintain UI responsiveness.
- `.claude/skills/vercel-react-best-practices/rules/rerender-use-deferred-value.md`: When user input triggers expensive computations or renders, use `useDeferredValue` to keep the input responsive. The deferred value lags behind, allowing React to prioritize the input update and render the expensive result when idle.
- `.claude/skills/vercel-react-best-practices/rules/rerender-use-ref-transient-values.md`: When a value changes frequently and you don't want a re-render on every update (e.g., mouse trackers, intervals, transient flags), store it in `useRef` instead of `useState`. Keep component state for UI; use refs for temporary DOM-adjacent values. Updating a ref does not trigger a re-render.
- `.claude/skills/vercel-react-best-practices/rules/server-after-nonblocking.md`: Use Next.js's `after()` to schedule work that should execute after a response is sent. This prevents logging, analytics, and other side effects from blocking the response.
- `.claude/skills/vercel-react-best-practices/rules/server-auth-actions.md`: **Impact: CRITICAL (prevents unauthorized access to server mutations)**
- `.claude/skills/vercel-react-best-practices/rules/server-cache-lru.md`: **Implementation:**
- `.claude/skills/vercel-react-best-practices/rules/server-cache-react.md`: Use `React.cache()` for server-side request deduplication. Authentication and database queries benefit most.
- `.claude/skills/vercel-react-best-practices/rules/server-dedup-props.md`: **Impact: LOW (reduces network payload by avoiding duplicate serialization)**
- `.claude/skills/vercel-react-best-practices/rules/server-hoist-static-io.md`: **Impact: HIGH (avoids repeated file/network I/O per request)**
- `.claude/skills/vercel-react-best-practices/rules/server-no-shared-module-state.md`: For React Server Components and client components rendered during SSR, avoid using mutable module-level variables to share request-scoped data. Server renders can run concurrently in the same process. If one render writes to shared module state and another render reads it, you can get race condit...
- `.claude/skills/vercel-react-best-practices/rules/server-parallel-fetching.md`: React Server Components execute sequentially within a tree. Restructure with composition to parallelize data fetching.
- `.claude/skills/vercel-react-best-practices/rules/server-parallel-nested-fetching.md`: When fetching nested data in parallel, chain dependent fetches within each item's promise so a slow item doesn't block the rest.
- `.claude/skills/vercel-react-best-practices/rules/server-serialization.md`: The React Server/Client boundary serializes all object properties into strings and embeds them in the HTML response and subsequent RSC requests. This serialized data directly impacts page weight and load time, so **size matters a lot**. Only pass fields that the client actually uses.

## Core

Vitest fast unit testing framework powered by Vite with Jest-compatible API. Use when writing tests, mocking, configuring coverage, or working with test filtering and fixtures.

- `.claude/skills/vitest/SKILL.md`
- `.claude/skills/vitest/GENERATION.md`
- `.claude/skills/vitest/references/advanced-environments.md`: Configure environments like jsdom, happy-dom for browser APIs
- `.claude/skills/vitest/references/advanced-projects.md`: Multi-project configuration for monorepos and different test types
- `.claude/skills/vitest/references/advanced-type-testing.md`: Test TypeScript types with expectTypeOf and assertType
- `.claude/skills/vitest/references/advanced-vi.md`: vi helper for mocking, timers, utilities
- `.claude/skills/vitest/references/core-cli.md`: Command line interface commands and options
- `.claude/skills/vitest/references/core-config.md`: Configure Vitest with vite.config.ts or vitest.config.ts
- `.claude/skills/vitest/references/core-describe.md`: describe/suite for grouping tests into logical blocks
- `.claude/skills/vitest/references/core-expect.md`: Assertions with matchers, asymmetric matchers, and custom matchers
- `.claude/skills/vitest/references/core-hooks.md`: beforeEach, afterEach, beforeAll, afterAll, and around hooks
- `.claude/skills/vitest/references/core-test-api.md`: test/it function for defining tests with modifiers
- `.claude/skills/vitest/references/features-concurrency.md`: Concurrent tests, parallel execution, and sharding
- `.claude/skills/vitest/references/features-context.md`: Test context, custom fixtures with test.extend
- `.claude/skills/vitest/references/features-coverage.md`: Code coverage with V8 or Istanbul providers
- `.claude/skills/vitest/references/features-filtering.md`: Filter tests by name, file patterns, and tags
- `.claude/skills/vitest/references/features-mocking.md`: Mock functions, modules, timers, and dates with vi utilities
- `.claude/skills/vitest/references/features-snapshots.md`: Snapshot testing with file, inline, and file snapshots

<!-- autoskills:end -->
