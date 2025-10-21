# emfont MCP (Model Context Protocol) API

emfont 的 MCP API 讓 AI 助手（如 GPT、Claude 等）能夠幫助用戶找到合適的字體並生成實現代碼。

## 端點總覽

### 1. 獲取 MCP 配置
```
GET /mcp
```
返回 MCP 服務的配置信息和可用端點。

**響應示例：**
```json
{
  "version": "1.0",
  "name": "emfont",
  "description": "emfont MCP server - Find and apply suitable CJK fonts for your text",
  "capabilities": {
    "tools": true,
    "resources": true
  },
  "endpoints": {
    "search": "https://font.emtech.cc/mcp/search",
    "recommend": "https://font.emtech.cc/mcp/recommend",
    "info": "https://font.emtech.cc/mcp/info/:font_id",
    "implement": "https://font.emtech.cc/mcp/implement",
    "categories": "https://font.emtech.cc/mcp/categories"
  }
}
```

### 2. 搜索字體
```
GET /mcp/search?q=<query>&category=<category>&language=<language>
```

根據關鍵詞、分類和語言搜索字體。

**參數：**
- `q` or `query` (可選): 搜索關鍵詞（字體名稱、作者、標籤、描述等）
- `category` (可選): 字體分類（serif, sans-serif, handwriting, monospace, display, other）
- `language` (可選): 語言支持（zh-CN, zh-TW, ja, ko, all）

**請求示例：**
```bash
curl "https://font.emtech.cc/mcp/search?q=圓體&category=sans-serif"
```

**響應示例：**
```json
{
  "status": "success",
  "query": "圓體",
  "filters": {
    "category": "sans-serif",
    "language": null
  },
  "count": 3,
  "fonts": [
    {
      "id": "gensenrounded",
      "name": "GenSenRounded",
      "name_zh": "源泉圓體",
      "name_en": "GenSenRounded",
      "weights": ["400", "700"],
      "category": "sans-serif",
      "tags": ["rounded", "friendly", "modern"],
      "authors": ["ButTaiwan"],
      "description": "基於思源黑體改造的圓體字型",
      "license": "OFL-1.1",
      "family": "GenSen"
    }
  ]
}
```

### 3. 推薦字體
```
POST /mcp/recommend
Content-Type: application/json
```

根據文本內容、用途和風格推薦合適的字體。

**請求體：**
```json
{
  "text": "歡迎來到我的網站",
  "purpose": "heading",
  "mood": "modern",
  "language": "zh"
}
```

**參數：**
- `text` (必需): 示例文本或內容描述
- `purpose` (可選): 用途（heading, body, logo, quote, code 等）
- `mood` (可選): 風格（formal, casual, elegant, playful, modern, traditional）
- `language` (可選): 主要語言（自動檢測如果未提供）

**請求示例：**
```bash
curl -X POST https://font.emtech.cc/mcp/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "text": "歡迎來到我的部落格",
    "purpose": "heading",
    "mood": "modern"
  }'
```

**響應示例：**
```json
{
  "status": "success",
  "text": "歡迎來到我的部落格",
  "criteria": {
    "purpose": "heading",
    "mood": "modern",
    "language": null
  },
  "count": 5,
  "recommendations": [
    {
      "id": "gensenrounded",
      "name": "GenSenRounded",
      "name_zh": "源泉圓體",
      "name_en": "GenSenRounded",
      "weights": ["400", "700"],
      "category": "sans-serif",
      "tags": ["rounded", "modern"],
      "description": "基於思源黑體改造的圓體字型",
      "reason": "適合heading使用，風格modern，無襯線字體 - 適合網頁、標題、現代設計",
      "match_score": 90
    }
  ]
}
```

### 4. 獲取字體詳細信息
```
GET /mcp/info/:font_id
```

獲取特定字體的完整信息。

**請求示例：**
```bash
curl https://font.emtech.cc/mcp/info/jfopenhuninn
```

**響應示例：**
```json
{
  "status": "success",
  "font": {
    "id": "jfopenhuninn",
    "name": {
      "original": "jf-openhuninn-2.0",
      "zh": "jf open 粉圓",
      "en": "jf open huninn"
    },
    "weights": ["400", "700"],
    "category": "sans-serif",
    "tags": ["rounded", "friendly"],
    "authors": ["justfont"],
    "description": "基於小杉圓體的開源中文字型",
    "license": "OFL-1.1",
    "source": "https://github.com/justfont/open-huninn-font",
    "version": "2.0",
    "format": "ttf",
    "family": "jf-openhuninn",
    "usage_url": "https://font.emtech.cc/fonts/jfopenhuninn/"
  }
}
```

### 5. 生成實現代碼
```
POST /mcp/implement
Content-Type: application/json
```

生成可直接使用的 HTML/CSS/JS 代碼。

