FROM node:20 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app

COPY apps/web apps/web

RUN npm --workspace @devops-community/web run build

FROM node:20 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=/
ENV NEXT_PUBLIC_LEGACY_API_URL=/api
ENV API_UPSTREAM_URL=http://127.0.0.1:4000

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
