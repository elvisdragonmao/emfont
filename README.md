
<div align=center>

# [emfont](https://font.emtech.cc)

免費中文 webfont 服務。

[![Discord](https://img.shields.io/badge/-Discord-7289DA?style=flat-square&logo=Discord&logoColor=white)](https://dc.elvismao.com) [![Telegram](https://img.shields.io/badge/-Telegram-169BD7?style=flat-square&logo=Telegram&logoColor=white)](https://t.me/emfont) 

![og](/src/static/img/og.webp)

</div>

> 如果你喜歡這個項目，認同我們的理念，歡迎在 GitHub 給我們 ⭐ 一顆星星，分享給你的朋友，或是留下你寶貴的意見。若對這個項目興趣歡迎加入 Telegram 群或 Discord 伺服器，一起討論與開發。

## 特點

-   **免費**：完全免費，無需註冊。
-   **簡單**：只需一行程式碼即可完成引入。
-   **快速**：字體壓縮為 `.woff`，載入速度快。
-   **智能**：只載入需要的字體，節省流量。
-   **開源**：採用 Apache-2.0 授權。

## 使用方法

```html
<p class="emfont-jfopenhuninn">
  這個段落使用了 jf-openhuninn-2.0 字型。
</p>
<script src="https://font.emtech.cc/emfont.min.js"></script>
<script>
  emfont.init();
</script>
```

## 開發與部屬

請先安裝 [Yarn](https://yarnpkg.com)、[Node.js](https://nodejs.org)、[Git](https://git-scm.com/)。
```bash
git clone https://github.com/Edit-Mr/emfont.git
pnpm install
pnpm dev
```

**環境變數：**複製 `.env.example` 並命名為 `.env`，然後根據需要修改其中的變數。
