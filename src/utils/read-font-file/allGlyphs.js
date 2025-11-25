import { readFontBuffer } from "./readFontBuffer.js";
async function get_glyphs(ff_name, weights)
{
    const readFile_res = await readFontBuffer(ff_name, weights, true);
    if (readFile_res.success == false) {
        console.warn("讀取字型檔案失敗！");
    }
    const fontfile = readFile_res.fontfile;
    const supportedCodePoints = Array.from(fontfile.characterSet);
    const charArray = supportedCodePoints.map(cp => String.fromCodePoint(cp)).filter(char => char !== "\x00");
    return charArray;
}

export {get_glyphs};