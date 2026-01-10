# This file wil open a node 22 slim container and run emfont application. 
# 1. Copy porject files to /app (we assum this script run at zeabur so it directly copy all code from GitHub repo.
# If you run it locally, make sure workdir has clean code without other big unuse files. I recommend to check .dockerignore file.)
# 2. run entrypoint.sh to download fonts from minio server.
# 3. Run emfont using "pnpm start" command.
FROM node:22-slim

LABEL maintainer="iach526"
WORKDIR /app

COPY . .

RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

RUN \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile



CMD ["pnpm", "start"]
# live forevet for testing
# CMD ["sleep", "infinity"]