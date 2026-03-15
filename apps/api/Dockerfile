FROM node:20 AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

FROM deps AS builder

WORKDIR /app

COPY prisma prisma
COPY apps/api apps/api

RUN npm --workspace @devops-community/api run build

FROM node:20 AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY prisma prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["npm", "run", "start"]
