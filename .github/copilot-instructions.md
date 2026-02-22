# Project Guidelines

## Tech Stack
- Next.js App Router + TypeScript + Bun
- Prisma (generated client in `generated/prisma`)
- UI components under `components/ui` (shadcn style)

## Build and Validate
- Install deps: `bun install`
- Start dev server: `bun run dev` (or `bun dev`)
- Build: `bun run build`
- Lint: `bun run lint`
- Type check: `bunx tsc --noEmit`
- Prisma client generate: `bun run db:generate`
- Prisma migrate (dev): `bun run db:migrate -- <migration_name>`

## Architecture Boundaries
- `app/`: pages and API routes (Route Handlers)
- `app/api/**/route.ts`: server endpoints for frontend consumption
- `lib/`: domain/service code (OKX integration, DB helpers, utilities)
- `components/`: reusable UI/layout components
- `prisma/`: schema and migrations
- `generated/prisma/`: generated artifacts; do not hand-edit

## Coding Conventions
- Use strict TypeScript types; avoid `any` unless unavoidable.
- Prefer `@/` absolute imports (configured in `tsconfig.json`).
- Keep API route handlers thin: validate input in route, call service in `lib/`, normalize response shape.
- For external API wrappers, centralize signing/auth/error handling in one module (e.g., `lib/okx-wallet.ts`).

## OKX Integration Rules
- Never expose API secrets to client code; only use them in server/runtime code.
- For OKX routes, explicitly set `export const runtime = 'nodejs'`.
- Read credentials from `.env` (`OKX_*` or fallback legacy keys already supported in code).
- If network access differs between tools (Postman vs Next), check proxy env (`OKX_PROXY_URL` / `HTTPS_PROXY` / `HTTP_PROXY`) first.

## Safety and Scope
- Do not modify `.env` values unless user explicitly asks.
- Do not commit secrets, tokens, or private keys.
- Keep changes minimal and focused; avoid unrelated refactors.
