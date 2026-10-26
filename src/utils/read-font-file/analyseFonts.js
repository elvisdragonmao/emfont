import { db } from "../../utils/database.js";
import { ScriptFinder } from "../../utils/scriptFinder.js";
import { get_glyphs } from "./allGlyphs.js";

const finder = new ScriptFinder();

async function runFontForgeBatch(fontChars) {
	const combinedText = fontChars.join("");
	return await finder.charClassify(combinedText);
}

/**
 * 將字型家族的 Unicode Script 統計結果批次寫入資料庫。
 *
 * 每個字型家族對應一筆資料，包含：
 * - id：字型家族 ID
 * - name：字型家族名稱
 * - languages：各 Unicode Script 的字元數量
 *
 * languages 範例：
 * {
 *   Common: 1461,
 *   Latin: 361,
 *   Bopomofo: 73,
 *   Inherited: 18,
 *   Greek: 50,
 *   Cyrillic: 66,
 *   Han: 30517,
 *   Hangul: 2447,
 *   Hiragana: 90,
 *   Katakana: 298
 * }
 *
 * values 格式：
 * [
 *   "GenYoGothicTC",
 *   "GenYoGothicTC",
 *   { Common: 1461, Latin: 361, Han: 30517 },
 *   "font2",
 *   "font2",
 *   { Latin: 200, Han: 500 }
 * ]
 *
 * @param {Array<string | Record<string, number>>} values
 *   SQL 查詢參數，依照 id、name、languages 排列。
 * @param {string[]} placeholders
 *   SQL VALUES 佔位符，例如：
 *   ["($1, $2, $3)", "($4, $5, $6)"]
 * @returns {Promise<void>}
 */
async function writeToDatabase(values, placeholders) {
	if (placeholders.length === 0) return;

	await db.query(
		`
        INSERT INTO font_family (id, name, languages)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (id)
        DO UPDATE SET
            languages = EXCLUDED.languages;
        `,
		values,
	);
}

async function analyseFontsInBatches(fontData) {
	// fontName -> 不重複字元集合
	const fontGlyphMap = new Map();

	let processed = 0;

	for (const fontMeta of fontData) {
		const fontId = fontMeta.fontName;
		const fontWeight = fontMeta.weights;

		try {
			const chararray = await get_glyphs(fontId, fontWeight);

			if (!fontGlyphMap.has(fontId)) {
				fontGlyphMap.set(fontId, new Set());
			}

			const glyphSet = fontGlyphMap.get(fontId);

			for (const char of chararray) {
				glyphSet.add(char);
			}
		} catch (err) {
			throw new Error(`分析字型失敗 (${fontId} ${fontWeight})`, { cause: err });
		}

		processed++;
		const percentage = ((processed / fontData.length) * 100).toFixed(1);

		process.stdout.write(`\r正在讀取字型字元 ${percentage}%`);
	}

	const values = [];
	const placeholders = [];

	let index = 0;

	for (const [fontId, glyphSet] of fontGlyphMap) {
		const languageJson = await runFontForgeBatch([...glyphSet]);

		const offset = index * 3;

		values.push(fontId, fontId, languageJson);

		placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);

		index++;
	}

	try {
		await writeToDatabase(values, placeholders);
	} catch (err) {
		throw new Error("資料庫寫入失敗", { cause: err });
	}

	console.log("\n✅ 已完成字型語言統計");

	return true;
}

export { analyseFontsInBatches };
