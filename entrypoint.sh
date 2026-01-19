#!/bin/sh
set -e

# mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "Log: MinIO Client installed!"

# test file download
mc alias set emfont $MINIO_ENDPOINT $MINIO_USERNAME $MINIO_PASSWORD
if ${LOCAL_TEST} ; then
  echo "Log: LOCAL_TEST is true, skip download all font from MinIO."
  mkdir -p /testing
  # try to connect and download a simple file for testing
  mc cp emfont/zeabur/css/975HazyGo/200.css /testing
else
  echo "Log: Downloading fonts from MinIO..."
    mc mirror --overwrite --remove emfont/zeabur/original-fonts/ /app/src/_data/original-fonts
fi
exec "$@"