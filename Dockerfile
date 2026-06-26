FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY . .

RUN pnpm install --no-frozen-lockfile \
    && pnpm run build

ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=8080

EXPOSE 8080

CMD ["node", "scripts/start.mjs"]
