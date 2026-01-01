<div align=center>

<img src=src/public/assets/img/logo/emfont-logo-light.svg#gh-dark-mode-only height=48px>
<img src=src/public/assets/img/logo/emfont-logo-dark.svg#gh-light-mode-only height=48px>

<div style=height:1.5rem></div>

[emfont](https://font.emtech.cc)，開源 CJK😎 webfont 服務。  
免費為你的中、英、日、韓文字及圖示注入靈魂。

[![Discord](https://img.shields.io/badge/-Discord-7289DA?style=flat-square&logo=Discord&logoColor=white)](https://dc.elvismao.com) [![Telegram](https://img.shields.io/badge/-Telegram-169BD7?style=flat-square&logo=Telegram&logoColor=white)](https://t.me/emfont)

</div>

> ⭐ 喜歡 emfont 嗎？留下一顆星星並分享給你的朋友吧！  
> 或是幫我們買杯咖啡讓 emfont 多活幾天。

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/elvismao)

## 特點

- **免費**：完全免費，無需註冊。
- **簡單**：只需一行程式碼即可完成引入。
- **快速**：字體壓縮為 `.woff2`，載入速度快。
- **省流**：極致子級化，一百字只要 40kb。
- **開源**：採用 Apache-2.0 授權。

## 使用方法

```css
@import url("https://font.emtech.cc/css/jfOpenHuninn");

body {
    font-family: "jfOpenHuninn", sans-serif;
}
```

就是那麼簡單。完整使用說明請參考 [emfont 說明文件](https://font.emtech.cc/docs)

## 開發與部屬

請先安裝 [pnpm](https://pnpm.io/zh-TW/)、[Node.js](https://nodejs.org)、[Git](https://git-scm.com/)，並架設 [PostgreSQL](https://www.postgresql.org/) 資料庫。

```bash
git clone https://github.com/emfont/emfont.git
pnpm install
```

可以考慮安裝 [minIO](https://min.io/) ([S3](https://aws.amazon.com/tw/pm/serv-s3/), [R2](https://www.cloudflare.com/zh-tw/developer-platform/products/r2/)) 並設定環境變數來提升性能。

也可以順便自己架設 [說明文件](https://github.com/emfont/doc) 以及 [caddy](https://zeabur.com/zh-TW/templates/FFDLWU) 來控制路由。

**環境變數：** 複製 `.env.example` 並命名為 `.env`，然後根據需要修改其中的變數。最後啟動即可。必填的環境變數只有 PostgreSQL 的連線資訊。

```bash
pnpm start
```
