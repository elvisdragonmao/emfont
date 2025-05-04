//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案 (開機時重切)
import { db } from "./database.js";
import { readFontBuffer } from "./font_min.js";
import { Worker } from "worker_threads";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import os from "os";
const __dirname = import.meta.dirname;
const cpuCount = os.cpus().length + parseInt(process.env.THREADS ?? 0);
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

async function complete_ff_name_support_char_in_db(ff_name, charArray, existingChars) {
    try {
        // 2. 找出還沒出現在資料庫的字
        const newChars = charArray.filter(char => !existingChars.has(char));
        console.log(ff_name, "newchar", newChars);
        if (newChars.length === 0) {
            console.log("╠ 沒有新字要插入");
            return true;
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
        // console.log("╠ 目前最大的 pack 編號:", currentPack, "，裡面有", packCount, "個字");
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
                const baseIndex = index * 3; //parameterized query count increase 3(char, pack, families) in a for
                values.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
                params.push(char, pack, families);
            });
            //console.log("正在插入第", i, "到", i + batch.length, "個字");
            //如果主鍵（或唯一鍵）衝突，就將 families 陣列中「尚未存在的字型」加進去。
            await db.query(
                `INSERT INTO static_fonts (char, pack, families)
                     VALUES ${values.join(",")}
                     ON CONFLICT (char) DO UPDATE
                       SET families = (
                         SELECT ARRAY(
                           SELECT DISTINCT unnest(static_fonts.families || EXCLUDED.families)
                         )
                       )`,
                params
            );
        }

        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}
async function regenerateAllStaticFont(state, have_gen_list) {
    // list all have to regenerate fonts family and theirs support weights .
    try {
        const all_fonts = (
            await db.query(
                `SELECT ff.id AS ff_name, w AS support_weights
                FROM font_family ff
                JOIN LATERAL unnest(ff.weights) AS w ON true
                ORDER BY ff.id,support_weights;
            ;`
            )
        ).rows;
        //取得字型版本號，版本號定期更新，所以會自動重切
        let version_num = (await db.query(`SELECT bullet from version order BY start DESC limit 1;`)).rows; //[0].bullet
        version_num = version_num.length == 0 ? 100 : version_num[0].bullet;
        console.log("目前版本: ", version_num);
        // get length of all_fonts
        const all_fonts_length = all_fonts.length;
        let currentIndex = 0;
        for (const { ff_name, support_weights } of all_fonts) {
            currentIndex++;
            state.bulletin = "⌨️ 正在生成 " + ff_name + " 的靜態字型 (總進度 " + currentIndex + "/" + all_fonts_length + ")";
            const this_font = {
                version: version_num,
                fontName: ff_name, // 字型名稱（資料夾名稱）
                weight: support_weights // 字型的 weight（檔案名稱中的數字）
            };
            //讀字型檔案，取出所有支援的字型
            const readFile_res = await readFontBuffer(ff_name, support_weights, true);
            const fontfile = readFile_res.fontfile;
            const supportedCodePoints = Array.from(fontfile.characterSet);
            const charArray = supportedCodePoints.map(cp => String.fromCodePoint(cp)).filter(char => char !== "\x00");
            console.log("╔ " + ff_name + " " + support_weights, "有", charArray.length, "個字");
            // 1. 查出此字型支援，且資料庫已經有綁定的字
            const { rows: existing } = await db.query("SELECT char FROM static_fonts WHERE char = ANY($1) AND  $2 =  any(families) ", [charArray, ff_name]);
            const existingChars = new Set(existing.map(row => row.char));

            // const oldChars = charArray.filter(char => existingChars.has(char));
            //把此字型支援的所有字元裡頭紀錄的支援字型陣列加入這次的字型（如果還沒加入的話）
            await complete_ff_name_support_char_in_db(ff_name, charArray, existingChars);
            //this_static_font_dir_status 是 ff_name-support_weights 的靜態字型在生成列表中的狀態，
            // 包括字型id 、字重和生成的檔案編號，從 have_gen_list（有所有靜態已生成資料夾的屬性） 拆解出來
            const this_static_font_dir_status = have_gen_list.find(item => item.fontName === this_font.fontName && item.weight == this_font.weight && item.version == version_num);
            let existPack = [];
            let ready_regen = []; //put pack number ready to gen
            //查詢這個字型支援字元用到的 pack
            const all_need_gen_pack = (await db.query(`SELECT pack FROM static_fonts WHERE $1 = ANY(families) GROUP BY pack ORDER BY pack;`, [ff_name])).rows;
            //all_need_gen_pack=[{ pack: 1 },{ pack: 55 },{ pack: 56 }...]
            const all_pack_numbers = all_need_gen_pack.map(item => item.pack.toString().padStart(3, "0"));
            if (this_static_font_dir_status) {
                existPack = this_static_font_dir_status.files;
                //all_pack_numbers=[00,55,56]
                let regenerate = false;
                //確保該字型資料夾底下的該出現的檔案都在
                all_pack_numbers.forEach(function (pack_num) {
                    if (!this_static_font_dir_status.files.includes(pack_num)) {
                        ready_regen.push(pack_num);
                        regenerate = true;
                    }
                });
                if (!regenerate) continue; //全部存在，跳過重新生成
                console.log(`╠ ${ff_name}-${support_weights} 應該共有 ${all_need_gen_pack.length} 包字型。本地只有其中 ${existPack.length} 包字體`);
            } else {
                ready_regen = all_pack_numbers;
            }
            console.log(`╠ 正在生成 ${ff_name} ${support_weights} 缺少的 ${all_pack_numbers.length - existPack.length} 包靜態字型`);
            //重新生成
            let word_package_pair = (
                await db.query(
                    `SELECT pack, STRING_AGG(char, '') AS words FROM static_fonts
                    WHERE char = ANY($1)
                    AND pack = ANY($2::int[])
                    GROUP BY pack ORDER BY pack;`,
                    [charArray, ready_regen]
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
            console.log("╠ 正在生成", word_package_pair.length, "包字體");
            for (let i = 0; i < word_package_pair.length; i += batchSize) {
                const batch = word_package_pair.slice(i, i + batchSize);
                const tasks = batch.map(({ pack, words }) => {
                    return runWorker({
                        ff_name,
                        support_weights,
                        words,
                        pack,
                        version_num,
                        fontfile,
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
async function find_static_font(word_set, font_family_name) {
    // 回傳要用到的字型包編號
    try
    {
        //載入該字型支援的所有字和對應的 pack
        word_set = word_set.split("");
        //查詢請求的字分別散落在哪些字型包中
        const query = "SELECT DISTINCT pack FROM static_fonts WHERE char = ANY($1::text[]) and $2 = ANY(families)";
        const res = await db.query(query, [word_set, font_family_name]);

        // 查請求的字需要在哪些 pack
        return res.rows.map(row => String(row.pack).padStart(3, "0"));
    } catch (error) {
        console.error("靜態字體位置查詢失敗:", error);
        throw error;
    }
}
function give_static_font(font_family, font_weight, packs, state) {
        // 回傳字型包路徑
        const version_num = state.static_font_version;       
        const prefix = `${version_num}-${font_family}-${font_weight}/`;
        const results = packs.map(pack => {
            const filename = `${pack}.woff2`;
            return `${state.static_font_base}/${prefix}${filename}`;
        });
        // 直接回傳陣列
        return results;
}
export { find_static_font, give_static_font, regenerateAllStaticFont };
