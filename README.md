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
- web image expects `NEXT_PUBLIC_API_URL=/api`
- set `API_UPSTREAM_URL` at runtime for the web container, for example `http://devops-community-api:4000` in Kubernetes

## Kubernetes Deployment

1. Copy the example secret and fill in real values:

   ```bash
   cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
   ```

2. Update the image references in:

- `deploy/k8s/api-deployment.yaml`
- `deploy/k8s/web-deployment.yaml`

3. Replace the placeholders in:

- `deploy/k8s/configmap.yaml`
- `deploy/k8s/ingress.yaml`

Required placeholders:

- `__PUBLIC_SITE_URL__`: the public origin, for example `https://community.example.com`
- `__INGRESS_HOST__`: the hostname used by the ingress rule

4. Apply the manifests:

   ```bash
   kubectl apply -f deploy/k8s/secret.yaml
   kubectl apply -k deploy/k8s
   ```

5. Verify rollout:

   ```bash
   kubectl -n devops-community rollout status deployment/devops-community-api
   kubectl -n devops-community rollout status deployment/devops-community-web
   kubectl -n devops-community get ingress,svc,pods
   ```

Notes:

- the ingress expects a TLS secret named `devops-community-tls`
- uploads are stored on the API PVC declared in `deploy/k8s/api-pvc.yaml`
- the API callback URL for Google OAuth defaults to `${NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`

## CI/CD

`.github/workflows/deploy.yml` now builds and publishes the API and web images to GHCR on every push to `main`.

When you run the workflow manually with `workflow_dispatch`, it can also apply the Kubernetes manifests after rendering the public host placeholders. Configure:

- secret: `KUBE_CONFIG_DATA` as a base64-encoded kubeconfig
- variable: `PUBLIC_SITE_URL`
- variable: `INGRESS_HOST`

The deploy step assumes the cluster already has a `devops-community-secrets` secret or that you manage `deploy/k8s/secret.yaml` separately.

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
