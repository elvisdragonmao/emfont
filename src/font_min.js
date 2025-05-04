import fs from "fs";
import * as fontkit from 'fontkit';
import path from "path";
import { db } from "./database.js";
import { uploadToR2, checkR2FileExists } from "./r2.js";
import subsetFont from 'subset-font';

const __dirname = import.meta.dirname;
const __Font_storge_path_base = path.join(__dirname, "_data", "original-fonts"); //projectroot/src/_data/original-fonts/

async function readFontBuffer(originalFontFamily, font_weight,use_fontkit=false) {
    let success = false,
        fontfile,
        type;
    // Construct the full path to the font file based on the family and variant
    // extensions name may be ttf or otf. Try to find any of them
    const file_found = [".ttf",".otf"]
        .map(ext => ({
            ext: ext.slice(1),
            fullPath: path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}${ext}`)
        }))
        .find(({ fullPath }) => fs.existsSync(fullPath));
    if (!file_found) {
        console.error("找不到字體:", path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}.ttf`));
    } else {
        success = true;
        type = file_found.ext;
        if(use_fontkit){
            fontfile = fontkit.open(file_found.fullPath);
            //Opens a font file asynchronously, and returns a Promise with a font object
            // fontfile is a fontkit object
        }
        else{
            fontfile = fs.readFileSync(file_found.fullPath);
        }

    }
    return { fontfile, type, success };
}

async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name,
    put_folder = "_data/_generated", //default
    fontfile = null
) {
    try {
        // 如果沒提供 buffer，就讀取字型檔
        let type, success;
        if (!fontfile) {
            ({ fontfile, type, success } = await readFontBuffer(originalFontFamily, font_weight));
        }
        if (!success) {
            return { status: "failed", message: "emfont can't read original font, please try again later.", location: "null" };
        }
        // // 確保資料夾存在
        const destFolder = path.join(__dirname, put_folder);
        fs.mkdirSync(destFolder, { recursive: true });

        // // 輸出路徑
        
        // // 寫入檔案
        // fs.writeFileSync(outputPath, outBuffer);
        const outputPath = path.join(destFolder, `${output_name}`);
        await subsetFont(fontfile, words,{
            targetFormat: 'woff2',
            
            // output: path.join(destFolder, output_name), // Set custom output file path
        }).then((resultBuffer) => {
            // ✅ 寫入結果到檔案
            fs.writeFileSync(outputPath, resultBuffer);
        }).catch((err) => {
            console.error('Error creating subset font:', err);
          });
        return {
            status: "success",
            location: `${output_name}`
        };
    } catch (err) {
        console.error(err);
        return { status: "failed", message: "emfont can't read original font, please try again later.", location: "null" };
    }
}
async function find_dynamic_font( //return a R2 url client need
    word_hash,
    font_id,
    font_family,
    font_weight,
    original_word_set,
    state
) {
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
    let file_url = `${state.baseURL}/_generated/${little_font_package}`;//預設是本地位置，如果頻繁使用的就會在之後改成 r2 連結
    if (file_exist) {
        //+回傳字型檔
        try {
            await db.query(
                `INSERT INTO dynamic_fonts (hash, family_id,weight) VALUES ($1, $2,$3) ON CONFLICT (hash) DO 
                            UPDATE SET last_use = NOW() ,use_count=dynamic_fonts.use_count+1`,
                [word_hash, font_id, font_weight]
            );
            const upload_r2_yet = (//查詢字型包是否使用超過 20 次且尚未上傳到 r2
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
            }
            else if(state.r2)
            {
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
export { find_dynamic_font, generateFont, readFontBuffer };
