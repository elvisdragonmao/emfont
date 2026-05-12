import fs from "fs";
import path from "path";
import subsetFont from "subset-font";
import { logger } from "../logger.js";
import { readFontBuffer } from "../read-font-file/readFontBuffer.js";
const __dirname = import.meta.dirname;
// generateFont: geneerate subset font and save to disk.
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
		await fs.promises.mkdir(destFolder, { recursive: true });

		// It is possible to generate a file without any fonts, which happens when the original font file doesn't support any of the requested fonts
		// The users's browser will report an error if it reads it empty file.
		// 可能生成不包含任何 glyphs 的檔案，這會發生在原始字型檔不支援任何請求的字型時，使用者的瀏覽器在讀取到空檔案時會報錯，但是這是正常行為。

		// I don't intend to do any checking, because the time cost of preventing this is much greater than the time it takes to request an empty file.

		const outputPath = path.join(destFolder, `${output_name}`);
		const resultBuffer = await subsetFont(fontfile, words, {
			targetFormat: "woff2"

			// output: path.join(destFolder, output_name), // Set custom output file path
		});
		await fs.promises.writeFile(outputPath, resultBuffer);

		logger.debug(`sub font generate successfuly: ${output_name} (${words.length} glyphs)`);
		return {
			status: "success",
			location: `${output_name}`
		};
	} catch (err) {
		logger.error(`sub font generate failed: ${output_name} (${err.message})`);
		return {
			status: "failed",
			message: "emfont can't read original font, please try again later.",
			location: "null"
		};
	}
}
export { generateFont };
