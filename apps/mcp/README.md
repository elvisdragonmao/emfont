# emfont MCP Server

你可以使用 emfont MCP 來尋找適合的字體，生成檔案，和套用到你的專案中。你可使用線上服務，或是在本地端執行 MCP 伺服器。

支援所有主流的 AI 工具，例如 ChatGPT、Claude、GitHub Copilot 等。

-   MCP 網址：[https://font.emtech.cc/mcp](https://font.emtech.cc/mcp)
-   Repo 網址：[https://github.com/emfont/emfont-mcp](https://github.com/emfont/emfont-mcp)

![](https://font.emtech.cc/docs/mcp/gpt-usage.webp)

## 於 ChatGPT 使用 emfont MCP

> MCP 目前在 ChatGPT 仍為測試階段，請先開啟「開發者模式」來使用。

1. 開啟 ChatGPT，點選左下角頭像，並進入「設定」。
2. 點選影用程式與連結器，選擇最底下的進階設定。

    ![進階設定](https://font.emtech.cc/docs/mcp/gpt-advanced.webp)

3. 啟用「開發者模式」。

    ![啟用「開發者模式」](https://font.emtech.cc/docs/mcp/gpt-dev.webp)

4. 點擊上一步並點選「建立」。

    ![建立 MCP 連線](https://font.emtech.cc/docs/mcp/gpt-new.webp)

5. 填入相關設定

-   名稱：emfont MCP（隨便填）
-   描述：emfont MCP（隨便填）
-   MCP URL：https://font.emtech.cc/mcp
-   圖示：可以使用此張 SVG 檔案：[emfont-logo.svg](https://font.emtech.cc/static/img/logo/favicon.svg)（隨便填）
-   驗證：無驗證（沒有要搜集你個資）
-   勾選我了解並想繼續（此 MCP 開源，沒有搜集任何資訊，其實連你用過我都不知道）

    ![建立 MCP](https://font.emtech.cc/docs/mcp/gpt-create.webp)

6. 點選「建立」，你就可以開始使用 emfont MCP 囉！聊天時你可以點擊 「+」 號、「更多」、選擇「emfont MCP」來提醒 ChatGPT 記得使用。聊天過程中他想要從 emfont 找字體時會先經過你的同意。

    ![同意使用 MCP](https://font.emtech.cc/docs/mcp/gpt-agree.webp)

## 本地運行

如果你是使用 Claude 並且沒有訂閱 Pro 方案，你可以選擇在本地端運行 MCP 伺服器。

首先請你先從 [GitHub](https://github.com/emfont/emfont-mcp) 下載 MCP 專案（[點我下載 Zip](https://github.com/emfont/emfont-mcp/archive/refs/heads/main.zip)），安裝 [Node.js](https://nodejs.org/) 與 [pnpm](https://pnpm.io/zh-TW/installation)，並進行編譯：

```bash
pnpm install
pnpm build
```

接著你可以選擇以下兩種方式來運行 MCP：

### 檔案路徑

你也可以直接將 MCP 檔案路徑設定為 `build/index.js`。Claude 使用此方式可免費使用。

### 本地伺服器

```bash
pnpm start
```

並設定 MCP 檔案路徑為 `http://localhost:3000/mcp`。

## 在 Claude 使用 emfont MCP

免費使用者請先安裝桌面應用程式，並且按照上面的步驟編譯好本地的 MCP 檔案。

1. 點選左下角頭像，並進入「設定」（或是點擊 `cmd / ctrl + ,`）。
2. 點選 Developer，並選擇 Edit Config。

    ![編輯設定](https://font.emtech.cc/docs/mcp/claude-edit.webp)

    這時他會打開你的檔案總管（或是 Finder），請你編輯這個 `claude_desktop_config.json` 檔案。你可以雙擊並使用內建的文字編輯器（記事本）來開啟。或是你也可以使用你熟悉的文字編輯器（如 VSCode、Vim。）

    > 這個檔案他其實儲存在這裡，如果你想直接開的話：
    >
    > - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
    > - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
    >   請注意只有軟體設定過東西他才會被建立。

    請你貼上以下內容，並修改路徑：

    ```json
    {
        "mcpServers": {
            "emfont": {
                "command": "node",
                "args": ["C:\\你放\\檔案\\的\\絕對\\路徑\\index.js"]
            }
        }
    }
    ```

    - MacOS 使用者你可以在 Finder 裡面對剛才編譯好的 `index.js` 按下右鍵，然後按住 `options` 鍵就會出現「複製為路徑名稱」的選項，點擊後就可以取得絕對路徑。
    - Windows 使用者你可以在檔案總管裡面對剛才編譯好的 `index.js` 按下右鍵，然後選擇「內容」，在「位置」欄位中複製路徑，接著再加上 `\index.js` 即可。
    -

    > 小心在 JSON 裡面的路徑的反斜線會需要使用雙反斜線 `\\`。

    比如說我的 MacBook Pro 設定就是：

    ```json
    {
        "mcpServers": {
            "emfont": {
                "command": "node",
                "args": ["/Users/em/uwu/emfont-mcp/build/index.js"]
            }
        }
    }
    ```

    編輯完記得存檔（`cmd / ctrl + s`），然後關閉文字編輯器。

這樣就完成設定囉！接著你可以重新啟動 Claude，並且在對話視窗中點選左下角的「工具」，裡面可以看到 emfont 被啟用，並且裡面有六個工具：

![確認設定成功](https://font.emtech.cc/docs/mcp/claude-check.webp)

這裡我們以「尋找字體」為例：

![尋找字體](https://font.emtech.cc/docs/mcp/claude-use.webp)

可以看到 Claude 先是篩選出手寫體，並逐一閱讀最後推薦辰宇落雁體給我。

## 在 VSCode 使用 emfont MCP

點擊 `cmd / ctrl + shift + p`，並搜尋 `mcpu`，選擇 `MCP: Open User Configuration`，接著填入 MCP URL 即可使用。

```json
{
    "servers": {
        "emfont": {
            "url": "https://font.emtech.cc/mcp",
            "type": "http"
        }
    },
    "inputs": []
}
```

這裡我請他幫我建立一個 HTML 網頁走像素風格。

![建立一個像素風格的公告網頁](https://font.emtech.cc/docs/mcp/code.webp)

> 如果你發現他在亂引入 emfont 的話你可以請他「去閱讀文檔」。

## 功能

emfont MCP 提供以下功能給 AI 工具使用：

-   `list-fonts` - 搜尋篩選字體
-   `get-font-info` - 取得字體詳細資訊
-   `generate-font` - 生成字體檔案
-   `get-css-link` - 取得 CSS 連結
-   `list-docs` - 列出所有 emfont 說明文件
-   `get-doc-info` - 取得 emfont 說明文件內文

## License

此專案採用 Apache 2.0 授權，詳情請見 [LICENSE](LICENSE) 檔案。
