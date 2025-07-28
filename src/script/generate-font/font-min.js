import path from "path";
import subsetFont from "subset-font";
import {readFontBuffer} from "../read-font-file/readFontBuffer.js"
const __dirname = import.meta.dirname;
async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name,
    put_folder = "../_data/_generated", //default
    fontfile = null
) {
    try {
        // 如果沒提供 buffer，就讀取字型檔
        let type, success;
        if (!fontfile) {
            ({ fontfile, type, success } = await readFontBuffer(originalFontFamily, font_weight));
        }
        if (!success) {
            return {
                status: "failed",
                message: "emfont can't read original font, please try again later.",
                location: "null"
            };
        }
        // // 確保資料夾存在
        const destFolder = path.join(__dirname, put_folder);
        fs.mkdirSync(destFolder, { recursive: true });

        // // 輸出路徑

        // // 寫入檔案
        // fs.writeFileSync(outputPath, outBuffer);
        const outputPath = path.join(destFolder, `${output_name}`);
        await subsetFont(fontfile, words, {
            targetFormat: "woff2"

            // output: path.join(destFolder, output_name), // Set custom output file path
        })
            .then(resultBuffer => {
                // ✅ 寫入結果到檔案
                fs.writeFileSync(outputPath, resultBuffer);
            })
            .catch(err => {
                console.error("Error creating subset font:", err);
            });
        return {
            status: "success",
            location: `${output_name}`
        };
    } catch (err) {
        console.error(err);
        return {
            status: "failed",
            message: "emfont can't read original font, please try again later.",
            location: "null"
        };
    }
}
export {generateFont};