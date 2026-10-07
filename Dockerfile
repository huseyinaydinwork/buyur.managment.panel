# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl tzdata ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
ENV DATABASE_URL="file:/tmp/build.db"
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production TZ=Europe/Istanbul PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/next.config.ts ./
RUN chmod +x scripts/start.sh
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
