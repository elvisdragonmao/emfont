//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案 (開機時重切)
import { db } from "./database.js";
import { generateFont, readFontBuffer } from "./font_min.js";
import { uploadToR2, checkFileExists } from "./r2.js";
import { fileURLToPath } from "url";
import path from "path";
async function gen_static_font(ff_name, support_weights, words, pack) {
    try {
        await generateFont(ff_name, support_weights, words, `${pack}.woff2`, `_data/_generated/${ff_name}-${support_weights}`);
        const generated_font_path = path.join(path.dirname(fileURLToPath(import.meta.url)), "_data", "_generated", `${ff_name}-${support_weights}`, `${pack}.woff2`);
        await uploadToR2(generated_font_path, `${ff_name}-${support_weights}/${pack}.woff2`);
        return true;
    } catch (err) {
        return new Error(err);
    }
}

async function regenerate_all_static_font() {
    // list all have to regenerate fonts family and theirs support weights .
    //regen rules: no record in pack_status history or over 1 month haven't regen
    const all_need_gen_fonts = (
        await db.query(
            `SELECT ff.id AS ff_name, w AS support_weights
            FROM font_family ff
            JOIN LATERAL unnest(ff.weights) AS w ON true
            LEFT JOIN pack_status ss
                ON ff.id = ss.family AND ss.weights = w
            WHERE ss.family IS NULL
            OR ss.last_update < NOW() - INTERVAL '1 month';`
        )
    ).rows;

    for (const { ff_name, support_weights } of all_need_gen_fonts) {
        // read all font 隨便選一個字重
        const fontData = await readFontBuffer(ff_name, support_weights);
        const buffer = fontData.buffer;
        const font = Font.create(buffer, {
            type: fontData.type,
            hinting: true,
            kerning: true
        });
        const fontObject = font.get();
        // cmap: maps Unicode code points to glyph index
        const cmap = fontObject.cmap;
        const supportedChars = Object.keys(cmap)
            .map(code => String.fromCodePoint(parseInt(code)))
            .join("");
        const charArray = Object.keys(cmap).map(code => String.fromCodePoint(parseInt(code)));
        console.log(charArray);

        await client.query("BEGIN");

        // 1. 查出已經存在的字
        const { rows: existing } = await client.query("SELECT char FROM static_fonts WHERE char = ANY($1)", [charArray]);
        const existingChars = new Set(existing.map(row => row.char));

        // 2. 找出還沒出現在資料庫的字
        const newChars = charArray.filter(char => !existingChars.has(char));
        const oldChars = charArray.filter(char => existingChars.has(char));

        if (newChars.length === 0) {
            console.log("沒有新字要插入");
            await client.query("COMMIT");
            return;
        }

        // 3. 查目前最大的 pack 編號和該 pack 裡面有幾個字
        const { rows: lastPackRows } = await client.query(
            `SELECT pack, COUNT(*) AS count 
           FROM static_fonts 
           GROUP BY pack 
           ORDER BY pack DESC 
           LIMIT 1`
        );

        let currentPack = 0;
        let packCount = 0;

        if (lastPackRows.length > 0) {
            currentPack = parseInt(lastPackRows[0].pack);
            packCount = parseInt(lastPackRows[0].count);
        }

        const inserts = [];

        for (const char of newChars) {
            if (packCount >= 90) {
                currentPack += 1;
                packCount = 0;
            }

            inserts.push({
                char,
                pack: currentPack,
                families: [ff_name]
            });

            packCount += 1;
        }

        // 4. 把新字 insert 進去
        const insertPromises = inserts.map(({ char, pack, families }) =>
            client.query(
                `INSERT INTO static_fonts (char, pack, families)
             VALUES ($1, $2, $3)`,
                [char, pack, families]
            )
        );

        // 把已經出現在資料庫的字檢查 families 有沒有這個字型，沒有的話加入陣列
        const updatePromises = oldChars.map(async char => {
            const { rows: existingFamilies } = await client.query(`SELECT families FROM static_fonts WHERE char = $1`, [char]);
            const familiesSet = new Set(existingFamilies[0].families);
            familiesSet.add(ff_name);
            const updatedFamilies = Array.from(familiesSet);
            return client.query(`UPDATE static_fonts SET families = $1 WHERE char = $2`, [updatedFamilies, char]);
        });

        await Promise.all([...insertPromises, ...updatePromises]);

        console.log(`已新增 ${newChars.length} 個字到資料庫`);

        const word_package_pair = (await db.query("SELECT pack, STRING_AGG(char, '') AS words FROM static_fonts GROUP BY pack ORDER BY pack;")).rows;
        // {
        //     1:'一堆字',
        //     2:'另一堆字'
        // }

        // 並行生成所有 pack
        const gen_promises = word_package_pair.map(({ pack, words }) => {
            const padded_pack = pack.toString().padStart(2, "0");
            return gen_static_font(ff_name, support_weights, words, padded_pack, buffer)
                .then(result => ({
                    success: result === true,
                    pack: padded_pack
                }))
                .catch(() => ({
                    success: false,
                    pack: padded_pack
                }));
        });

        const results = await Promise.allSettled(gen_promises);

        results.forEach((res, idx) => {
            const pack = word_package_pair[idx].pack.toString().padStart(2, "0");
            if (res.status === "fulfilled" && res.value.success) {
                // 成功就更新 timestamp
                db.query(
                    `INSERT INTO pack_status (family, weights, last_update)
                     VALUES ($1, $2, CURRENT_TIMESTAMP)
                     ON CONFLICT (family, weights)
                     DO UPDATE SET last_update = CURRENT_TIMESTAMP;`,
                    [ff_name, support_weights]
                );
            } else {
                console.log(`${ff_name} ${support_weights} pack ${pack} 生成失敗`);
            }
        });

        console.log(`✅ 正在生成 ${ff_name} 的靜態字型 (${support_weights})`);
    }

    console.log("✨ 所有靜態字體生成完成！");
}

