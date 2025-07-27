import { execFile } from "child_process";
import path from "path";
import { db } from "../database.js";
const codepoints_analyse_py_path = path.resolve("src/build-process/fontforge-py/font_script_report.py");
async function runFontForgeBatch(fontData) {
    const args = fontData.map(f => `${f.fontName}=${f.sample_file}`);
    return new Promise((resolve, reject) => {
        execFile(
            "fontforge",
            ["-script", codepoints_analyse_py_path, ...args],
            { maxBuffer: 100 * 1024 * 1024 }, // 避免 stdout buffer 不夠
            (error, stdout, stderr) => {
                if (error) return reject(error);
                try {
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error("JSON parse error: " + e.message + "\nOutput:" + stdout));
                }
            }
        );
    });
}
/**
 * @param {JASON} batchResult
 */
async function writeToDatabase(batchResult) {
    //fontType is key, value is {language:count} also JSON.
    //batchResult={"fontType1":{"Latin":52,"HAN":10500},"fontType2":{"Latin":52,"HAN":10500}}
    batchResult = Object.entries(batchResult);
    const values = [];
    const placeHolder = []; //參數空格，$1,$2,$3...
    for (let i = 0; i < batchResult.length; i++) {
        {
            const [fontId, languageJson] = batchResult[i];
            values.push(fontId);
            values.push(JSON.stringify(languageJson));
            placeHolder.push(`($${i * 2 + 1},$${i * 2 + 2})`);
        }
        await db.query(
            `
        INSERT INTO font_family (id, languages)
        VALUES ${placeHolder.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET languages = EXCLUDED.languages;
        `,
            values
        );
    }
}
async function analyseFontsInBatches(fontData, batchSize = 1) {
    const allResults = {};
    for (let i = 0; i < fontData.length; i += batchSize) {
        const spilt_fontData = fontData.slice(i, i + batchSize);
        // console.log(`分析第 ${i / batchSize + 1} 批:`, spilt_fontData);
        process.stdout.write(`\r正在統計字型語言分類${i + batchSize}/${fontData.length}`);
        try {
            const batchResult = await runFontForgeBatch(spilt_fontData);
            Object.assign(allResults, batchResult);
        } catch (err) {
            console.error("批次分析失敗：", err);
        }
        await writeToDatabase(allResults).catch(err => {
            console.error("資料庫寫入失敗：", err);
        });
    }
}
export { analyseFontsInBatches };
