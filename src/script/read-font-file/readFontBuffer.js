//讀字型檔案，放入緩衝區
import path from "path";
import * as fontkit from "fontkit";
import fs from "fs";
const __dirname = import.meta.dirname;
const __Font_storge_path_base = path.join(__dirname, "../../","_data", "original-fonts"); //projectroot/src/_data/original-fonts/
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
export {readFontBuffer};