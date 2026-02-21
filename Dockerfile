# ─── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

# Copy package files and install
COPY package.json package-lock.json* .npmrc* ./
RUN npm ci

# Copy source code (data/ is excluded via .dockerignore)
COPY . .

# Create empty data dir so the build doesn't fail on missing imports
RUN mkdir -p /app/data

# Build the Next.js app (standalone mode)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 2: Production ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directory — Railway persistent volume will mount at /app/data
# Upload voter files to the volume after first deploy
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