**請求體：**
```json
{
  "font_id": "jfopenhuninn",
  "text": "這是測試文字",
  "weight": "400",
  "method": "both"
}
```

**參數：**
- `font_id` (必需): 字體 ID
- `text` (必需): 要顯示的文本
- `weight` (可選): 字重（預設 "400"）
- `method` (可選): 實現方式（"css", "js", "both"，預設 "both"）

**請求示例：**
```bash
curl -X POST https://font.emtech.cc/mcp/implement \
  -H "Content-Type: application/json" \
  -d '{
    "font_id": "jfopenhuninn",
    "text": "歡迎使用 emfont",
    "method": "js"
  }'
```

**響應示例：**
```json
{
  "status": "success",
  "implementation": {
    "font_id": "jfopenhuninn",
    "text": "歡迎使用 emfont",
    "weight": "400",
    "method": "js",
    "code": "<!-- JavaScript 實現方式 -->\n<p class=\"emfont-jfopenhuninn\">歡迎使用 emfont</p>\n<script src=\"https://font.emtech.cc/emfont.js\"></script>\n<script>\n  emfont.init();\n</script>",
    "preview_url": "https://font.emtech.cc/fonts/jfopenhuninn/",
    "documentation_url": "https://font.emtech.cc/docs"
  }
}
```

### 6. 獲取字體分類
```
GET /mcp/categories
```

獲取所有可用的字體分類及其描述。

**響應示例：**
```json
{
  "status": "success",
  "categories": {
    "serif": "襯線字體 - 適合正式文檔、書籍、長文閱讀",
    "sans-serif": "無襯線字體 - 適合網頁、標題、現代設計",
    "handwriting": "手寫字體 - 適合個性化、溫馨感、創意內容",
    "monospace": "等寬字體 - 適合程式碼、表格、技術文檔",
    "display": "展示字體 - 適合標題、海報、視覺焦點",
    "other": "其他特殊字體"
  }
}
```

## 使用場景示例

### 場景 1: 為網站標題尋找字體
```bash
# 1. 推薦字體
curl -X POST https://font.emtech.cc/mcp/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "text": "我的部落格",
    "purpose": "heading",
    "mood": "modern"
  }'

# 2. 獲取詳細信息
curl https://font.emtech.cc/mcp/info/gensenrounded

# 3. 生成實現代碼
curl -X POST https://font.emtech.cc/mcp/implement \
  -H "Content-Type: application/json" \
  -d '{
    "font_id": "gensenrounded",
    "text": "我的部落格",
    "method": "js"
  }'
```

### 場景 2: 搜索特定風格的字體
```bash
# 搜索手寫風格字體
curl "https://font.emtech.cc/mcp/search?category=handwriting"

# 搜索圓體字型
curl "https://font.emtech.cc/mcp/search?q=圓"
```

## AI 助手集成

這個 API 專為 AI 助手設計，使其能夠：

1. **理解用戶需求**: 分析用戶的文本和用途
2. **推薦合適字體**: 基於內容、風格和用途推薦字體
3. **提供實現代碼**: 生成可直接使用的代碼片段
4. **解釋選擇理由**: 說明為什麼推薦特定字體

### GPT/Claude 使用示例對話

**用戶**: "我想為我的部落格標題找一個現代感的中文字體"

**AI**: "我幫您推薦幾款適合的字體：

1. **源泉圓體 (GenSenRounded)** - 現代圓潤風格，適合網頁標題
2. **jf open 粉圓** - 友善可愛，適合個人部落格

您想使用哪一款？我可以幫您生成實現代碼。"

**用戶**: "用源泉圓體，標題是'歡迎來到我的世界'"

**AI**: "好的！這是實現代碼：

\`\`\`html
<p class="emfont-gensenrounded">歡迎來到我的世界</p>
<script src="https://font.emtech.cc/emfont.js"></script>
<script>
  emfont.init();
</script>
\`\`\`

這樣就完成了！emfont 會自動載入並應用字體。"

## 錯誤處理

所有端點都會返回一致的錯誤格式：

```json
{
  "status": "error",
  "message": "錯誤描述",
  "error": "詳細錯誤信息"
}
```

常見 HTTP 狀態碼：
- `200`: 成功
- `400`: 請求參數錯誤
- `404`: 資源未找到
- `500`: 服務器內部錯誤

## 限制和注意事項

1. 搜索結果限制為 20 筆
2. 推薦結果限制為 10 筆
3. 所有字體遵循其原始授權條款
4. API 無需認證，但建議適度使用

## 技術細節

- **協議**: HTTP/HTTPS
- **格式**: JSON
- **編碼**: UTF-8
- **CORS**: 已啟用，支援跨域請求

## 相關資源

- [emfont 官網](https://font.emtech.cc)
- [使用文檔](https://font.emtech.cc/docs)
- [字體列表](https://font.emtech.cc/fonts)
- [GitHub 倉庫](https://github.com/emfont/emfont)
