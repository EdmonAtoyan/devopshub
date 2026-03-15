# DevOps Community Platform

Standalone community platform for SREs, platform engineers, and cloud developers.

## Stack

- Next.js frontend in `apps/web`
- NestJS API in `apps/api`
- Prisma with PostgreSQL
- Optional Redis service in `docker-compose.yml` for local experimentation

## Repository Layout

- `apps/web`: Next.js application
- `apps/api`: NestJS API
- `prisma/schema.prisma`: database schema
- `docker-compose.yml`: local PostgreSQL and Redis services

## Quick Start

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Start PostgreSQL locally:

```bash
docker compose up -d
```

The default local database is `devopshub` with credentials `devops` / `devops`.
If you already have a local Docker volume initialized with different Postgres credentials, reset it once before restarting:

```bash
docker compose down -v
docker compose up -d
```

3. Install dependencies:

```bash
npm install
```

4. Build the application:

```bash
npm run build
```

5. Start the standalone server:

```bash
npm start
```

The root start command loads `.env` if present, defaults `NODE_ENV` to `production`, builds any missing production artifacts, applies Prisma migrations, starts the API on port `3001`, and starts the web app on port `3000`.

For password reset and email verification delivery, configure either the `SMTP_*` variables or `RESEND_API_KEY` plus `RESEND_FROM` in `.env`. Without one of those providers, the API only logs email previews locally and does not deliver mail.

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

For a simple EC2 deployment:

1. Install Node.js 20, PostgreSQL, and Nginx on the instance.
2. Copy `.env.example` to `.env` and update at least `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RESET_PASSWORD_BASE_URL`, `EMAIL_VERIFICATION_BASE_URL`, and `CORS_ORIGIN`.
3. Run `npm ci`.
4. Run `npm run build`.
5. Run `npm start`.
6. Put the app behind Nginx and only expose ports `80` and `443` in the instance security group.

`npm start` now defaults the API process to production mode when `NODE_ENV` is unset, so placeholder secrets like `JWT_SECRET="replace-me"` will fail closed instead of silently booting with local-development behavior.

Use `systemd` or `pm2` if you want the app to restart automatically after reboots.

## AWS EC2 Guide

Use the EC2 deployment guide in [docs/aws-ec2.md](docs/aws-ec2.md) for:

- a production-ready `.env` checklist
- a sample `systemd` unit
- a sample Nginx reverse proxy for `/`, `/api`, `/uploads`, and `/socket.io`
- post-deploy health checks
