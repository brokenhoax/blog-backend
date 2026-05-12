FROM node:20 AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

COPY data ./data
FROM node:20 AS runner
WORKDIR /app

# Install ONNX runtime dependencies
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libstdc++6 \
    libgcc1 \
    libgfortran5 \
    libquadmath0 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8000
ENV USE_HTTPS=false

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/server.js"]
