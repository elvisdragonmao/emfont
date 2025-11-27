import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

import { db, initDb } from "../utils/database.js";
import { regenerateAllStaticFont } from "./fontNoMin.js";
import fetchMinio from "./fetchMinio.js";
import { initR2, listFontsRecursive } from "../utils/r2.js";
import { generateSitemap } from "../website/api.js";
import { analyseFontsInBatches } from "../utils/read-font-file/analyseFonts.js";
import { generateCSSMap } from "../website/generateCSSMap.js";
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
        let fontData = []; // include arbitrarily font weight in specis font family folder. each font family can exist one record in this array
        console.log("🗃️  找到 " + ALL_FONTS_dir.join(", "));
        let skipped = [];
        const fontWeightsMap = new Map(); //紀錄字型名稱＝> 存在的字重
        let file_count = 0;
        for (const one_font_family of ALL_FONTS_dir) {
            const itemPath = path.join(sotrge_original_fontsDir, one_font_family);
            const stats = await stat(itemPath);
            //不是資料夾就跳過
            if (!stats.isDirectory()) continue;
            // 讀取該資料夾內的所有檔案
            const fontFiles = await readdir(itemPath);
            for (const fontFile of fontFiles) {
                if (!/^\d+\.(ttf|otf)$/i.test(fontFile)) {
                    skipped.push(fontFile);
                    continue; // 不符合就跳過
                }
                const match_groups = fontFile.match(/^(\d+)\.(ttf|otf)$/i);
                const weight = match_groups[1]; // 取得數字部分作為 weight
                // 將資料夾名（font_name）和提取的 weight 存入 fontData
                if (!fontWeightsMap.has(one_font_family)) {
                    //first time discover font family will enter this if
                    fontWeightsMap.set(one_font_family, new Set());
                    fontData.push({
                        fontName: one_font_family, // font id (folder name)
                        sample_file: `${itemPath}/${fontFile}`, //absolute font file path
                        weights: weight //number , is sample font weitght
                    });
                }
                fontWeightsMap.get(one_font_family).add(parseInt(weight));
                file_count++;
            }
        }

        console.log(`📦 收錄 ${file_count} 個字體`);
        if (skipped.length > 0) console.warn(`⏭️ 已跳過: ${skipped.join(", ")}`);
        if (fontData.length === 0) throw new Error("🔍 沒有找到任何字體");

        // 把所有 fontName 一次查詢（避免每次都查一次 DB）
        const fontNames = Array.from(fontWeightsMap.keys());
        const result = await db.query(`SELECT id FROM font_family WHERE id = ANY($1)`, [fontNames]);

        const validFontIds = new Set(result.rows.map(row => row.id));

        for (const [fontName, weightsSet] of fontWeightsMap.entries()) {
            if (!validFontIds.has(fontName)) {
                console.warn(`❔ 資料庫不認識: ${fontName}`);
                fontData = fontData.filter(font => font.fontName !== fontName);
                continue;
            }

            // 把支援字重的 set 轉成 array，並寫入資料庫
            const weights = Array.from(weightsSet);
            await db.query(`UPDATE font_family SET weights = $1 WHERE id = $2`, [weights, fontName]);
        }
        await analyseFontsInBatches(fontData);
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
async function sync_r2_and_db(state, fontRecords) {
    try {
        await db.query(`DELETE FROM r2_files;`);
        if (state.r2 == false) return; //r2 沒連上就不用同步了
        const query = `
      INSERT INTO r2_files (prefix, file_name,update_time)
      VALUES ${fontRecords.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2},$${i * 3 + 3})`).join(", ")};
    `;
        const values = fontRecords.flatMap(record => [record.prefix, record.fileName, record.lastModified]);
        await db.query(query, values);
        console.log("✅ R2 、資料庫同步成功");
    } catch (err) {
        console.error("同步資料庫、r2 時發生錯誤：", err);
        throw err;
    }
}
async function get_bullet() {
    try {
        let version_num = (await db.query(`SELECT bullet from version order BY start DESC limit 1;`)).rows; //[0].bullet
        version_num = version_num.length == 0 ? 100 : version_num[0].bullet;
        return version_num;
    } catch (err) {
        console.erro("取得靜態字型資料庫版號發生錯誤");
        throw err;
    }
}
async function gen_css(state) {
    const rows = await db.query(`select id, weights from font_family ;`);
    for (const row of rows.rows) {
        for (const w of row.weights) {
            await generateCSSMap(row.id, w, state);
        }
    }
}
async function initCheck(state) {
    try {
        let originalBulletin = state.bulletin;
        state.bulletin = "🔁 正在初始化中，請稍後...";
        if (!(await initDb())) return false;
        await executeSQLFile(path.resolve("src/_data/sql/schema.sql"));
        // await executeSQLFile(path.resolve("src/_data/sql/words.sql"));
        await fetchMinio(state);
        await initR2(state);
        if (state.FONT_CHECK) await insertFontTypes();
        else console.log("⚠️  跳過字體檢查");
        if (state.REGEN_STATIC) {
            state.bulletin = "📠 正在生成靜態字型，請稍後...";
            await regenerateAllStaticFont(state, await get_generated_static_floders());
        } else console.log("⚠️  跳過靜態字體生成");
        if (state.REGEN_CSS) {
            console.log("🔄  重新生成靜態字型 CSS 映射表");
            await gen_css(state);
        }
        const all_file_on_r2 = await listFontsRecursive(state);
        await sync_r2_and_db(state, all_file_on_r2);
        generateSitemap(state);
        state.static_font_version = await get_bullet(state);
        state.alive = true;
        state.bulletin = originalBulletin;
        console.log("✅ 初始化完成");
        return true;
    } catch (err) {
        console.error("❌ 初始化失敗:", err);
        return false;
    }
}
export { initCheck };
