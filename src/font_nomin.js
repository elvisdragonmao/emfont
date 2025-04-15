//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案 (開機時重切)
import { db } from "./database.js";
import { readFontBuffer } from "./font_min.js";
import { checkR2FileExists } from "./r2.js";
import { Font } from "fonteditor-core";
import { Worker } from "worker_threads";
import path from "path";
import os from "os";
const __dirname = import.meta.dirname;
const cpuCount = os.cpus().length - 2;
console.log(cpuCount);
const runWorker = data => {
    try {
        return new Promise((resolve, reject) => {
            const worker = new Worker(path.resolve(__dirname, "font_nomin_worker.js"), {
                workerData: data
            });

            worker.on("message", result => {
                resolve(result);
            });

            worker.on("error", error => {
                reject(error);
            });

            worker.on("exit", code => {
                if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
            });
        });
    } catch (err) {
        console.log(err);
    }
};

async function regenerateAllStaticFont(state, have_gen_list) {
    //!!pack_status　表格已經刪除，須移除相關內容
    // list all have to regenerate fonts family and theirs support weights .
    //regen rules: no record in pack_status history or over 1 month haven't regen
    try {
        const all_fonts = (
            await db.query(
                `SELECT ff.id AS ff_name, w AS support_weights
                FROM font_family ff
                JOIN LATERAL unnest(ff.weights) AS w ON true
            ;`
            )
        ).rows;
        let version_num = (await db.query(`SELECT bullet from version order BY start DESC limit 1;`)).rows; //[0].bullet
        version_num = version_num.length == 0 ? 100 : version_num[0].bullet;

        for (const { ff_name, support_weights } of all_fonts) {
            const this_font = {
                version: version_num,
                fontName: ff_name, // 字型名稱（資料夾名稱）
                weight: support_weights // 字型的 weight（檔案名稱中的數字）
            };
            const exists = have_gen_list.find(item => item.fontName === this_font.fontName && item.weight == this_font.weight);
            const existPack = [];
            if (exists) {
                const { rows } = await db.query(`SELECT COUNT(DISTINCT pack) AS count FROM static_fonts`);
                const lastPackCount = rows[0]?.count ?? 0;
                console.log(exists.files.length, lastPackCount);
                let regenerate = false;
                for (let j = 0; j < lastPackCount; j++) {
                    const pack = (j + 1).toString().padStart(2, "0");
                    if (exists.files.includes(pack)) existPack.push(j);
                    else regenerate = true;
                }
                if (!regenerate) continue;
                console.log(`╔ 正在生成 ${ff_name} ${support_weights} 缺少的 ${lastPackCount - existPack.length} 包的靜態字型`);
            } else console.log(`╔ 正在生成 ${ff_name} ${support_weights} 所有的靜態字型`);

            //重新生成
            const fontData = await readFontBuffer(ff_name, support_weights);
            const buffer = fontData.buffer;
            const font = Font.create(buffer, {
                type: fontData.type,
                hinting: true,
                kerning: true
            });
            const fontObject = font.get();
            const cmap = fontObject.cmap;
            const charArray = Object.keys(cmap)
                .map(code => String.fromCodePoint(parseInt(code)))
                .filter(char => char !== "\x00"); // 過濾掉 0x00 字元
            console.log("╠ " + ff_name + " " + support_weights, "有", charArray.length, "個字");
            // 1. 查出已經存在的字
            const { rows: existing } = await db.query("SELECT char FROM static_fonts WHERE char = ANY($1)", [charArray]);
            const existingChars = new Set(existing.map(row => row.char));

            // 2. 找出還沒出現在資料庫的字
            const newChars = charArray.filter(char => !existingChars.has(char));
            const oldChars = charArray.filter(char => existingChars.has(char));

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
            console.log("╠ 目前最大的 pack 編號:", currentPack, "，裡面有", packCount, "個字");

            if (newChars.length === 0) {
                console.log("╠ 沒有新字要插入");
            } else {
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
            }
            const { rows } = await db.query(`SELECT char, families FROM static_fonts WHERE char = ANY($1::text[])`, [oldChars]);

            // 1. 準備更新用 Map<char, updated_families[]>
            const updateMap = new Map();
            for (const row of rows) {
                const set = new Set(row.families); // 避免重複
                set.add(ff_name); // 加入新字型
                updateMap.set(row.char, Array.from(set));
            }

            // 2. 組合 SQL 用的 VALUES 和綁定參數
            // const valuesSQL = [];
            // const bindings = [];
            // let paramIndex = 1;
            // const char_family_pair = [];
            // console.dir(updateMap, {
            //     depth: null,
            //     maxArrayLength: null,
            //     maxStringLength: null,
            //   });
              

            const chars = [...updateMap.keys()];
            const bindings = [ff_name, ...chars];
            const placeholders = chars.map((_, i) => `$${i + 2}`).join(', ');//參數化查詢挖空格參數化查詢
            console.log(placeholders)
            const update_chars_support_family = `
              UPDATE static_fonts
              SET families = array_append(families, $1)
              WHERE char IN (${placeholders})
                AND NOT ($1 = ANY(families));
            `;
            //查詢舉例，就是把支援某個字元的字型 ff_name 加入該字元的　family 陣列，如果已經存在就略過 
            // UPDATE static_fonts　SET families = array_append(families, 'ZhuqueFangsong')
            // WHERE char IN ('9', 'A', 'B')
            //   AND NOT ('ZhuqueFangsong' = ANY(families));


            // 3. 組合 SQL 語句送出
            await db.query(update_chars_support_family, bindings);
            // console.log(valuesSQL)

            console.log("╠ ", update_chars_support_family.length, "筆資料中我已更新", updateMap.size, "筆字元");
            let word_package_pair = (
                await db.query(
                    `SELECT pack, STRING_AGG(char, '') AS words FROM static_fonts
                    WHERE char = ANY($1)
                    GROUP BY pack ORDER BY pack;`,
                    [charArray]
                )
            ).rows;
            // {
            //     1:'一堆字',
            //     2:'另一堆字'
            // }

            // 並行生成所有 pack
            const results = [];
            let batchSize = cpuCount;

            // remove the index of existPack in
            word_package_pair = word_package_pair.filter(entry => !existPack.includes(entry.pack));
            console.log("╠ 實際上需要生成", word_package_pair.length,"包字體");
            for (let i = 0; i < word_package_pair.length; i += batchSize) {
                const batch = word_package_pair.slice(i, i + batchSize);
                const tasks = batch.map(({ pack, words }) => {
                    return runWorker({
                        ff_name,
                        support_weights,
                        words,
                        pack,
                        version_num,
                        buffer,
                        r2: state.r2
                    }).catch(error => ({
                        success: false,
                        errorMsg: error.message || "Unknown error",
                        pack
                    }));
                });

                const settled = await Promise.allSettled(tasks);

                for (const res of settled) {
                    if (res.status === "fulfilled") {
                        if (res.value.success == false) {
                            console.log("生成靜態字型的多執行序發生錯誤！生成中斷！");
                            throw new Error(JSON.stringify(res.value));
                        }
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

            await db.query("COMMIT");
            console.log("");
        }
    } catch (err) {
        console.log(err);
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
