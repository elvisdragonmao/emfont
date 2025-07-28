FROM node:22-slim

LABEL maintainer="iach526"
WORKDIR /app

RUN \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "start"]
