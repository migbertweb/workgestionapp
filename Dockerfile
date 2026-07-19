# ─── Stage 1: Build frontend ────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install root deps (server)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Install client deps + build
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci --no-audit --no-fund

COPY client/ client/
RUN cd client && npx vite build

# ─── Stage 2: Production image ──────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy server deps from builder (already pruned to production)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/dist ./client/dist

# Copy server source
COPY package.json ./
COPY server.js ./
COPY db.js ./
COPY auth.js ./
COPY notify.js ./
COPY activity.js ./

# Create data dir for SQLite
RUN mkdir -p /app/data && chown -R node:node /app

USER node

ENV PORT=3001
ENV NODE_ENV=production
# Override these in docker-compose or Dokploy:
# ENV JWT_SECRET=change-me
# ENV ADMIN_USER=admin
# ENV ADMIN_PASS=change-me

EXPOSE 3001

CMD ["node", "server.js"]