import { db } from "../../utils/database.js";
import { ScriptFinder } from "../../utils/scriptFinder.js";
import { get_glyphs } from "./all-glyphs.js";
const finder = new ScriptFinder();
async function runFontForgeBatch(fontChars) {
	const combinedText = fontChars.join("");
	const result = await finder.charClassify(combinedText);
	return result;// e.g., { Latin: 5, Han: 2, Common: 1 }
}

/**
 * @param {JASON} batchResult
 */
async function writeToDatabase(values, placeHolder) {
	/*
      'GenYoGothicTC',
  {
    Common: 1461,
    Latin: 361,
    Bopomofo: 73,
    Inherited: 18,
    Greek: 50,
    Cyrillic: 66,
    Han: 30517,
    Hangul: 2447,
    Hiragana: 90,
    Katakana: 298
  },
  'font2',
  {
    language1: count,
    ...
  }

   */
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
async function analyseFontsInBatches(fontData) {
	//SQL insert command variable
	const values = [];
	const placeHolder = []; //參數空格，$1,$2,$3...
	var loop_counter = 0;
	for (const fontMeta of fontData) {
        const percentage = ((loop_counter / fontData.length) * 100).toFixed(1);
        process.stdout.write(`\r正在統計字型語言分類 ${percentage}%`);
		/* fontMeta example:
            {
                fontName: 'jfOpenHuninn',
                sample_file: '/home/iach526/Hateno/ancient-lab/emfont/src/_data/original-fonts/jfOpenHuninn/400.ttf',
                weights: '400'
            }
        */
        try {
            const fontId = fontMeta.fontName;
            const fontweight = fontMeta.weights;
            const chararray = await get_glyphs(fontId, fontweight);
            const languageJson = await runFontForgeBatch(chararray);

            values.push(fontId);
            values.push(languageJson);
            placeHolder.push(`($${loop_counter * 2 + 1},$${loop_counter * 2 + 2})`);
        } catch (err) {
            throw new Error(`\n❌ 分析字型失敗 (${fontMeta.fontName} ${fontMeta.weights}):`, err);
        }
		loop_counter += 1;
	}
	await writeToDatabase(values,placeHolder).catch(err => {
	        throw new Error("資料庫寫入失敗：", err);
	    });
    console.log("\n✅已完成字數語言統計")
    return true
}
export { analyseFontsInBatches };
