# ─── Stage 1: Build ────────────────────────────────────────────────
# Force rebuild: 2026-02-23v2
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
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

# Copy sharp native bindings from builder into standalone node_modules
# (Next.js standalone trace doesn't always include sharp)
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img

# Copy database migration infrastructure (not traced by Next.js standalone)
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY scripts/seed.mjs /app/scripts/seed.mjs

# Copy node-pg-migrate and its full transitive dependency tree from the builder.
# The standalone trace doesn't include these, so every runtime dep must be explicit.
# -- node-pg-migrate itself (includes nested node_modules: glob@11, jackspeak,
#    lru-cache, path-scurry, @isaacs/cliui)
COPY --from=builder /app/node_modules/node-pg-migrate ./node_modules/node-pg-migrate
# -- yargs (CLI arg parser used by node-pg-migrate bin)
COPY --from=builder /app/node_modules/yargs ./node_modules/yargs
COPY --from=builder /app/node_modules/yargs-parser ./node_modules/yargs-parser
COPY --from=builder /app/node_modules/cliui ./node_modules/cliui
COPY --from=builder /app/node_modules/escalade ./node_modules/escalade
COPY --from=builder /app/node_modules/get-caller-file ./node_modules/get-caller-file
COPY --from=builder /app/node_modules/require-directory ./node_modules/require-directory
COPY --from=builder /app/node_modules/y18n ./node_modules/y18n
COPY --from=builder /app/node_modules/string-width ./node_modules/string-width
COPY --from=builder /app/node_modules/strip-ansi ./node_modules/strip-ansi
COPY --from=builder /app/node_modules/ansi-regex ./node_modules/ansi-regex
COPY --from=builder /app/node_modules/wrap-ansi ./node_modules/wrap-ansi
COPY --from=builder /app/node_modules/ansi-styles ./node_modules/ansi-styles
COPY --from=builder /app/node_modules/color-convert ./node_modules/color-convert
COPY --from=builder /app/node_modules/color-name ./node_modules/color-name
COPY --from=builder /app/node_modules/emoji-regex ./node_modules/emoji-regex
COPY --from=builder /app/node_modules/is-fullwidth-code-point ./node_modules/is-fullwidth-code-point
# -- glob@11 top-level deps (not nested inside node-pg-migrate/node_modules)
COPY --from=builder /app/node_modules/foreground-child ./node_modules/foreground-child
COPY --from=builder /app/node_modules/cross-spawn ./node_modules/cross-spawn
COPY --from=builder /app/node_modules/signal-exit ./node_modules/signal-exit
COPY --from=builder /app/node_modules/path-key ./node_modules/path-key
COPY --from=builder /app/node_modules/shebang-command ./node_modules/shebang-command
COPY --from=builder /app/node_modules/shebang-regex ./node_modules/shebang-regex
COPY --from=builder /app/node_modules/which ./node_modules/which
COPY --from=builder /app/node_modules/isexe ./node_modules/isexe
COPY --from=builder /app/node_modules/minimatch ./node_modules/minimatch
COPY --from=builder /app/node_modules/brace-expansion ./node_modules/brace-expansion
COPY --from=builder /app/node_modules/balanced-match ./node_modules/balanced-match
COPY --from=builder /app/node_modules/minipass ./node_modules/minipass
COPY --from=builder /app/node_modules/package-json-from-dist ./node_modules/package-json-from-dist

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
