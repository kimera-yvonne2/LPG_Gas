FROM node:22-alpine AS base
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY apps/frontend apps/frontend
COPY packages/shared packages/shared

FROM base AS development
ENV NODE_ENV=development
EXPOSE 3000

FROM base AS builder
RUN npm --workspace @lpg-guardian/frontend run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/frontend/public ./apps/frontend/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
