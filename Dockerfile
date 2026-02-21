# ─── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

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

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install curl + su-exec for voter data download + create non-root user
RUN apk add --no-cache curl su-exec && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directory for voter file volume
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy startup script that downloads voter data if not on volume
COPY scripts/ensure-voter-data.sh /app/ensure-voter-data.sh
RUN chmod +x /app/ensure-voter-data.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as root so we can write to the mounted volume on first boot,
# then the startup script launches node as-is
CMD ["/app/ensure-voter-data.sh"]
