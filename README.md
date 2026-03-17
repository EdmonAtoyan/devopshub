# DevOps Community Platform

A full-stack community platform for SREs, platform engineers, and cloud developers. The repo ships as a small monorepo with a Next.js web app, a NestJS API, Prisma/PostgreSQL data layer, and deployment paths for both Docker Compose and a standalone Node.js server.

## What It Includes

- Email/password authentication with email verification and password reset
- Optional Google OAuth login
- Social feed with posts, comments, reposts, likes, bookmarks, tags, mentions, code blocks, links, and GIFs
- Articles, code snippets, tool directory, user profiles, and saved content
- Live notifications over Socket.IO
- Avatar uploads and static asset serving
- Curated DevOps news aggregation from external RSS feeds
- Search across users, posts, articles, tools, tags, and GIFs

## Stack

- `apps/web`: Next.js 15 + React 19
- `apps/api`: NestJS 10 + Prisma 5
- PostgreSQL 16
- Redis 7 in the Docker Compose stack
- Docker Compose for the containerized deployment path

## Repository Layout

- `apps/web`: frontend application
- `apps/api`: backend API
- `prisma/schema.prisma`: database schema
- `scripts/start-standalone.mjs`: production bootstrap for the standalone Node.js path
- `docker-compose.yml`: full multi-container stack
- `deploy/systemd/devops-hub.service`: sample `systemd` unit
- `deploy/nginx/devops-hub.conf`: sample Nginx reverse proxy
- `docs/aws-ec2.md`: standalone EC2 deployment guide

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 16 or compatible PostgreSQL service
- Docker and Docker Compose if you want the containerized path

## Quick Start With Docker Compose

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Update the important values in `.env`:

   - `JWT_SECRET`
   - `NEXT_PUBLIC_SITE_URL`
   - `RESET_PASSWORD_BASE_URL`
   - `EMAIL_VERIFICATION_BASE_URL`
   - `SMTP_*` or `RESEND_API_KEY` plus `RESEND_FROM` if you want real email delivery

3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Open the app at `http://localhost:3000`.

Container ports:

- Web: `3000`
- API: `4000`
- Postgres: `5432`
- Redis: `6379`

Useful health check:

```bash
curl http://localhost:4000/api/health
```

If you already have an old Postgres volume with different credentials, reset it once:

```bash
docker compose down -v
docker compose up -d --build
```

## Local Development With Node.js

Use this path when you want to run the apps directly instead of inside containers.

1. Start supporting services, or point `DATABASE_URL` at an existing PostgreSQL instance:

   ```bash
   docker compose up -d postgres redis
   ```

2. Copy the env file and review the defaults:

   ```bash
   cp .env.example .env
   ```

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Generate the Prisma client and run migrations:

   ```bash
   npm run db:migrate
   ```

5. Start the apps in separate terminals:

   ```bash
   npm run dev:api
   npm run dev:web
   ```

Local defaults:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- API health: `http://localhost:3001/api/health`

Helpful database commands:

```bash
npm run db:generate
npm run db:studio
```

## Production-Like Local Start

The root start script boots both services from one command:

```bash
npm run build
npm start
```

`npm start`:

- loads `.env` if present
- defaults `NODE_ENV` to `production`
- uses `API_PORT=3001` and `PORT=3000` unless you override them
- builds missing web or API artifacts automatically
- runs `prisma migrate deploy`
- starts the API and web processes together

## Environment Notes

Common variables to review:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: signing secret for auth tokens
- `NEXT_PUBLIC_SITE_URL`: public site origin
- `RESET_PASSWORD_BASE_URL`: base URL used in reset emails
- `EMAIL_VERIFICATION_BASE_URL`: base URL used in verification emails
- `NEXT_PUBLIC_API_URL`: browser-facing API base, usually `/api`
- `API_UPSTREAM_URL`: server-side proxy target for Next.js rewrites
- `CORS_ORIGIN`: mainly relevant for direct API access or reverse-proxy deployments

Optional integrations:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` for Google OAuth
- `SMTP_*` or `RESEND_API_KEY` plus `RESEND_FROM` for email delivery
- `GIPHY_API_KEY` for GIF search in posts and comments
- `CAPTCHA_PROVIDER`, Turnstile keys, or reCAPTCHA keys for bot protection
- `ALLOW_NGROK_ORIGINS` when testing through ngrok

Google OAuth callback examples:

- Docker Compose behind the web app proxy: `http://localhost:3000/api/auth/google/callback`
- Standalone API directly on port `3001`: `http://localhost:3001/api/auth/google/callback`

## Deployment Options

### Docker Compose on a Single Server

For a simple VM or EC2 deployment:

1. Install Docker Engine and Docker Compose.
2. Copy `.env.example` to `.env` and set production values.
3. Run:

   ```bash
   docker compose up -d --build
   ```

4. Put the web service behind Nginx or a load balancer and expose only the public web entrypoint.

To inspect the API logs:

```bash
docker logs --tail 100 newfolder-api-1
```

### GitHub Actions Deploy to EC2

The workflow at `.github/workflows/deploy.yml` runs on every push to `main` and deploys over SSH.

What it does on the instance:

- changes into `~/devopshub`
- backs up the existing `.env`
- fetches the latest code, hard-resets the worktree, and pulls `origin/main`
- restores `.env`
- injects optional GitHub Actions secrets into `.env`
- runs `docker compose down`
- runs `docker compose up -d --build`

Required GitHub secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_KEY`

Optional GitHub secrets currently supported by the workflow:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GIPHY_API_KEY`

### Standalone Node.js on EC2

If you prefer `npm start` behind `systemd` and Nginx instead of Docker:

- follow [docs/aws-ec2.md](docs/aws-ec2.md)
- use [deploy/systemd/devops-hub.service](deploy/systemd/devops-hub.service) as a starting unit
- use [deploy/nginx/devops-hub.conf](deploy/nginx/devops-hub.conf) as a starting reverse-proxy config

## Troubleshooting

- If login cookies do not persist on plain HTTP during direct IP testing, the app automatically falls back to non-secure cookies until you move behind HTTPS.
- If password reset or verification emails do not send, configure either `SMTP_*` or `RESEND_API_KEY` plus `RESEND_FROM`; otherwise the API only logs preview links locally.
- If Google login fails, double-check that `GOOGLE_CALLBACK_URL` matches the public callback URL registered in Google Cloud.
- If the app boots but the database schema is stale, run `npm run db:migrate` in development or `npm run db:migrate:deploy` for production-style updates.
