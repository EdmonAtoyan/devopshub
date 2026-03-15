# DevOps Community Platform

Standalone community platform for SREs, platform engineers, and cloud developers.

## Stack

- Next.js frontend in `apps/web`
- NestJS API in `apps/api`
- Prisma with PostgreSQL
- Redis cache
- Docker Compose for the full production-style stack

## Repository Layout

- `apps/web`: Next.js application
- `apps/api`: NestJS API
- `prisma/schema.prisma`: database schema
- `docker-compose.yml`: containerized web, API, PostgreSQL, and Redis services

## Quick Start

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Update at least `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESET_PASSWORD_BASE_URL`, `EMAIL_VERIFICATION_BASE_URL`, and `CORS_ORIGIN` in `.env`.

3. Build and start the full stack:

```bash
docker compose up -d --build
```

4. Open the app:

```text
http://localhost:3000
```

The web container listens on port `3000`, the API container listens on port `4000`, and the internal Docker network connects the services by the names `web`, `api`, `postgres`, and `redis`.

If you already have a local Docker volume initialized with different Postgres credentials, reset it once before restarting:

```bash
docker compose down -v
docker compose up -d --build
```

For password reset and email verification delivery, configure either the `SMTP_*` variables or `RESEND_API_KEY` plus `RESEND_FROM` in `.env`. Without one of those providers, the API only logs email previews locally and does not deliver mail.

## Local Node Workflow

If you want to run the apps directly with Node instead of Docker:

1. Install dependencies:

```bash
npm install
```

2. Build the application:

```bash
npm run build
```

3. Start the standalone server:

```bash
npm start
```

The root start command loads `.env` if present, defaults `NODE_ENV` to `production`, builds any missing production artifacts, applies Prisma migrations, starts the API on port `3001`, and starts the web app on port `3000`.

## Development

Run the API and web app separately during development:

```bash
npm run dev:api
npm run dev:web
```

Useful database commands:

```bash
npm run db:migrate -- --name init
npm run db:studio
```

## Single-Server Deployment

For a simple EC2 deployment with Docker:

1. Install Docker Engine and Docker Compose on the instance.
2. Copy `.env.example` to `.env` and set the production values for `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESET_PASSWORD_BASE_URL`, `EMAIL_VERIFICATION_BASE_URL`, and `CORS_ORIGIN`.
3. Run `docker compose up -d --build`.
4. Put the app behind Nginx or an AWS load balancer and only expose the public web port to the internet.

The API container runs Prisma generation and `prisma migrate deploy` before boot, so a fresh instance can come up directly from `docker compose`.

## AWS EC2 Guide

Use the EC2 deployment guide in [docs/aws-ec2.md](docs/aws-ec2.md) for:

- a production-ready `.env` checklist
- a sample `systemd` unit
- a sample Nginx reverse proxy for `/`, `/api`, `/uploads`, and `/socket.io`
- post-deploy health checks
