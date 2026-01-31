# This file wil open a node 22 slim container and run emfont application. 
# 1. Copy porject files to /app (we assum this script run at zeabur so it directly copy all code from GitHub repo.
# If you run it locally, make sure workdir has clean code without other big unuse files. I recommend to check .dockerignore file.)
# 2. run entrypoint.sh to download fonts from minio server.
# 3. Run emfont using "pnpm start" command.
# insatll dependencies in a separate layer
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# RUN application
FROM node:22-slim AS downloader

WORKDIR /app

COPY . .

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl; \
    rm -rf /var/lib/apt/lists/*; \
    curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc; \
    chmod +x /usr/local/bin/mc; \
    mc --version
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

COPY --from=deps /app/node_modules ./node_modules

COPY . .
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]



CMD ["pnpm", "start"]
# live forevet for testing
# CMD ["sleep", "infinity"]