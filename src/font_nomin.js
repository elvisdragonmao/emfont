//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案 (開機時重切)
import { db } from "./database.js";
import { generateFont, readFontBuffer } from "./font_min.js";
import {  checkR2FileExists } from "./r2.js";
import { Font } from "fonteditor-core";
async function gen_static_font(ff_name, support_weights, words, pack, version,r2 = false) {
    try {
        console.log("生成！",pack)
        //todo:靜態請求沒有找到檔案也要去重新生成，那邊的請求檔名也要加　version 作為前綴
        let generated = await generateFont(ff_name, support_weights, words, `${pack}.woff2`, `_data/_generated/${version}-${ff_name}-${support_weights}`);
        if (generated.status === "failed") 
            {
                console.log(generated.message)
                return generated;
            }
        //todo:使用超過　3　次才上傳。靜態請求有時候會要傳本地路徑，還要改give_static_font
        // if (!r2) return true;
        // const generated_font_path = path.join(path.dirname(fileURLToPath(import.meta.url)), "_data", "_generated", `${version}-${ff_name}-${support_weights}`, `${pack}.woff2`);
        // await uploadToR2(generated_font_path, `${ff_name}-${support_weights}/${pack}.woff2`);
        return { status: "success" };
    } catch (err) {
        return new Error(err);
    }
}

