//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案( 開機時重切)
import { db } from "./database.js";
import { generateFont } from "./font_min.js";
import { uploadToR2 } from "./r2.js";
import { fileURLToPath } from "url";
import path from "path";
async function init_all_static_font() {
    const word_package_pair = (
        await db.query(
            "SELECT pack, STRING_AGG(word, '') AS words FROM static_fonts GROUP BY pack ORDER BY pack;"
        )
    ).rows;
    // list all fonts family and theirs support weights
    const all_font_family = (
        await db.query(
            "SELECT name as ff_name, weights as support_weights FROM font_family"
        )
    ).rows;
    // console.log("max_package_number:", max_package_number);
    // console.log("word_package_pair:", word_package_pair);
    const max_package_number = word_package_pair.length;
    // const max_font_family_id = all_font_family.length;
    // console.log("max_package_number:", word_package_pair);
    for (const { ff_name, support_weights } of all_font_family) {
        for (const weight_number of support_weights) {
            for (let i = 0; i < max_package_number; i++) {
                const words = word_package_pair[i].words;
                const pack = word_package_pair[i].pack;
                if (pack < 10) {
                    pack = `0${pack}`;
                }
                await generateFont(ff_name,weight_number,words,`${pack}.woff2`,
                            `_data/_generated/${ff_name}-${weight_number}`)
                const generated_font_path = path.join(
                                path.dirname(fileURLToPath(import.meta.url)),
                                "_data",
                                "_generated",
                                `${ff_name}-${weight_number}`,
                                `${pack}.woff2`
                            );
                await uploadToR2(generated_font_path,`${ff_name}-${weight_number}/${i}.woff2`);
                
            }
            
        }
        //when generate entir family-fontWeight folder 
        console.log("generate statice font package for ",ff_name)
    }
    console.log("done!")
}
// await init_all_static_font();

async function find_static_font(word_set) {
    // 回傳要用到的字型包編號
    // 字串轉成字元陣列給 SQL 查詢
    try
    {
        word_set = word_set.split("");
        //查詢請求的字分別散落在哪些字型包中
        word_set = ["a","b"]
        const query =
            "SELECT DISTINCT pack FROM static_fonts WHERE word = ANY($1::text[])";
        const result = await db.query(query, [word_set]);
        const use_packs = result.rows.map((row) => Number(row.pack)); // 確保是數字
        console.log(word_set, "散落在", use_packs);
        //查詢請求的字型包是否存在
        return use_packs; // 如果沒問題，就回傳原始值
    }
    catch (error) {
        console.error("Error inserting font types:", error);
        throw error;
    }
}
function give_static_font(font_family, font_weight, packs) {
    if (!Array.isArray(packs) || !packs.every(Number.isInteger)) {
        throw new TypeError("packs must be an array of integers");
    }
    packs = packs.map((pack) => pack.toString().padStart(2, "0")); // 顯示時補零
    // 回傳字型包路徑
    const R2paths = packs.map((pack) => {
        return `${font_family}-${font_weight}/${pack}.woff2`;
    });
    console.log("R2paths:", R2paths);
    // return R2paths;
    // R2paths example: [
        // 'ZhuQueFangSong-400/01.woff2',
        // 'ZhuQueFangSong-400/08.woff2',
        // 'ZhuQueFangSong-400/11.woff2']
    return R2paths;
}
export {find_static_font,give_static_font,init_all_static_font} ;