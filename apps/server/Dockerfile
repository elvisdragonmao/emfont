# This file wil open a node 22 slim container and run emfont application. 
# 1. Copy porject files to /app (we assum this script run at zeabur so it directly copy all code from GitHub repo.
# If you run it locally, make sure workdir has clean code without other big unuse files. I recommend to check .dockerignore file.)
# 2. run entrypoint.sh to download fonts from minio server.
# 3. Run emfont using "pnpm start" command.
# insatll dependencies in a separate layer
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

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

COPY --from=deps /app/node_modules ./node_modules

COPY src /app/src
COPY scripts/ /app/scripts
COPY entrypoint.sh /app/entrypoint.sh
COPY package.json pnpm-lock.yaml ./
COPY migrates/ /app/migrates/
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]



CMD ["pnpm", "run", "start:with-migrate"]
# live forevet for testing
# CMD ["sleep", "infinity"]