async function regenerateAllStaticFont(state,have_gen_list) {
    //!!pack_status　表格已經刪除，須移除相關內容
    // list all have to regenerate fonts family and theirs support weights .
    //regen rules: no record in pack_status history or over 1 month haven't regen
    try{

    
    const all_fonts = (
        await db.query(
            `SELECT ff.id AS ff_name, w AS support_weights
            FROM font_family ff
            JOIN LATERAL unnest(ff.weights) AS w ON true
            ;`
        )
    ).rows;
    const version_num = (
        await db.query(
        `
        SELECT bullet from version order BY start DESC limit 1;
        `
    )).rows[0].bullet
    for (const { ff_name, support_weights } of all_fonts) {
        const this_font = {
            version:version_num,
            fontName: ff_name, // 字型名稱（資料夾名稱）
            weight: support_weights // 字型的 weight（檔案名稱中的數字）
        };
        console.log(this_font)
        const exists = have_gen_list.some(item =>
            item.version == this_font.version &&//自動轉型，this_font都是數字，但have_gen_list生成的時候因為讀檔案列表是字串
            item.fontName === this_font.fontName &&
            item.weight == this_font.weight
        );
        console.log(have_gen_list,exists)
        if(exists) continue;//如果已經生成過這個靜態字型放在本地就不再生成
        console.log(`生成 ${ff_name}-${support_weights} 的靜態字型`)
        //重新生成
        //檢查本地有沒有此字型的靜態版本
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

        const charArray = Object.keys(cmap)
            .map(code => String.fromCodePoint(parseInt(code)))
            .filter(char => char !== "\x00"); // 過濾掉 0x00 字元
        console.log(ff_name, support_weights,"有這些字：",charArray);

        await db.query("BEGIN");

        // 1. 查出已經存在的字
        const { rows: existing } = await db.query("SELECT char FROM static_fonts WHERE char = ANY($1)", [charArray]);
        const existingChars = new Set(existing.map(row => row.char));

        // 2. 找出還沒出現在資料庫的字
        const newChars = charArray.filter(char => !existingChars.has(char));
        const oldChars = charArray.filter(char => existingChars.has(char));

        if (newChars.length === 0) {
            console.log("沒有新字要插入");
            await db.query("COMMIT");
            // return;
        }

        // 3. 查目前最大的 pack 編號和該 pack 裡面有幾個字
        const { rows: lastPackRows } = await db.query(
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
        for (let i = 0; i < inserts.length; i += 1000) {
            const batch = inserts.slice(i, i + 1000);
            const values = [];
            const params = [];

            batch.forEach(({ char, pack, families }, index) => {
                const baseIndex = index * 3;
                values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
                params.push(char, pack, families);
            });
            //console.log("正在插入第", i, "到", i + batch.length, "個字");
            await db.query(`INSERT INTO static_fonts (char, pack, families) VALUES ${values.join(",")}`, params);
        }

        const { rows } = await db.query(`SELECT char, families FROM static_fonts WHERE char = ANY($1::text[])`, [oldChars]);
        // 先處理好合併邏輯
        const updateMap = new Map();

        for (const row of rows) {
            const set = new Set(row.families);
            set.add(ff_name);
            updateMap.set(row.char, Array.from(set));
        }

        //  建一個對應用的 VALUES 表格，然後一次更新
        const values = [];
        const bindings = [];
        let paramIndex = 1;

        for (const [char, families] of updateMap.entries()) {
            values.push(`($${paramIndex}::text[], $${paramIndex + 1}::text)`);
            bindings.push(families, char);
            paramIndex += 2;
        }

        const updateSQL = `
        UPDATE static_fonts AS sf
        SET families = v.families
        FROM (
          VALUES
            ${values.join(",\n")}
        ) AS v(families, char)
        WHERE sf.char = v.char
      `;

        await db.query(updateSQL, bindings);
        await db.query("COMMIT");
        console.log(`已更新 ${updateMap.size} 筆字元`);

        const word_package_pair = (await db.query(`SELECT pack, STRING_AGG(char, '') AS words FROM static_fonts
                                                    WHERE char = ANY($1)
                                                    GROUP BY pack ORDER BY pack;`,
                                                    [charArray])).rows;
        // {
        //     1:'一堆字',
        //     2:'另一堆字'
        // }

        // 並行生成所有 pack
        const results = [];
        let batchSize = 3; // 一次處理的包數量
        console.log(word_package_pair)
        for (let i = 0; i < word_package_pair.length; i += batchSize) {
            const batch = word_package_pair.slice(i, i + batchSize);

            const tasks = batch.map(({ pack, words }) => {
                const padded_pack = pack.toString().padStart(2, "0");
                
                return gen_static_font(ff_name, support_weights, words, padded_pack, version_num,buffer,state.r2)
                    .then(result => {
                        return {
                        success: result.status =="success",
                        res: result,
                        pack: padded_pack,
                        rawPack: pack};
                    })
                    .catch(error => ({
                        success: false,
                        errorMsg: error.message || "Unknown error",
                        pack: padded_pack,
                        rawPack: pack
                    }));
            });
            const settled = await Promise.allSettled(tasks);

            for (const res of settled) {
                if (res.status === "fulfilled") {
                    results.push(res.value);
                } else {
                    results.push({
                        success: false,
                        errorMsg: res.reason?.message || "Unknown error",
                        pack: "??"
                    });
                }
            }
        }

        for (const res of results) {
            const { pack, success, errorMsg } = res;

            if (success) {
                //todo:資料庫更新一下狀態？
                continue;
            } else {
                console.log(res);
                console.log(`${ff_name} ${support_weights} pack ${pack} 生成失敗`);
            }
        }

        await db.query("COMMIT");
        console.log(`✅ 正在生成 ${ff_name} 的靜態字型 (${support_weights})`);
    }
    }
    catch(err)
    {
        console.log(err)
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
async function give_static_font(font_family, font_weight, packs, state) {
    try {
        if (!Array.isArray(packs) || !packs.every(Number.isInteger)) {
            throw new TypeError("packs must be an array of integers");
        }
        packs = packs.map(pack => pack.toString().padStart(2, "0")); // 顯示時補零
        // 回傳字型包路徑
        const results = await Promise.all(
            packs.map(async pack => {
                const filename = `${font_family}-${font_weight}/${pack}.woff2`;
                let real_r2_path;
                if (state.r2) real_r2_path = await checkR2FileExists(filename);
                else real_r2_path = `${state.baseURL}/_generated/${filename}`;
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
        return results.map(r => r.real_r2_path);
    } catch (error) {
        console.error("Error inserting font types:", error);
        throw error;
    }
}
export { find_static_font, give_static_font, regenerateAllStaticFont };
