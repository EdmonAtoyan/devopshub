# DevOps Community Platform

Modern DevOps-focused community platform for SREs, platform engineers, and cloud developers.

## Stack

- Frontend: Next.js, TypeScript, TailwindCSS, React Query, Zustand
- Backend: NestJS, Prisma
- Data: PostgreSQL, Redis
- Search: Meilisearch-ready
- Infra: Docker, Kubernetes, Terraform, GitHub Actions

## Monorepo Structure

- `apps/web`: Next.js UI (GitHub-style dark interface, tools, policies, settings)
- `apps/api`: NestJS API (auth, feed, articles, snippets, tools, tags, search, news)
- `prisma/schema.prisma`: core relational domain model
- `infra/k8s`: Kubernetes deployment manifests
- `infra/terraform`: Terraform cloud bootstrap starter
- `legacy/`: archived Flask MVP from initial prototype

## Core Features

- JWT auth with secure cookie transport
- Profile management with avatar uploads
- Posts/articles/snippets with author-only edit/delete
- Post and article comments with author-only edit/delete
- Live DevOps news sidebar
- Interactive DevOps utility tools
- Terms/Privacy/Guidelines policy pages
- Open Graph + Twitter share metadata

## Quick Start

1. Copy envs:

```bash
cp .env.example .env
```

2. Start local dependencies:

```bash
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client + migrate:

```bash
npm run db:generate
npm run db:migrate -- --name init
```

5. Run apps:

```bash
npm run dev:api
npm run dev:web
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`

## LAN / Public Access (Same Network)

The dev servers bind to `0.0.0.0`.

1. Find your local IP (example: `192.168.1.10`).
2. Update `.env`:

```env
NEXT_PUBLIC_API_URL="http://192.168.1.10:4000/api"
NEXT_PUBLIC_SITE_URL="http://192.168.1.10:3000"
CORS_ORIGIN="http://192.168.1.10:3000,http://localhost:3000"
```

3. Restart both apps.
4. Open from another machine: `http://192.168.1.10:3000`

## Notes

- OAuth provider flows, refresh-token rotation, and moderation automation are pending next steps.
- Search currently uses DB fallback; Meilisearch indexing worker can be added for scale.
