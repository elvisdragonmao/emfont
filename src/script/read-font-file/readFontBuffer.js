//讀字型檔案，放入緩衝區
import path from "path";
import * as fontkit from "fontkit";
import fs from "fs";
const __dirname = import.meta.dirname;
const __Font_storge_path_base = path.join(__dirname, "../../","_data", "original-fonts"); //projectroot/src/_data/original-fonts/
/**
 * 讀取字型檔案
 * @param {string} originalFontFamily 字型資料夾名稱
 * @param {string} font_weight 字重檔名（不含副檔名）
 * @param {boolean} use_fontkit 是否使用 fontkit 解析
 * @returns {Promise<{success: boolean, fontfile?: Buffer|object, type?: string, error?: string}>}
 */
async function readFontBuffer(originalFontFamily, font_weight, use_fontkit = false) {
    // Construct the full path to the font file based on the family and variant
    // extensions name may be ttf or otf. Try to find any of them
    const file_found = [".ttf", ".otf"]
        .map(ext => ({
            ext: ext.slice(1),
            fullPath: path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}${ext}`)
        }))
        .find(({ fullPath }) => fs.existsSync(fullPath));
    if (!file_found) {
        console.error("找不到字體:", path.join(__Font_storge_path_base, originalFontFamily, `${font_weight}.ttf`));
        return { success: false };
    } else {
        let fontfile;
        if (use_fontkit) {
            fontfile = fontkit.openSync(file_found.fullPath);
            //Opens a font file asynchronously, and returns a Promise with a font object
            // fontfile is a fontkit object
        } else {
            fontfile = fs.readFileSync(file_found.fullPath);
        }
        return { fontfile, type: file_found.ext, success: true };
    }
}
/**
 * 檢查字型是否支援指定字元集合
 * @param {string} ff_name 字型資料夾名稱
 * @param {string} weight 字重檔名
 * @param {string} char_set 要檢查的字元集合
 * @returns {Promise<boolean>} true 代表字型至少支援一個字元，false 代表完全不支援
 */
async function check_in_charArray(ff_name, weight, char_set) {
    try {
        const { success, fontfile, error } = await readFontBuffer(ff_name, weight, true);
        if (!success) {
            console.error(error);
            return false;
        }

        const availableChars = Array.from(char_set)
            .filter(char => fontfile.hasGlyphForCodePoint(char.codePointAt(0)));
        return availableChars.length > 0;
    } catch (err) {
        console.error("檢查字型支援時發生錯誤:", err);
        return false;
    }
}

export {readFontBuffer,check_in_charArray};