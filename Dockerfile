FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

# ONNX runtime deps (@chroma-core/default-embed). Main repo only avoids apt/GPG
# failures on bookworm-updates/-security under buildx/QEMU (common on Apple Silicon).
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources; \
    printf '%s\n' 'deb http://deb.debian.org/debian bookworm main' > /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      libgomp1 \
      libstdc++6 \
      libgcc-s1 \
      libgfortran5; \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8000
ENV USE_HTTPS=false

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules

# dist output
COPY --from=builder /app/dist ./dist

# Cop RAG mock data
COPY data/dmvData.json ./dist/data

EXPOSE 8000

CMD ["node", "dist/server.js"]
