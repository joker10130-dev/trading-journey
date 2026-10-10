FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS builder
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

FROM base AS migrator
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npm", "run", "db:deploy"]

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
