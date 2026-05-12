# Build from the repository root:
# docker build -f apps/server/Dockerfile -t emfont:latest .
FROM node:22-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
RUN pnpm install --frozen-lockfile --filter ./apps/server --prod

FROM deps AS deploy
COPY apps/server ./apps/server
RUN pnpm --filter ./apps/server deploy --legacy --prod /prod/server

# RUN application
FROM node:22-slim AS runner

WORKDIR /app

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl unzip; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc; \
    chmod +x /usr/local/bin/mc; \
    mc --version
RUN corepack enable

COPY --from=deploy /prod/server /app

RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]



CMD ["pnpm", "run", "start:with-migrate"]
# live forevet for testing
# CMD ["sleep", "infinity"]
