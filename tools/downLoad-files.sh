#!/bin/bash

# 設定字體名稱
FONT_NAME="ChillRoundGothic"
TEXT="伴t8sasd6sss5415bjkljlk03m3"  # 你要請求的文字
w="400"
min_flag="true"
format="woff2"

# API 端點
URL="http://localhost:3000/g/${FONT_NAME}"
# URL="https://xn--1y8h.emtech.cc/g/${FONT_NAME}"
#emfont-dev.zeabur.app
# Cubic_11
# 發送請求，並解析返回的 JSON
RESPONSE=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{\"words\": \"$TEXT\",
        \"weight\": \"$w\",
        \"min\": \"$min_flag\",
        \"format\": \"$format\"}")

# 從 JSON 中提取字體名稱與字體 URL
echo "$RESPONSE"
FONT_CSS_NAME=$(echo "$RESPONSE" | jq -r '.name')

echo "$RESPONSE" | jq -r '.location[]' | while read -r FONT_URL; do
    echo "字體網址: $urFONT_URLl"
    echo "字體名稱: $FONT_CSS_NAME"
    # 確保 JSON 解析成功
    if [[ "$FONT_CSS_NAME" == "null" || "$URL" == "null" ]]; then
        echo "❌ 無法獲取字體資訊，請檢查請求參數。"
        exit 1
    fi
    # 下載字體
    echo "🔄 下載字體：$FONT_CSS_NAME (URL: $FONT_URL)"
    curl -s -o "${FONT_CSS_NAME}.woff2" "$FONT_URL"

    # 確保下載成功
    if [[ $? -eq 0 ]]; then
        echo "✅ 字體已成功下載: ${FONT_CSS_NAME}.woff2"
    else
        echo "❌ 下載失敗，請檢查 URL 是否有效。"
        exit 1
    fi

    # 生成 CSS 檔案
    CSS_FILE="${FONT_CSS_NAME}.css"
    echo "@font-face {
        font-family: '$FONT_CSS_NAME';
        src: url('${FONT_CSS_NAME}.woff2') format('woff2');
    }
    .emfont-${FONT_NAME} {
        font-family: '$FONT_CSS_NAME', sans-serif;
    }" > "$CSS_FILE"

    echo "✅ CSS 已生成: $CSS_FILE"
done