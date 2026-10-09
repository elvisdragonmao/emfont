import path from "path";
import fs from "fs";
import subsetFont from "subset-font";
import { Font } from "fonteditor-core";
import {
	listFontPartFiles,
	getFontPartCharSets,
} from "../read-font-file/readFontBuffer.js";
import { logger } from "../logger.js";
const __dirname = import.meta.dirname;

function sfntType(buffer) {
	// subset-font keeps CFF outlines for OTF input, so the subset can still be OTTO.
	return buffer.toString("latin1", 0, 4) === "OTTO" ? "otf" : "ttf";
}

function isBlankGlyph(glyph) {
	return (
		glyph.unicode?.length > 0 &&
		!(glyph.contours?.length > 0) &&
		glyph.name !== ".notdef" &&
		glyph.name !== ".null" &&
		glyph.name !== "nonmarkingreturn"
	);
}

async function mergeFontParts(selected) {
	let merged = null;
	for (const { part, words } of selected) {
		// Subset each part first so fonteditor-core only has to parse the requested glyphs.
		const sfnt = await subsetFont(fs.readFileSync(part.fullPath), words, {
			targetFormat: "truetype",
		});
		const font = Font.create(sfnt, {
			type: sfntType(sfnt),
			hinting: false,
			compound2simple: true,
		});
		if (!merged) {
			merged = font;
			continue;
		}
		// fonteditor-core rescales imported glyphs to the base unitsPerEm on its own.
		merged.merge(font, { scale: true, adjustGlyf: false });
		// merge() silently skips contour-less glyphs (spaces), which would drop their cmap entries.
		const mergedTtf = merged.get();
		const known = new Set(mergedTtf.glyf.flatMap(g => g.unicode ?? []));
		for (const glyph of font.get().glyf) {
			if (!isBlankGlyph(glyph)) continue;
			glyph.unicode = glyph.unicode.filter(u => !known.has(u));
			if (glyph.unicode.length > 0) mergedTtf.glyf.push(glyph);
		}
	}
	return merged.write({ type: "ttf", hinting: false, toBuffer: true });
}

// Returns the sfnt to subset from, or null when the weight has no files.
async function loadSubsetSource(originalFontFamily, font_weight, words) {
	const files = listFontPartFiles(originalFontFamily, font_weight);
	if (files.length === 0) {
		logger.warn(`找不到字體: ${originalFontFamily} ${font_weight}`);
		return null;
	}
	// Single-file weights skip the code point scan entirely.
	if (files.length === 1) return fs.readFileSync(files[0].fullPath);

	const parts = getFontPartCharSets(originalFontFamily, font_weight);
	if (parts.length === 0) {
		logger.warn(`找不到字體: ${originalFontFamily} ${font_weight}`);
		return null;
	}
	const needed = new Set(Array.from(words, char => char.codePointAt(0)));
	const selected = [];
	for (const part of parts) {
		if (needed.size === 0) break;
		const owned = [];
		for (const cp of needed) {
			if (part.codePoints.has(cp)) owned.push(cp);
		}
		if (owned.length === 0) continue;
		for (const cp of owned) needed.delete(cp);
		selected.push({
			part,
			words: owned.map(cp => String.fromCodePoint(cp)).join(""),
		});
	}
	// Nothing matched: emit an empty subset from the primary file, same as a single-file font would.
	if (selected.length <= 1) {
		return fs.readFileSync((selected[0]?.part ?? parts[0]).fullPath);
	}
	return mergeFontParts(selected);
}

// generateFont: geneerate subset font and save to disk.
async function generateFont(
	originalFontFamily,
	font_weight,
	words,
	output_name,
	put_folder = "../../_data/_generated", //default
	fontfile = null,
) {
	try {
		// 如果沒提供 buffer，就讀取字型檔
		if (!fontfile) {
			fontfile = await loadSubsetSource(originalFontFamily, font_weight, words);
		}
		if (!fontfile) {
			return {
				status: "failed",
				message: "emfont can't read original font, please try again later.",
				location: "null",
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
			targetFormat: "woff2",

			// output: path.join(destFolder, output_name), // Set custom output file path
		});
		await fs.promises.writeFile(outputPath, resultBuffer);

		logger.debug(
			`sub font generate successfuly: ${output_name} (${words.length} glyphs)`,
		);
		return {
			status: "success",
			location: `${output_name}`,
		};
	} catch (err) {
		logger.error(`sub font generate failed: ${output_name} (${err.message})`);
		return {
			status: "failed",
			message: "emfont can't read original font, please try again later.",
			location: "null",
		};
	}
}
export { generateFont };
