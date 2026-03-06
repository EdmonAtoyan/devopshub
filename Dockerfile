FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
EXPOSE 4000
CMD ["sh", "-c", "npm --workspace @devops-community/api run start & npm --workspace @devops-community/web run start"]
