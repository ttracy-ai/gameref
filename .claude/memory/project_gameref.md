---
name: GameRef Project Overview
description: Core facts about the GameRef project — tech stack, auth approach, and goals
type: project
---

GameRef is a password-protected web reference board (similar to PureRef) hosted on Vercel.

**Why:** User wants a web-based alternative to PureRef for organizing game dev reference images.

**Stack:**
- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind CSS
- `jose` for JWT-signed session cookies
- Hosted on Vercel

**Auth approach:** Single shared password stored in `SITE_PASSWORD` env var. On correct entry, a signed JWT is set as an httpOnly cookie (`gr_session`, 7 days). `src/proxy.ts` (Next.js 16 proxy convention) gates all routes except `/login` and `/api/auth`.

**Env vars needed on Vercel:**
- `SITE_PASSWORD` — the site password
- `JWT_SECRET` — long random string to sign JWTs

**How to apply:** When building canvas/image features, keep them all under `/canvas`. Auth is already wired — no changes needed there unless password management is requested.
