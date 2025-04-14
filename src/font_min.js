// dynamic font generation useage function
import fs from "fs";
// import rename from "gulp-rename";
// import Fontmin from "fontmin";
import { Font, woff2 } from "fonteditor-core";
import path from "path";
import { db } from "./database.js";
import { uploadToR2, checkR2FileExists } from "./r2.js";

const __dirname = import.meta.dirname;
const __Font_storge_path_base = path.join(__dirname, "_data", "original-fonts"); //projectroot/src/_data/original-fonts/

async function readFontBuffer(originalFontFamily, font_weight) {
    let success = false,
        buffer,
        type;
    // Construct the full path to the font file based on the family and variant
    // extensions name may be ttf or otf. Try to find any of them
    const file_found = [".ttf", ".otf"]
        .map(ext => ({
            ext: ext.slice(1),
            fullPath: path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}${ext}`)
        }))
        .find(({ fullPath }) => fs.existsSync(fullPath));
    if (!file_found) {
        console.error("找不到字體:", path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}.ttf / .otf`));
    } else {
        success = true;
        type = file_found.ext;
        buffer = fs.readFileSync(file_found.fullPath);
    }
    return { buffer, type, success };
}

async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name,
    put_folder = "_data/_generated", //default
    buffer = null
) {
    try {
        // 如果沒提供 buffer，就讀取字型檔
        let type, success;
        if (!buffer) {
            ({ buffer, type, success } = await readFontBuffer(originalFontFamily, font_weight));
        }
        if (!success) {
            return { status: "failed", message: "emfont can't read original font, please try again later.", location: "null" };
        }

        // 將文字轉成 Unicode 編碼 (code point)
        const subsetCodePoints = Array.from(new Set(words)).map(ch => ch.codePointAt(0));
        await woff2.init(); //  初始化 woff2 WASM 模組

        // 使用 fonteditor-core 讀入字型
        const font = Font.create(buffer, {
            type: type,
            subset: subsetCodePoints,
            hinting: true,
            compound2simple: true,
            inflate: null
        });

        // 儲存為 .woff 格式的 buffer
        const outBuffer = font.write({
            type: "woff2",
            hinting: false,
            deflate: woff2.encode
        });

        // 確保資料夾存在
        const destFolder = path.join(__dirname, put_folder);
        fs.mkdirSync(destFolder, { recursive: true });

        // 輸出路徑
        const outputPath = path.join(destFolder, `${output_name}`);

        // 寫入檔案
        fs.writeFileSync(outputPath, outBuffer);
        return {
            status: "success",
            location: outputPath
        };
    } catch (err) {
        console.error(err);
    }
}
async function find_dynamic_font( //return a R2 url client need
    word_hash,
    font_id,
    font_family,
    font_weight,
    original_word_set,
    req_source, //插入 usage_log
    state
) {
    //用 hash 值查詢動態字型檔是否存在
    // const exist_search = await db.query('SELECT * FROM dynamic_fonts WHERE hash_index = $1 AND font_family_id = $2', [word_hash, font_id]);
    // const exist = exist_search.rows[0];
    // //如果存在，回傳字型檔
    const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff`;
    let file_exist;
    if (state.r2) file_exist = await checkR2FileExists(little_font_package);
    else {
        let localPath = path.join(__dirname, "_data", "_generated", little_font_package);
        file_exist = fs.existsSync(localPath);
    }
    if (file_exist) {
        console.log("字體已存在!");
        //+回傳字型檔
        //更新使用狀態
        // const op_result = await db.query('UPDATE dynamic_fonts SET last_use = NOW() WHERE hash_index = $1 AND font_family_id = $2', [word_hash, font_id]);//表格好像目前沒有上次使用時間，但我覺得應該要有 byiach
        try {
            await db.query("UPDATE dynamic_fonts SET last_use = NOW()  WHERE hash = $1 AND family_id = $2", [word_hash, font_id]);
            //todo：還有更新use_count = use_count+1,在usage_log
        } catch (err) {
            console.error("❌ 資料庫紀錄失敗", err);
        }
        return {
            status: "success",
            location: file_exist
        };
    }
    //如果不存在，則生成字型檔
    else {
        try {
            await db.query("INSERT INTO dynamic_fonts (hash, family_id) VALUES ($1, $2)", [word_hash, font_id]);
        } catch (err) {
            console.error("❌ error during insert new font record:", err);
            console.warn(`可能是資料庫已經有這筆資料，但R2上沒有字型檔${file_exist}。已重新生成，下次不會再有這個錯誤，若重複出現同一個字型檔報錯，請檢查資料庫`);
        }
        console.log("字集不存在過去的生成資料庫紀錄");
        try {
            //+生成字型檔
            let generated = await generateFont(font_family, font_weight, original_word_set, little_font_package);
            if (generated.status === "failed") {
                return generated;
            }
            const localFontPath = path.join(__dirname, "_data", "_generated", little_font_package);
            //+放到雲端硬碟
            //+回傳字型檔`${word_hash}-${font_weight}.woff`
            // 上傳到 R2
            let r2Url = "";
            if (state.r2) {
                r2Url = await uploadToR2(localFontPath, little_font_package);
            } else {
                r2Url = `${state.baseURL}/_generated/${little_font_package}`;
            }
            return {
                status: "success",
                location: r2Url
            };
        } catch (err) {
            console.error("字體生成失敗:", err);
            throw new Error("Font generation failed", err);
        }
    }
}
export { find_dynamic_font, generateFont, readFontBuffer };
