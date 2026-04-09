# Coffee Recipe Buddy

Mobile-first coffee recipe generation and recipe tracking built with Next.js 16, React 19, Tailwind CSS v4, Supabase SSR auth/storage, and OpenRouter-backed LLM routes.

Package/app identifier: `crp`

## What it does

- Scan a coffee bag image and extract bean details
- Generate brew recommendations across supported methods
- Save, revisit, edit, auto-adjust, and share recipes
- Support guest flows with `sessionStorage`, then persist to Supabase after sign-in
- Provide public shared recipe pages with cloning and comments

## App flows

```text
/ -> /scan -> /analysis -> /methods -> /recipe
/ -> /manual -> /methods -> /recipe
/recipes -> /recipes/[id]
/share/[token]
/auth
/settings
```

The app uses the App Router under `src/app`.

## Stack

- Next.js `16.2.2`
- React `19.2.4`
- Tailwind CSS v4
- Supabase via `@supabase/ssr`
- OpenRouter for bean extraction and recipe generation
- Vitest for unit tests

## Environment variables

Copy `.env.example` to `.env.local` and set:

```bash
OPENROUTER_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The settings screen also renders `NEXT_PUBLIC_APP_VERSION`. Set it if you want the in-app version label to be populated, typically to the same value as `package.json`.

## Local development

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run lint
npm run test
npm run test:watch
```

Open `http://localhost:3000`.

## Supabase notes

This repo uses `@supabase/ssr`, not `@supabase/auth-helpers-nextjs`.

- Browser/client code: `src/lib/supabase/client.ts`
- Server Components and route handlers: `src/lib/supabase/server.ts`
- Session refresh middleware: `src/lib/supabase/middleware.ts`
- Google OAuth names are preserved into `profiles.display_name` from Supabase auth metadata when available

## Key routes

- `POST /api/extract-bean`
- `POST /api/generate-recipe`
- `POST /api/adjust-recipe`
- `GET|POST /api/recipes`
- `GET|PATCH|DELETE /api/recipes/[id]`
- `POST /api/recipes/[id]/auto-adjust`
- `GET|POST|DELETE /api/recipes/[id]/share`
- `GET /api/share/[token]`
- `GET|POST /api/share/[token]/comments`
- `DELETE /api/share/[token]/comments/[id]`
- `POST /api/share/[token]/clone`
- `GET|PATCH /api/profile`

## OpenRouter tracking

All OpenRouter-backed routes send app attribution headers and a stable `user` identifier for usage analytics.

- Authenticated requests use `crp:<supabase-user-id>`
- Guest requests use `guest:<persistent-cookie-id>`

This is handled centrally in `src/lib/openrouter.ts`.

## Project structure

```text
src/app/                    App Router pages and API routes
src/components/             Shared UI
src/hooks/                  Client hooks
src/lib/                    Recipe engines, migrations, Supabase helpers
src/types/recipe.ts         Zod-backed domain types
phase*.md                   Product/implementation phase specs
```

## Testing

Unit tests live in `src/lib/__tests__` and run with Vitest.
