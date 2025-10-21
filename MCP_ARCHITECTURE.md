# MCP API Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI Assistant                             │
│                      (GPT / Claude / etc)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      emfont Server                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   MCP API Endpoints                       │  │
│  │                                                           │  │
│  │  GET  /mcp              → Configuration                  │  │
│  │  GET  /mcp/search       → Search fonts                   │  │
│  │  POST /mcp/recommend    → Recommend fonts                │  │
│  │  GET  /mcp/info/:id     → Font details                   │  │
│  │  POST /mcp/implement    → Generate code                  │  │
│  │  GET  /mcp/categories   → List categories                │  │
│  │                                                           │  │
│  └──────────────┬────────────────────────────────────────────┘  │
│                 │                                                │
│  ┌──────────────▼────────────────────────────────────────────┐  │
│  │                   MCP Logic Layer                         │  │
│  │                                                           │  │
│  │  • searchFonts()       - Query database                  │  │
│  │  • recommendFont()     - Smart matching                  │  │
│  │  • getFontInfo()       - Retrieve details                │  │
│  │  • generateImplementation() - Code generation            │  │
│  │  • analyzeText()       - Language detection              │  │
│  │  • calculateMatchScore() - Ranking algorithm             │  │
│  │                                                           │  │
│  └──────────────┬────────────────────────────────────────────┘  │
│                 │                                                │
│  ┌──────────────▼────────────────────────────────────────────┐  │
│  │                   PostgreSQL Database                     │  │
│  │                                                           │  │
│  │  font_family table:                                       │  │
│  │  • id, name, name_zh, name_en                            │  │
│  │  • weights, category, tags                               │  │
│  │  • authors, description, license                         │  │
│  │  • family, version, format                               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Request Flow Examples

### 1. Font Search Flow
```
User → "幫我找圓體字型"
  ↓
AI → GET /mcp/search?q=圓
  ↓
Server → Query database for fonts matching "圓"
  ↓
Database → Returns: jfopenhuninn, gensenrounded
  ↓
Server → Format response with font details
  ↓
AI → "找到2個圓體字型：jf open 粉圓 和 源泉圓體..."
```

### 2. Font Recommendation Flow
```
User → "我需要適合部落格標題的現代字體"
  ↓
AI → POST /mcp/recommend
     { text: "我的部落格", purpose: "heading", mood: "modern" }
  ↓
Server → Analyze text (language: zh)
       → Match purpose: heading → categories: [display, sans-serif]
       → Match mood: modern → tags: [modern, clean]
       → Query database
       → Calculate match scores
  ↓
Database → Returns matching fonts
  ↓
Server → Rank by score, format response
  ↓
AI → "推薦使用 源泉圓體，因為它是現代無襯線字體，適合標題使用..."
```

### 3. Code Generation Flow
```
User → "生成使用 jfopenhuninn 的代碼"
  ↓
AI → POST /mcp/implement
     { font_id: "jfopenhuninn", text: "歡迎光臨", method: "js" }
  ↓
Server → Generate JavaScript implementation code
       → Include emfont.js reference
       → Add initialization code
  ↓
AI → Returns ready-to-use code:
     <p class="emfont-jfopenhuninn">歡迎光臨</p>
     <script src="https://font.emtech.cc/emfont.js"></script>
     <script>emfont.init();</script>
```

## Data Flow

```
┌─────────────┐
│   User      │
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Assistant Processes Request         │
│  • Understands intent                   │
│  • Selects appropriate MCP tool         │
│  • Formulates API call                  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  MCP API Endpoint                       │
│  • Validates input                      │
│  • Routes to handler                    │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Business Logic                         │
│  • Text analysis                        │
│  • Query construction                   │
│  • Scoring/ranking                      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Database Query                         │
│  • SQL execution                        │
│  • Result fetching                      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Response Formation                     │
│  • Format JSON                          │
│  • Add metadata                         │
│  • Generate code if needed              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Assistant Processes Response        │
│  • Interprets results                   │
│  • Formats for user                     │
│  • Provides explanations                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   User      │
│   Receives  │
│   Answer    │
└─────────────┘
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────┐
│                        mcp.json                          │
│                  (Tool Definitions)                      │
│  Defines what AI assistants can do with the API         │
└─────────────────┬───────────────────────────────────────┘
                  │ Referenced by
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   src/website/mcp.js                     │
│                (API Implementation)                      │
│  • registerMcpApi() - Routes setup                      │
│  • searchFonts() - Search logic                         │
│  • recommendFont() - Recommendation engine              │
│  • getFontInfo() - Info retrieval                       │
│  • generateImplementation() - Code generator            │
└─────────────────┬───────────────────────────────────────┘
                  │ Imported by
                  ▼
┌─────────────────────────────────────────────────────────┐
│                       src/app.js                         │
│                   (Main Application)                     │
│  Registers MCP routes alongside existing routes         │
└─────────────────┬───────────────────────────────────────┘
                  │ Serves
                  ▼
┌─────────────────────────────────────────────────────────┐
│              src/public/mcp-demo.html                    │
│                  (Demo Interface)                        │
│  Interactive testing and demonstration page             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     MCP_API.md                           │
│                (Chinese Documentation)                   │
│  Complete API reference for Chinese users               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              MCP_IMPLEMENTATION.md                       │
│              (English Technical Guide)                   │
│  Implementation details for developers                  │
└─────────────────────────────────────────────────────────┘
```

## Integration Points

```
         Existing emfont System
┌──────────────────────────────────────┐
│                                      │
│  /g/:font      → Font generation     │
│  /css/:font    → CSS delivery        │
│  /list         → Font listing        │
│  /info/:fontID → Font info           │
│                                      │
└──────────────┬───────────────────────┘
               │
               │ Shares database
               │
┌──────────────▼───────────────────────┐
│          New MCP System              │
│                                      │
│  /mcp          → Configuration       │
│  /mcp/search   → AI-friendly search  │
│  /mcp/recommend → Smart suggestions  │
│  /mcp/info     → Detailed info       │
│  /mcp/implement → Code generation    │
│  /mcp/categories → Category list     │
│                                      │
└──────────────────────────────────────┘
```

All components work together seamlessly to provide AI assistants with 
comprehensive font discovery and implementation capabilities!
