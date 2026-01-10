#!/bin/sh
set -e

# mc alias set emfont "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"



# test file download
mc alias set emfont $MINIO_ENDPOINT $MINIO_USERNAME $MINIO_PASSWORD
mc cp emfont/zeabur/css/975HazyGo/200.css ./
exec "$@"