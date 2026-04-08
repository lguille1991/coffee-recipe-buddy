# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Supabase SSR

This project uses `@supabase/ssr`. Do **not** use `@supabase/auth-helpers-nextjs` (deprecated). Always import from:
- `src/lib/supabase/client.ts` for browser components
- `src/lib/supabase/server.ts` for API routes and Server Components

Route handlers receive `params` as a `Promise` — always `await params` before destructuring.

# Route handler params

```ts
// Correct
type Params = { params: Promise<{ id: string }> }
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
}
```

# Version Bumping

**ALWAYS bump `package.json` version when introducing code changes.** Follow SemVer logic:

- **MAJOR (X.0.0)**: Breaking changes — API route removals, breaking DB migrations, auth flow changes, feature removals
- **MINOR (0.X.0)**: New features — new API endpoints, new components/flows, new brew methods, new user-facing options
- **PATCH (0.0.X)**: Fixes/refinements — bug fixes, typos, styling adjustments, performance improvements, pure refactors

**Process**: Read `package.json` → determine bump level based on change type → update `"version"` field → include in the same commit as the code changes.

**Skip for**: Docs-only updates, test additions, dependency bumps with no API changes.

# Plan Mode Output

When operating in **plan mode**, AI coding agents MUST ALWAYS store generated output as an `.md` file in `.claude/plans/` directory. The output MUST be in **checklist format** with actionable items that can be tracked and checked off during implementation.
