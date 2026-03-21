# DevOps Community Platform

A Kubernetes-first monorepo for a DevOps-focused community platform. The browser always talks to the app through same-origin routes, while local development and Kubernetes production each wire `/api`, `/uploads`, and `/socket.io` to the NestJS API in the right place.

## Architecture

- `apps/web`: Next.js 15 frontend that serves the UI and proxies API, uploads, and realtime traffic
- `apps/api`: NestJS 10 backend for auth, feed, articles, snippets, notifications, uploads, and search
- `prisma/`: shared Prisma schema, migrations, and seed data
- `deploy/k8s/`: Kubernetes namespace, config, deployment, service, PVC, and ingress manifests
- `scripts/`: local helper scripts such as the standalone production-like bootstrap

Public traffic pattern:

- local development: browser -> `http://localhost:3000` -> Next.js rewrites -> `http://127.0.0.1:4000`
- production: browser -> ingress -> `/api`, `/uploads`, `/socket.io` routed to API service, `/` routed to web service

## Repository Layout

- `apps/api`
- `apps/web`
- `deploy/k8s`
- `prisma`
- `scripts`

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 16 or compatible PostgreSQL service
- Docker if you want to build production images locally
- `kubectl` with access to your target cluster for deployment

## Local Development

1. Copy the env template:

   ```bash
   cp .env.example .env
   ```

2. Set at least `DATABASE_URL` and `JWT_SECRET`.

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Generate Prisma client and apply migrations:

   ```bash
   npm run db:migrate
   ```

5. Start the API and web app in separate terminals:

   ```bash
   npm run dev:api
   npm run dev:web
   ```

Local defaults:

- web: `http://localhost:3000`
- api: `http://localhost:4000`
- browser-facing API base: `/api`
- direct API health check: `curl http://localhost:4000/api/health`

For a production-like local boot path:

```bash
npm run build
npm run start:standalone
```

## Docker Builds

Build both production images:

```bash
npm run docker:build
```

Or build them individually:

```bash
npm run docker:build:api
npm run docker:build:web
```

Runtime expectations:

- API image expects `DATABASE_URL`, `JWT_SECRET`, and the public site URLs
- web image expects `NEXT_PUBLIC_API_URL=/` and `NEXT_PUBLIC_LEGACY_API_URL=/api`
- the production web build should be created with `NEXT_PUBLIC_SITE_URL=https://devopshub.one`
- set `API_UPSTREAM_URL` for the web container to `http://api:4000` in Kubernetes

## Kubernetes Deployment

1. Copy the example secret and fill in real values:

   ```bash
   cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
   ```

2. Confirm the Kubernetes resources are targeting the `devopshub` namespace and the Docker Hub images:

- `deploy/k8s/api-deployment.yaml`
- `deploy/k8s/web-deployment.yaml`
- `deploy/k8s/ingress.yaml`

3. Apply the manifests:

   ```bash
   kubectl apply -f deploy/k8s/secret.yaml
   kubectl apply -k deploy/k8s
   ```

4. Verify rollout:

   ```bash
   kubectl -n devopshub rollout status deployment/postgres
   kubectl -n devopshub rollout status deployment/api
   kubectl -n devopshub rollout status deployment/web
   kubectl -n devopshub get ingress,svc,pods
   ```

Notes:

- the ingress expects a TLS secret named `devopshub-one-tls`
- PostgreSQL uses the `postgres-data` PVC declared in `deploy/k8s/postgres-pvc.yaml`
- API uploads use the `uploads-data` PVC declared in `deploy/k8s/uploads-pvc.yaml`
- the API callback URL for Google OAuth defaults to `${NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
- the API deployment runs Prisma startup preparation in an init container before the application starts

## CI/CD

`.github/workflows/deploy.yml` now builds and publishes the API and web images to Docker Hub on every push to `main`.

When you run the workflow manually with `workflow_dispatch`, it can also:

- recreate the `community-secrets` Kubernetes secret from GitHub Actions secrets
- render the Kubernetes manifests with the configured public site URL, ingress host, and TLS secret name
- apply the manifests after pinning the API and web deployments to the image SHA it just built

Configure:

- secret: `DOCKERHUB_TOKEN`
- secret: `KUBE_CONFIG_DATA` as a base64-encoded kubeconfig
- secret: `JWT_SECRET`
- secret: `POSTGRES_PASSWORD`
- optional secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `GIPHY_API_KEY`, `RESEND_*`, `SMTP_*`, `TURNSTILE_SECRET_KEY`, `RECAPTCHA_SECRET_KEY`
- optional variable: `DOCKERHUB_USERNAME` (defaults to `edmond25`)
- variable: `PUBLIC_SITE_URL`
- optional variable: `POSTGRES_DB` (defaults to `devopshub`)
- optional variable: `POSTGRES_USER` (defaults to `devops`)
- optional variable: `INGRESS_HOST` (defaults to `devopshub.one`)
- optional variable: `TLS_SECRET_NAME` (defaults to `devopshub-one-tls`)

## Environment Notes

Common settings:

- `NEXT_PUBLIC_API_URL`: optional browser API base, defaults to `/api`
- `API_UPSTREAM_URL`: server-side rewrite target for the web app
- `NEXT_PUBLIC_SITE_URL`: public site origin used for redirects and links
- `CORS_ORIGIN`: allowed browser origins for direct API access
- `GOOGLE_CALLBACK_URL`: optional override when the default callback needs to differ from the public site URL

Optional integrations:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- `SMTP_*` or `RESEND_*`
- `GIPHY_API_KEY`
- `TURNSTILE_*` or `RECAPTCHA_*`
