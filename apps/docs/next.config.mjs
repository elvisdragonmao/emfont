/** @format */

import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
    output: "export", // 如果要輸出靜態網頁會需要設定其他的畫面，可參考 https://fumadocs.vercel.app/docs/headless/search/orama#static-export
    reactStrictMode: true,
    images: { unoptimized: true },
};

export default withMDX(config);
