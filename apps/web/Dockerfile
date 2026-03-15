FROM node:20 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app

ARG API_UPSTREAM_URL=http://api:4000
ARG NEXT_PUBLIC_API_URL=/api

ENV API_UPSTREAM_URL=$API_UPSTREAM_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY apps/web apps/web

RUN npm --workspace @devops-community/web run build

FROM node:20 AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
