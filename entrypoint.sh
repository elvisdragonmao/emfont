#!/bin/sh
set -e

# mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "Try to connect to MinIO server at $MINIO_ENDPOINT ..."
if [[ -z "$MINIO_USERNAME" || -z "$MINIO_PASSWORD" || -z "$MINIO_ENDPOINT" || -z "$MINIO_BUCKET" ]]; then
  echo "⏭️ No set MINIO_USERNAME or MINIO_PASSWORD or MINIO_ENDPOINT or MINIO_BUCKET env var, skip download fonts from MinIO.\n Serve local fonts only."
  exec "$@"
fi
if [${DOWNLOAD_MINIO} = false ] ; then
  echo "⏭️ env 'DOWNLOAD_MINIO' is false, skip download fonts from MinIO."
  exec "$@"
fi

# test file download
mc alias set emfont $MINIO_ENDPOINT $MINIO_USERNAME $MINIO_PASSWORD
if ${LOCAL_TEST} ; then
  echo "LOCAL_TEST is true, skip download all font from MinIO. Juse download a test file."
  mkdir -p /testing
  # try to connect and download a simple file for testing
  mc cp emfont/${MINIO_BUCKET}/css/975HazyGo/200.css /testing
else
  echo "Downloading fonts from MinIO..."
    mc mirror --overwrite --remove emfont/${MINIO_BUCKET}/original-fonts/ ${ORIGINAL_FONTS_MOUNTPOINT}
fi
echo "✅ Downloaded fonts from MinIO successfully."
exec "$@"