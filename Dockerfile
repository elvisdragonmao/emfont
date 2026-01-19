# This file wil open a node 22 slim container and run emfont application. 
# 1. Copy porject files to /app (we assum this script run at zeabur so it directly copy all code from GitHub repo.
# If you run it locally, make sure workdir has clean code without other big unuse files. I recommend to check .dockerignore file.)
# 2. run entrypoint.sh to download fonts from minio server.
# 3. Run emfont using "pnpm start" command.
# insatll dependencies in a separate layer
FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# RUN application
FROM node:22-slim AS downloader

WORKDIR /app

COPY . .

RUN \
    apt update && \
    apt install -y --no-install-recommends curl ca-certificates
# install mc
RUN curl -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc \
 && chmod +x /usr/local/bin/mc \
 && mc --version
FROM node:22-slim AS runner
COPY --from=downloader /usr/local/bin/mc /usr/local/bin/mc
WORKDIR /app


RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules

COPY . .
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]



CMD ["pnpm", "start"]
# live forevet for testing
# CMD ["sleep", "infinity"]