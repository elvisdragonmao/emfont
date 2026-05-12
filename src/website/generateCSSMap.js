import { db } from "../utils/database.js";
import path from "path";
import { promises as fs } from "fs";
import { logger } from "../utils/logger.js";
async function writeCssFile(font_id, weight, cssBlocks) {
	const __dirname = import.meta.dirname;
	const put_folder = `../_data/css/${font_id}`;
	const destFolder = path.join(__dirname, put_folder);
	await fs.mkdir(destFolder, { recursive: true });
	const fileName = `${destFolder}/${weight}.css`;
	try {
		await fs.writeFile(fileName, cssBlocks, "utf8");
		logger.info(`✅ Generated CSS file: ${fileName}`);
	} catch (err) {
		logger.error("❌ Failed to write CSS file:", err);
	}
}
async function generateCSSMap(font_id, weight, state) {
	const { rows } = await db.query(
		`select pack,string_agg("char" , '') AS chars  from static_fonts where $1 = any (families) group by pack`,
		[font_id],
	);
	// from char to unicode-range
	const packs = rows.map(row => {
		const codePoints = Array.from(row.chars).map(ch => ch.codePointAt(0));
		codePoints.sort((a, b) => a - b);

		const ranges = [];
		let start = codePoints[0];
		let prev = codePoints[0];
		for (let i = 1; i < codePoints.length; i++) {
			const cp = codePoints[i];
			if (cp === prev + 1) {
				prev = cp;
			} else {
				// End the current contiguous range and start a new one.
				ranges.push([start, prev]);
				start = cp;
				prev = cp;
			}
		}
		// Add the final range.
		ranges.push([start, prev]);
		// Format as CSS unicode-range values.
		const unicodeRanges = ranges.map(([a, b]) =>
			a === b ? `U+${a.toString(16)}` : `U+${a.toString(16)}-${b.toString(16)}`,
		);

		return {
			pack: row.pack,
			unicodeRanges: unicodeRanges.join(", "),
		};
	});
	// Generate CSS.
	// src: url.
	const cssBlocks = packs.map(p => {
		const paddedPack = String(p.pack).padStart(3, "0");
		return `@font-face {
    font-family: '${font_id}';
    font-style: normal;
    font-weight: ${weight};
    font-display: swap;
    src: url('https://font.emtech.cc/file/_generated/${state.static_font_version}-${font_id}-${weight}/${paddedPack}.woff2') format('woff2');
    unicode-range: ${p.unicodeRanges};
  }\n`;
	});

	writeCssFile(font_id, weight, cssBlocks, state);
	return cssBlocks;
}

export { generateCSSMap };
