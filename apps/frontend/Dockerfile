FROM node:20-alpine AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apk add --no-cache libc6-compat

FROM base AS deps

WORKDIR /app
COPY package*.json ./

RUN npm install --legacy-peer-deps

FROM base AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Allow build-time overrides for browser-visible API location.
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_API_PORT
ENV NEXT_INTERNAL_API_BASE_URL=http://api:8001 \
    NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL} \
    NEXT_PUBLIC_API_PORT=${NEXT_PUBLIC_API_PORT}

RUN npm run build

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_INTERNAL_API_BASE_URL=http://api:8001 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install wget for healthcheck
RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
