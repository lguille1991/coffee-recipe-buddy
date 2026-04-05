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
