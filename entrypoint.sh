#!/bin/sh
set -eu

echo "Try to connect to MinIO server at ${MINIO_ENDPOINT-} ..."

# Defaults (allow env override)
: "${DOWNLOAD_MINIO:=true}"
: "${LOCAL_TEST:=false}"
: "${MC_CONFIG_DIR:=/root/.mc/}"
export MC_CONFIG_DIR

# If required env missing -> skip
if [ -z "${MINIO_USERNAME-}" ] || \
   [ -z "${MINIO_PASSWORD-}" ] || \
   [ -z "${MINIO_ENDPOINT-}" ] || \
   [ -z "${MINIO_BUCKET-}" ]; then
  echo "Missing MINIO envs, skip."
  exec "$@"
fi

# DOWNLOAD_MINIO=false -> skip
if [ "$DOWNLOAD_MINIO" = "false" ]; then
  echo "⏭️ DOWNLOAD_MINIO=false. Skip downloading fonts."
  exec "$@"
fi

# Set alias
mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_USERNAME" "$MINIO_PASSWORD"

if [ "$LOCAL_TEST" = "true" ]; then
  echo "LOCAL_TEST=true, only download a test file."
  mkdir -p /testing
  mc cp "emfont/${MINIO_BUCKET}/css/975HazyGo/200.css" /testing
else
  : "${ORIGINAL_FONTS_MOUNTPOINT:=/app/src/original-fonts}"
  echo "Downloading fonts from MinIO to $ORIGINAL_FONTS_MOUNTPOINT ..."
  mkdir -p "$ORIGINAL_FONTS_MOUNTPOINT"
  mc mirror --overwrite --remove "emfont/${MINIO_BUCKET}/original-fonts/" "$ORIGINAL_FONTS_MOUNTPOINT"
fi

echo "✅ Downloaded fonts from MinIO successfully."
exec "$@"
