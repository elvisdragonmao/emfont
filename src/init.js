import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";

import { db, initDb } from "./database.js";
import { regenerateAllStaticFont } from "./font_nomin.js";
import fetchMinio from "./fetch_minio.js";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

dotenv.config();
const sotrge_original_fontsDir = path.resolve("src/_data/original-fonts");
const bucketName = process.env.MINIO_BUCKET;

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
        // 取得 `sotrge_original_fontsDir` 下的所有子項目
        const ALL_FONTS_dir = await readdir(sotrge_original_fontsDir);
        const fontData = [];

        for (const one_font_family of ALL_FONTS_dir) {
            const itemPath = path.join(sotrge_original_fontsDir, one_font_family);
            console.log("🗃️  字體存放位置:", itemPath);
            const stats = await stat(itemPath);

            if (!stats.isDirectory()) {
                //不是資料夾就跳過
                continue;
            }
            // 讀取該資料夾內的所有檔案
            const fontFiles = await readdir(itemPath);
            for (const fontFile of fontFiles) {
                // 匹配檔名中的數字作為 weight（假設檔名包含數字，200.ttf）
                if (!fontFile.endsWith(".ttf") && !fontFile.endsWith(".otf")) {
                    console.log("Skipping:", fontFile); // 確保 README.md 這類檔案不會進來
                    continue;
                }
                const match = fontFile.match(/.*?(\d+)\.(ttf|otf)$/);
                if (match) {
                    const weight = match[1]; // 取得數字部分作為 weight
                    // console.log("weight:", weight);
                    // 將資料夾名（font_name）和提取的 weight 存入 fontData
                    fontData.push({
                        fontName: one_font_family, // 字型名稱（資料夾名稱）
                        weight: weight // 字型的 weight（檔案名稱中的數字）
                    });
                }
            }
        }
        console.log(`📦 找到 ${fontData.length} 個字體`);
        if (fontData.length === 0) {
            throw new Error("🔍 沒有找到任何字體");
        }
        //clear avaible font-weight. it will regenerate in for loop below
        await db.query("UPDATE font_family SET weights = ARRAY[]::smallint[]");
        for (const { fontName, weight } of fontData) {
            // console.log(fontName, typeof fontName, weight, typeof parseInt(weight));
            const qresult_font_family = await db.query(
                // if someone `font-family` row has exist but not this weight, then add this weight to the array
                `
                        SELECT id,repo_url from font_family WHERE id= $1;
                        `,
                [fontName]
            ); //表格內目前的字型名稱大小寫和檔案的大小寫不一樣
            const verify_font_file = qresult_font_family.rows[0]; //can use .id ,.repo_url get vaild value
            // console.log(typeof(verify_font_file),verify_font_file)
            if (!verify_font_file) {
                console.warn(`❔ 資料庫不認識: ${fontName}-${weight}`);
                continue;
            }
            //if database does't exist this weight record , append it in arrary
            await db.query(
                `UPDATE font_family SET weights =
                                        array_append(COALESCE(weights, '{}'), $1)
                                        WHERE id = $2 AND NOT ($1 = ANY(weights));`,
                [weight, fontName]
            );
        }
        console.log("✅ 字體資料已更新");
    } catch (error) {
        console.error(`Error when check font file`, error);
        throw error;
    }
}
//從本地mino空間抓檔案

async function initCheck() {
    try {
        if (!(await initDb())) return false;
        await fetchMinio();
        await executeSQLFile(path.resolve("src/_data/sql/schema.sql"));
        await executeSQLFile(path.resolve("src/_data/sql/words.sql"));
        await insertFontTypes();
        await regenerateAllStaticFont();
        return true;
    } catch (err) {
        console.error("❌ 初始化失敗:", err);
        return false;
    }
}
export { initCheck };
