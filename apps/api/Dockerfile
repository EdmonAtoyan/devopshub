FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl python3 make g++

FROM base AS deps
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate && npm --workspace @devops-community/api run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /app ./
EXPOSE 3001
CMD ["npm", "--workspace", "@devops-community/api", "run", "start"]
