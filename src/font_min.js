// dynamic font generation useage function
import fs from "fs";
import rename from "gulp-rename";
import Fontmin from "fontmin";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./database.js";
import { uploadToR2, checkFileExists } from "./r2.js";

// Function to generate font file with specified words
// Convert __dirname to work with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __Font_storge_path_base = path.join(__dirname, "_data", "original-fonts"); //projectroot/src/_data/original-fonts/

async function readFontBuffer(originalFontFamily,font_weight) {
    let success = false, buffer;
     // Construct the full path to the font file based on the family and variant
     const fontFilePath = [".ttf", ".otf"] // extensions name may be ttf or otf. Try to find any of them
     .map(ext => path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}${ext}`))
     .find(fs.existsSync);
 if (!fontFilePath) {
     console.error("找不到字體:", path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}.ttf`), path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}.otf`));
 } else {
    success = true;
 buffer = fs.readFileSync(fontFilePath);
 }
 return {butter, type, success}
}

async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name,
    put_folder = "_data/_generated", //default
    buffer = null
) {
    if(!buffer) buffer = readFontBuffer(originalFontFamily,font_weight).buffer;

    // Initialize Fontmin with the selected font file
    const fontmin = new Fontmin()
        .src(fontFilePath)
        .use(
            Fontmin.glyph({
                text: words,
                hinting: false
            })
        )
        .use(
            Fontmin.ttf2woff({
                deflate: true
            })
        )
        //生成後在本地的名稱
        .use(rename(output_name))
        // Save to src/{put_folder}/
        .dest(path.join(__dirname, put_folder));
    return new Promise((resolve, reject) => {
        fontmin.run(function (err, files) {
            if (err) {
                reject(err);
            } else {
                // Log the generated font files' paths
                console.log("字體生成成功");
                resolve(files);
            }
        });
    });
}
async function find_dynamic_font( //return a R2 url client need
    word_hash,
    font_id,
    font_family,
    font_weight,
    original_word_set,
    req_source //插入 usage_log
) {
    //用 hash 值查詢動態字型檔是否存在
    // const exist_search = await db.query('SELECT * FROM dynamic_fonts WHERE hash_index = $1 AND font_family_id = $2', [word_hash, font_id]);
    // const exist = exist_search.rows[0];
    // //如果存在，回傳字型檔
    const file_exist = await checkFileExists(`${word_hash}-${font_family}-${font_weight}.woff`); //return false or file path
    const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff`;
    if (file_exist) {
        console.log("字體已存在!");
        //+回傳字型檔
        //更新使用狀態
        // const op_result = await db.query('UPDATE dynamic_fonts SET last_use = NOW() WHERE hash_index = $1 AND font_family_id = $2', [word_hash, font_id]);//表格好像目前沒有上次使用時間，但我覺得應該要有 byiach
        try {
            const op_result = await db.query("UPDATE dynamic_fonts SET last_use = NOW()  WHERE hash = $1 AND family_id = $2", [word_hash, font_id]);
            //todo：還有更新use_count = use_count+1,在usage_log
        } catch (err) {
            console.error("❌ 資料庫紀錄失敗", err);
        }
        return file_exist; //if file exist, return checkFileExists return file path
    }
    //如果不存在，則生成字型檔
    else {
        try {
            console.log("@@", word_hash, font_id);
            await db.query("INSERT INTO dynamic_fonts (hash, family_id) VALUES ($1, $2)", [word_hash, font_id]);
        } catch (err) {
            console.error("❌ error during insert new font record:", err);
            console.warn(`可能是資料庫已經有這筆資料，但R2上沒有字型檔${file_exist}。已重新生成，下次不會再有這個錯誤，若重複出現同一個字型檔報錯，請檢查資料庫`);
        }
        console.log("字集不存在過去的生成資料庫紀錄");
        try {
            //+生成字型檔
            await generateFont(font_family, font_weight, original_word_set, little_font_package);
            const localFontPath = path.join(__dirname, "_data", "_generated", little_font_package);
            //+放到雲端硬碟
            //+回傳字型檔`${word_hash}-${font_weight}.woff`
            // 上傳到 R2
            const r2Url = await uploadToR2(localFontPath, little_font_package);
            console.log("✅ R2 URL:", r2Url);
            return r2Url;
        } catch (err) {
            console.error("字體生成失敗:", err);
            throw new Error("Font generation failed", err);
        }
    }
}
export { find_dynamic_font, generateFont ,readFontBuffer};
