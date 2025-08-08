import path from "path";
import fs from "fs";
import subsetFont from "subset-font";
import {readFontBuffer,check_in_charArray} from "../read-font-file/readFontBuffer.js"
const __dirname = import.meta.dirname;
async function generateFont(
    originalFontFamily,
    font_weight,
    words,
    output_name,
    put_folder = "../../_data/_generated", //default
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

        // 檢查是否請求的所有字該字型檔都生不出來，避免生成空的檔案。
        const continue_gen=await check_in_charArray(originalFontFamily,font_weight,words);
        if(!continue_gen)
        {
            //字型檔不存在請求的任何一個字元
            return {
            status: "failed",
            message: "user input char doesn't exist in original font",
            location: "null"
        };
        }
        //如果部分字有缺仍然繼續生成，但會顯示貓爪

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