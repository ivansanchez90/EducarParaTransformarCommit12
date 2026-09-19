# Imagen única: el backend (Express) sirve la API en /api, los archivos subidos
# en /uploads y el frontend (React) compilado en el resto de las rutas.

# ── 1. Frontend: build estático de Vite ─────────────────────────
FROM node:22-alpine AS frontend
WORKDIR /frontend
RUN corepack enable && corepack prepare pnpm@10.29.3 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# ── 2. Backend: cliente de Prisma + TypeScript compilado ────────
FROM node:22-alpine AS backend
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npx tsc
# Solo dependencias de producción (prisma y tsx quedan: se usan para
# `migrate deploy` al arrancar y para el seed).
RUN npm prune --omit=dev

# ── 3. Runtime ──────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=backend --chown=node:node /app/node_modules ./node_modules
COPY --from=backend --chown=node:node /app/dist ./dist
COPY --from=backend --chown=node:node /app/src/generated ./src/generated
COPY --chown=node:node backend/package.json backend/prisma.config.ts ./
COPY --chown=node:node backend/prisma ./prisma
COPY --from=frontend --chown=node:node /frontend/dist ./public

# Carpeta de archivos subidos: montar un volumen persistente en /app/uploads.
RUN mkdir -p uploads && chown node:node uploads
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

# Aplica las migraciones pendientes y recién después levanta la app.
# Si una migración falla, el contenedor no arranca y Coolify mantiene la
# versión anterior en línea.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
