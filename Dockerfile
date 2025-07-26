FROM node:22-slim

LABEL maintainer="iach526"
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        fontforge \
        python3 \
        python3-pip \
        ca-certificates \
        curl \
        git \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@latest --activate

COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "start"]
