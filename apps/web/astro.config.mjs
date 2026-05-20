import node from "@astrojs/node";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

const apiProxyTarget = process.env.EMFONT_API_PROXY ?? "http://localhost:3000";
const proxiedApiPaths = ["/api", "/g", "/css", "/file", "/_generated", "/list", "/lorem", "/info", "/bulletin", "/emfont.js", "/emfont.min.js", "/sitemap.xml", "/robots.txt"];

export default defineConfig({
  output: "server",
  integrations: [mdx()],
  adapter: node({
    mode: "standalone"
  }),
  vite: {
    server: {
      proxy: Object.fromEntries(
        proxiedApiPaths.map(path => [
          path,
          {
            target: apiProxyTarget,
            changeOrigin: true
          }
        ])
      )
    }
  }
});
