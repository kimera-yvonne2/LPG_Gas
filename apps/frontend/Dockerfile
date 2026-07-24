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
ARG VITE_API_URL=http://localhost:8000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm --workspace @lpg-guardian/frontend run build

FROM nginx:alpine AS production
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html
EXPOSE 3000
