#!/bin/sh
set -eu

echo "Try to connect to MinIO server at ${MINIO_ENDPOINT} ..."

# Defaults (allow env override)
: "${SYNC_WITH_MINIO:=false}"
: "${NEED_EXAMPLE_FONTS:=false}"
# : "${MC_CONFIG_DIR:=/root/.mc/}"
# export MC_CONFIG_DIR

# If required env missing -> skip
if [ -z "${MINIO_USERNAME-}" ] || \
   [ -z "${MINIO_PASSWORD-}" ] || \
   [ -z "${MINIO_ENDPOINT-}" ] || \
   [ -z "${MINIO_BUCKET-}" ]; then
  echo "Missing MINIO argument, skip."
  exec "$@"
fi

# Set alias
mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_USERNAME" "$MINIO_PASSWORD"

# Handle example fonts request
if [ "$NEED_EXAMPLE_FONTS" = "true" ]; then
  echo "Downloading example fonts and database setting"
  mkdir -p /app/src/_data/original-fonts/Cubic11
  # download example 1 : Cubic11
  # get latest release tag
  tag=$(curl -fsSL https://api.github.com/repos/ACh-K/Cubic-11/releases/latest | grep -m1 '"tag_name"' | cut -d'"' -f4)
  curl -L -o /tmp/Cubic11.zip "https://github.com/ACh-K/Cubic-11/archive/refs/tags/$tag.zip"
  unzip /tmp/Cubic11.zip -d /tmp/Cubic11-repo
  mv /tmp/Cubic11-repo/Cubic-11-*/* /tmp/Cubic11-repo/
  mv /tmp/Cubic11-repo/fonts/ttf/Cubic_11.ttf /app/src/_data/original-fonts/Cubic11/400.ttf
  rm -rf /tmp/Cubic11.zip /tmp/Cubic11-repo
  # 把檔案同步上傳到 MinIO
  mc mirror --overwrite --remove /app/src/_data/original-fonts/Cubic11 emfont/${MINIO_BUCKET}/original-fonts/Cubic11/
else
  echo "User did not request example fonts, skip."
fi

# Download fonts from minio bucket to container
if [ "$SYNC_WITH_MINIO" = "false" ]; then
  echo "SYNC_WITH_MINIO=false, skip."
else
  : "${ORIGINAL_FONTS_MOUNTPOINT:=/app/src/_data/original-fonts}"
  echo "Downloading fonts from MinIO to $ORIGINAL_FONTS_MOUNTPOINT ..."
  mkdir -p "$ORIGINAL_FONTS_MOUNTPOINT"
  mc mirror --overwrite --remove "emfont/${MINIO_BUCKET}/original-fonts/" "$ORIGINAL_FONTS_MOUNTPOINT"
  echo "✅ Downloaded fonts from MinIO successfully."
fi
echo "✅ MinIO entrypoint done."
exec "$@"
