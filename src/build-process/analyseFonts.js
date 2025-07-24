import { execFile } from "child_process";
import path from "path";
const codepoints_analyse_py_path = path.resolve(
    "src/build-process/fontforge-py/font_script_report.py"
);
async function runFontForgeBatch(fontData) {
    const args = fontData.map((f) => `${f.fontName}=${f.sample_file}`);
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
                    reject(
                        new Error(
                            "JSON parse error: " +
                                e.message +
                                "\nOutput:" +
                                stdout
                        )
                    );
                }
            }
        );
    });
}
async function writeToDatabase(batchResult) {
    console.log(batchResult);
    // console.log("inster !")
}
async function analyseFontsInBatches(fontData, batchSize = 2) {
    const allResults = {};
    for (let i = 0; i < fontData.length; i += batchSize) {
        const spilt_fontData = fontData.slice(i, i + batchSize);
        // console.log(`分析第 ${i / batchSize + 1} 批:`, spilt_fontData);
        process.stdout.write(
            `\r正在統計字型語言分類${i + batchSize}/${fontData.length}`
        );
        try {
            const batchResult = await runFontForgeBatch(spilt_fontData);

            writeToDatabase(batchResult).catch((err) => {
                console.error("資料庫寫入失敗：", err);
            });
        } catch (err) {
            console.error("批次分析失敗：", err);
        }
    }
}
export {analyseFontsInBatches};