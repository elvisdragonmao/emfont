#!/bin/sh
set -e

# mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"


apt update
apt install curl -y
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc && mv mc /usr/local/bin/ 
echo "Log: MinIO Client installed!"
mc --version && mc alias set emfont $MINIO_ENDPOINT $MINIO_USERNAME $MINIO_PASSWORD
# test file download
mc cp emfont/zeabur/css/975HazyGo/200.css ./
exec "$@"