import fs, { stat } from "fs";
import path from "path";
import { db } from "./utils/database.js";
import { uploadToR2, checkR2FileExists } from "./utils/r2.js";
import {generateFont} from "./script/generate-font/make-font.js";

const __dirname = import.meta.dirname;


async function find_dynamic_font({ word_hash, font_id, font_family, font_weight, original_word_set, state }) {
    //return a R2 url client need
    //用 hash 值查詢動態字型檔是否存在
    // const exist_search = await db.query('SELECT * FROM dynamic_fonts WHERE hash_index = $1 AND font_family_id = $2', [word_hash, font_id]);
    // const exist = exist_search.rows[0];
    // //如果存在，回傳字型檔
    const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff2`;
    let file_exist;
    // if (state.r2) file_exist = await checkR2FileExists(little_font_package);
    // else {
    let localPath = path.join(__dirname, "_data", "_generated", little_font_package);
    file_exist = fs.existsSync(localPath);
    // }
    let file_url = `${state.baseURL}/_generated/${little_font_package}`; //預設是本地位置，如果頻繁使用的就會在之後改成 r2 連結
    if (file_exist) {
        //+回傳字型檔
        try {
            await db.query(
                `INSERT INTO dynamic_fonts (hash, family_id,weight) VALUES ($1, $2,$3) ON CONFLICT (hash) DO 
                            UPDATE SET last_use = NOW() ,use_count=dynamic_fonts.use_count+1`,
                [word_hash, font_id, font_weight]
            );
            const upload_r2_yet = //查詢字型包是否使用超過 20 次且尚未上傳到 r2
                (
                    await db.query(
                        `SELECT EXISTS (
                                     SELECT 1 
                                     FROM dynamic_fonts 
                                     WHERE use_count > 10 
                                       AND hash = $1
                                       AND NOT EXISTS (
                                         SELECT 1 
                                         FROM r2_files 
                                         WHERE file_name = $2
                                       )
                                   ) AS more_than_stander`,
                        [word_hash, little_font_package]
                    )
                ).rows[0];
            if (upload_r2_yet.more_than_stander && state.r2) {
                //足夠頻繁使用但還沒上傳 r2
                file_url = await uploadToR2(localPath, little_font_package);
                await db.query(`INSERT INTO r2_files (prefix, file_name) VALUES('fonts/',$1)`, [little_font_package]);
            } else if (state.r2) {
                file_url = `${state.R2_PUB_URL_BASE}/fonts/${little_font_package}`;
            }
        } catch (err) {
            console.error("❌ 資料庫紀錄失敗", err);
        }
        return {
            status: "success",
            location: file_url
        };
    }
    //如果不存在，則在本地生成字型檔直接回傳路徑
    else {
        try {
            const { rows } = await db.query(`SELECT weights FROM font_family WHERE id = $1`, [font_id]);
            if (rows.length === 0)
                return {
                    code: 404,
                    status: "failed",
                    message: "Font not found"
                };
            let allWeights = rows[0].weights;
            if (allWeights.rowCount === 0) {
                return {
                    code: 404,
                    status: "failed",
                    message: "No weights available for this font"
                };
            } else if (!allWeights.includes(font_weight)) {
                // calculate the closest weight
                font_weight = allWeights.reduce((prev, curr) => (Math.abs(curr - font_weight) < Math.abs(prev - font_weight) ? curr : prev));
            }

            await db.query("INSERT INTO dynamic_fonts (hash, family_id,weight) VALUES ($1, $2,$3) ON CONFLICT (hash) DO NOTHING", [word_hash, font_id, font_weight]);
            //+生成字型檔
            let generated = await generateFont(font_family, font_weight, original_word_set, little_font_package);
            if (generated.status === "failed") {
                return generated;
            }
            return {
                status: "success",
                location: `${state.baseURL}/_generated/${generated.location}`
            };
        } catch (err) {
            console.error("字體生成失敗:", err);
            throw new Error("Font generation failed", err);
        }
    }
}
export { find_dynamic_font};
