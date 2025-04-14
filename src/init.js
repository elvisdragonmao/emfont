import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

import { db, initDb } from "./database.js";
import { regenerateAllStaticFont } from "./font_nomin.js";
import fetchMinio from "./fetch_minio.js";
import { initR2 } from "./r2.js";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

dotenv.config();
const sotrge_original_fontsDir = path.resolve("src/_data/original-fonts");
const sotrge_generated_fontsDir = path.resolve("src/_data/_generated");
//init check

// 讀取並執行 SQL 腳本檔案
async function executeSQLFile(filePath) {
    const sql = await fs.promises.readFile(filePath, "utf-8");
    try {
        await db.query(sql);
    } catch (err) {
        throw new Error(`❌ SQL 執行失敗: ${filePath}`);
    }
}

//check database
async function insertFontTypes() {
    try {
        if (!fs.existsSync(sotrge_original_fontsDir)) fs.mkdirSync(sotrge_original_fontsDir, { recursive: true });
        if (!fs.existsSync(sotrge_generated_fontsDir)) fs.mkdirSync(sotrge_generated_fontsDir, { recursive: true });
        // 取得 `sotrge_original_fontsDir` 下的所有子項目
        const ALL_FONTS_dir = await readdir(sotrge_original_fontsDir);
        const fontData = [];
        console.log("🗃️  找到 " + ALL_FONTS_dir.join(", "));
        let skipped = [];
        for (const one_font_family of ALL_FONTS_dir) {
            const itemPath = path.join(sotrge_original_fontsDir, one_font_family);
            const stats = await stat(itemPath);
            //不是資料夾就跳過
            if (!stats.isDirectory()) continue;
            // 讀取該資料夾內的所有檔案
            const fontFiles = await readdir(itemPath);
            for (const fontFile of fontFiles) {
                const match = fontFile.match(/.*?(\d+)\.(ttf|otf)$/);
                if (match) {
                    const weight = match[1]; // 取得數字部分作為 weight
                    // console.log("weight:", weight);
                    // 將資料夾名（font_name）和提取的 weight 存入 fontData
                    fontData.push({
                        fontName: one_font_family, // 字型名稱（資料夾名稱）
                        weight: weight // 字型的 weight（檔案名稱中的數字）
                    });
                } else skipped.push(fontFile);
            }
        }
        console.log(`📦 收錄 ${fontData.length} 個字體`);
        if (skipped.length > 0) console.warn(`⏭️ 已跳過: ${skipped.join(", ")}`);
        if (fontData.length === 0) throw new Error("🔍 沒有找到任何字體");

        // 清空全部 weights
        await db.query("UPDATE font_family SET weights = ARRAY[]::smallint[]");

        // 建立一個暫存物件來聚集每個字體的 weights
        const fontWeightsMap = new Map();

        for (const { fontName, weight } of fontData) {
            if (!fontWeightsMap.has(fontName)) {
                fontWeightsMap.set(fontName, new Set());
            }
            fontWeightsMap.get(fontName).add(parseInt(weight));
        }

        // 把所有 fontName 一次查詢（避免每次都查一次 DB）
        const fontNames = Array.from(fontWeightsMap.keys());
        const result = await db.query(`SELECT id FROM font_family WHERE id = ANY($1)`, [fontNames]);

        const validFontIds = new Set(result.rows.map(row => row.id));

        for (const [fontName, weightsSet] of fontWeightsMap.entries()) {
            if (!validFontIds.has(fontName)) {
                console.warn(`❔ 資料庫不認識: ${fontName}`);
                continue;
            }

            // 把 set 轉成 array，並寫入資料庫
            const weights = Array.from(weightsSet);
            await db.query(`UPDATE font_family SET weights = $1 WHERE id = $2`, [weights, fontName]);
        }

        console.log("✅ 字體資料已更新");
    } catch (error) {
        console.error(`Error when check font file`, error);
        throw error;
    }
}
async function get_generated_static_floders() {
    //取得已生成放置在本地的靜態字型有哪些
    const ALL_FONTS_dir = await readdir(sotrge_generated_fontsDir);
    const fontData = [];
    for (const one_font_family of ALL_FONTS_dir) {
        const itemPath = path.join(sotrge_generated_fontsDir, `${one_font_family}`);
        const stats = await stat(itemPath);
        //跳過檔案，只取資料夾，這些才是放靜態字型的地方
        if (stats.isFile()) continue;
        // 讀取該資料夾的檔名
        // 配對格式：數字-字串-數字，例如 101-HazyGo975-1 或 700-LXGWWenKaiTCMono-300
        const match = one_font_family.match(/^(\d+)-([a-zA-Z0-9]+)-(\d+)$/);
        if (match) {
            // get file list
            const fontFiles = await readdir(itemPath);
            // 取得檔名 00.woff2 的數字部分
            const files = fontFiles.map(file => {
                const match = file.match(/(\d+)\.woff2$/);
                if (match) {
                    return match[1]; // 取得數字部分
                }
            });
            fontData.push({
                version: match[1],
                fontName: match[2], // 字型名稱（資料夾名稱）
                weight: match[3], // 字型的 weight（檔案名稱中的數字）
                files
            });
        }
    }
    return fontData;
}
async function initCheck(state) {
    try {
        if (!(await initDb())) return false;
        await fetchMinio(state);
        await initR2(state);
        await executeSQLFile(path.resolve("src/_data/sql/schema.sql"));
        await executeSQLFile(path.resolve("src/_data/sql/words.sql"));
        await insertFontTypes();
        const have_gen_list = await get_generated_static_floders();
        await regenerateAllStaticFont(state, have_gen_list);
        state.alive = true;
        return true;
    } catch (err) {
        console.error("❌ 初始化失敗:", err);
        return false;
    }
}
export { initCheck };
