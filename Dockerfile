# This file wil open a node 22 slim container and run emfont application. 
# 1. Copy porject files to /app (we assum this script run at zeabur so it directly copy all code from GitHub repo.
# If you run it locally, make sure workdir has clean code without other big unuse files. I recommend to check .dockerignore file.)
# 2. run entrypoint.sh to download fonts from minio server.
# 3. Run emfont using "pnpm start" command.
FROM node:22-slim

LABEL maintainer="iach526"
WORKDIR /app

COPY . .

# RUN \
# rm -rf /var/lib/apt/lists/* && \
# corepack enable && corepack prepare pnpm@latest --activate

# RUN pnpm install --frozen-lockfile

# install minio client
RUN \
apt update && \
apt install curl -y && \
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && \
chmod +x mc && mv mc /usr/local/bin/  && \
echo "Log: MinIO Client installed!"  && \
mc --version && \
chmod +x entrypoint.sh


ENTRYPOINT ["/app/entrypoint.sh"]


CMD ["pnpm", "start"]
# live forevet for testing
# CMD ["sleep", "infinity"]