async function find_static_font(word_set) {
    // 回傳要用到的字型包編號
    // 字串轉成字元陣列給 SQL 查詢
    try {
        word_set = word_set.split("");
        //查詢請求的字分別散落在哪些字型包中
        const query = "SELECT DISTINCT pack FROM static_fonts WHERE char = ANY($1::text[])";
        const result = await db.query(query, [word_set]);
        const use_packs = result.rows.map(row => Number(row.pack)); // 確保是數字
        console.log(word_set, "散落在", use_packs);
        //查詢請求的字型包是否存在
        return use_packs; // 如果沒問題，就回傳原始值
    } catch (error) {
        console.error("靜態字體位置查詢失敗:", error);
        throw error;
    }
}
async function give_static_font(font_family, font_weight, packs) {
    try {
        if (!Array.isArray(packs) || !packs.every(Number.isInteger)) {
            throw new TypeError("packs must be an array of integers");
        }
        packs = packs.map(pack => pack.toString().padStart(2, "0")); // 顯示時補零
        // 回傳字型包路徑
        const results = await Promise.all(
            packs.map(async pack => {
                const filename = `${font_family}-${font_weight}/${pack}.woff2`;
                const real_r2_path = await checkFileExists(filename);
                return { pack, real_r2_path };
            })
        );

        const missing = results.filter(result => !result.real_r2_path);

        if (missing.length > 0) {
            const missingPaths = missing.map(m => m.real_r2_path).join(", ");
            // TODO如果有缺少的字型檔，是不是要試著重新生成？
            throw new Error(`Missing font files: ${missingPaths}`);
        }

        // 全部存在的話就可以繼續
        const R2paths = results.map(r => r.real_r2_path);
        console.log("R2paths:", R2paths);
        // return R2paths;
        // R2paths example: [
        // '{ALTER_R2_PUB_URL_BASE}/ZhuQueFangSong-400/01.woff2',
        // '{ALTER_R2_PUB_URL_BASE}/ZhuQueFangSong-400/08.woff2',
        // '{ALTER_R2_PUB_URL_BASE}/ZhuQueFangSong-400/11.woff2']
        return R2paths;
    } catch (error) {
        console.error("Error inserting font types:", error);
        throw error;
    }
}
export { find_static_font, give_static_font, regenerate_all_static_font };
