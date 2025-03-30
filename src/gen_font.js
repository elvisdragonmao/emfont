import { check } from "drizzle-orm/gel-core";
import { db } from "./database.js";
import Fontmin from "fontmin";
import path from "path";
import { fileURLToPath } from "url";
import rename from "gulp-rename";
import { uploadToR2, checkFileExists } from "./r2.js";
import fs from "fs";

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    // 截取前 10 個字元作為縮短的哈希值
    return fullHash.substring(0, 10);
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __Font_storge_path_base = path.join(__dirname, "static", "fonts"); //root/src/static/fonts/

// Function to generate font file with specified words
// Convert __dirname to work with ES modules
async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name
) {
    // Construct the full path to the font file based on the family and variant
    const fontFilePath = path.join(
        __Font_storge_path_base,
        originalFontFamily,
        `${font_weight}.ttf`
    );
    // Check if the font file exists before proceeding
    if (!fs.existsSync(fontFilePath)) {
        console.error("Font file not found:", fontFilePath);
        throw new Error("Font file not found");
    }

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
        .use(rename(output_name))
        //生成後在本地的明稱
        .dest(path.join(__dirname, "generated"));
    // Save to static/fonts/generated/
    return new Promise((resolve, reject) => {
        fontmin.run(function (err, files) {
            if (err) {
                reject(err);
            } else {
                // Log the generated font files' paths
                console.log("Generated font files!");
                resolve(files);
            }
        });
    });
}

// hashString 呼叫範例。必須使用 async function 。重要！！
//   (async () => {
//     const str = '你好';
//     console.log(await hashString(str)); // 印出 "你好" 的 SHA-256 雜湊值
//   })();

///g/:font 路由 呼叫的函式。會根據前端需要的字集，回傳字型檔
//靜態字型檔 solution
async function checkFormat(WORD_SET, FONT_NAME) {
    //return request {FONT_NAME}'s id in database(if exist)
    if (!WORD_SET) {
        throw new Error("words_set are required"); // 使用 throw 讓 genFont 捕捉
    }
    const result = await db.query(
        "SELECT id FROM font_types WHERE font_name = $1",
        [FONT_NAME]
    );
    if (result.rowCount === 0) {
        throw new Error("Font not found");
    }
    const font_id = result.rows[0].id; // Extracting the id value
    console.log(FONT_NAME, "id is", font_id);
    return font_id; // 如果沒問題，就回傳字型編號
}
async function find_static_font(word_set, font_family_name) {
    // 回傳要用到的字型包編號
    // 字串轉成字元陣列給 SQL 查詢
    word_set = word_set.split("");
    //查詢請求的字分別散落在哪些字型包中
    const query =
        "SELECT DISTINCT pack FROM static_fonts WHERE word = ANY($1::text[])";
    const result = await db.query(query, [word_set]);
    const use_packs = result.rows.map((row) => row.pack);
    console.log(word_set, "散落在", use_packs);
    //查詢請求的字型包是否存在
    return 1; // 如果沒問題，就回傳原始值
}
async function finde_dynamic_font(
    word_hash,
    font_id,
    font_family,
    font_weight,
    original_word_set,
    req_source = "https://font.emfont.cc/" //不可能在這裡指定，應該從前端的 body 封包一起請求（或是有其他方法）
) {
    //用 hash 值查詢動態字型檔是否存在
    // const exist_search = await db.query('SELECT * FROM dynamic_fonts WHERE hash_index = $1 AND font_type_id = $2', [word_hash, font_id]);
    // const exist = exist_search.rows[0];
    // //如果存在，回傳字型檔
    // console.log("@@I search:",exist);
    const file_exist = await checkFileExists(
        `${word_hash}-${font_family}-${font_weight}.woff`
    ); //return false or file path
    const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff`;
    if (file_exist) {
        console.log("word set is aleardy exist!");
        //+回傳字型檔
        //更新使用狀態
        // const op_result = await db.query('UPDATE dynamic_fonts SET last_use = NOW() WHERE hash_index = $1 AND font_type_id = $2', [word_hash, font_id]);//表格好像目前沒有上次使用時間，但我覺得應該要有 byiach
        try {
            const op_result = await db.query(
                "UPDATE dynamic_fonts SET use_count = use_count+1,last_us = NOW()  WHERE hash_index = $1 AND font_type_id = $2",
                [word_hash, font_id]
            );
        } catch (err) {
            console.error("❌rror during update font record:", err);
        }
        return file_exist; //if file exist, return checkFileExists return file path
    }
    //如果不存在，則生成字型檔
    else {
        try {
            await db.query(
                "INSERT INTO dynamic_fonts (hash_index, font_type_id,create_domain) VALUES ($1, $2, $3)",
                [word_hash, font_id, req_source]
            );
        } catch (err) {
            console.error("❌rror during insert new font record:", err);
            console.warn(
                `可能是資料庫已經有這筆資料，但R2上沒有字型檔${file_exist}。已重新生成，下次不會再有這個錯誤，若重複出現同一個字型檔報錯，請檢查資料庫`
            );
        }
        console.log("word set is 不存在過去的生成資料庫紀錄");
        try {
            //+生成字型檔
            await generateFont(
                font_family,
                font_weight,
                original_word_set,
                little_font_package
            );
            const localFontPath = path.join(
                __dirname,
                "generated",
                little_font_package
            );
            //+放到雲端硬碟
            //+回傳字型檔`${word_hash}-${font_weight}.woff`
            // 上傳到 R2
            const r2Url = await uploadToR2(localFontPath, little_font_package);
            console.log("✅ R2 URL:", r2Url);
            return r2Url;
        } catch (err) {
            console.error("Error during font generation:", err);
        }
    }
}
export const genFont = async (req, res) => {
    //檢查字集格式
    try {
        //req.body.word 是使用者請求的字集
        const req_word_set = req.body.words;
        //req.body.min 是否使用專用壓縮字型
        const min_flag = req.body.min == "true" ? true : false;
        //請求字重
        const font_weight = req.body.weight;
        //req_word_set,min_flag,font_weight 有可能是 undefined
        const req_source = req.headers.host; //請求網域

        //font tag 是使用者請求的字型名稱，例如ZhuQueFangSong（朱雀仿宋）等等
        const font_family_name = req.params.font;
        const font_id = await checkFormat(req_word_set, font_family_name);

        //待處理：傳入字集都不是中文的情況

        // two condictions: 1.字型包是靜態的 2.字型包是動態的
        if (min_flag || "Each is handsome") {
            //請求動態字型
            console.log("min_flag is FLASE. generate dynamic font");
            const hash = await hashString(req_word_set);
            console.log("hash is", hash);
            const file_path = await finde_dynamic_font(
                hash,
                font_id,
                font_family_name,
                font_weight,
                req_word_set,
                req_source
            );
            // 確保 file_path 存在並且有效
            if (!file_path) {
                return res.status(404).json({ error: "File not found" });
            }

            // 讓瀏覽器下載該檔案
            console.log("📥 傳送檔案:", file_path);
            return res.send({
                url: file_path,
                font: font_family_name,
                style: "lorem",
                weight: font_weight
            });
        } else {
            //請求靜態字型
            console.log("min_flag is true");
            await find_static_font(req_word_set, font_family_name);
        }

        // return res.status(200).send("Font generated");
    } catch (err) {
        console.log("gentFont() error in gen_font.js:", err.stack);
        return res.status(400).send(err.message);
    }
};
