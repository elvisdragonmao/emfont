import { getSupportedChars } from "./readFontBuffer.js";
async function get_glyphs(ff_name, weights)
{
    const charArray = getSupportedChars(ff_name, weights);
    if (charArray === null) {
        throw new Error(`讀取字型檔案失敗！${ff_name} ${weights}`);
    }
    return charArray;
}

export {get_glyphs};
