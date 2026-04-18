import fs from "fs";
import path from "path";
import { generateFont } from "./makeFont.js";
import { logger } from "../logger.js";

const __dirname = import.meta.dirname;
const dynamicFontUrlCache = new Map();

async function find_dynamic_font({
	word_hash,
	font_id,
	font_family,
	font_weight,
	original_word_set,
	state,
}) {
	const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff2`;
	const cached = dynamicFontUrlCache.get(little_font_package);
	if (cached && cached.expiresAt > Date.now()) {
		// 邏輯上假定檔案存在 直接回傳快取的 URL，不需要再檢查一次檔案是否存在，因為我們在設定快取時就已經確認過檔案存在了。
		// 如果檔案被刪除了，那麼即使 cache hit，回傳的 URL 會是無效的，但這種情況應該是非常罕見的，且我們可以接受這種風險，反正快取也就 5 分鐘
		logger.debug(
			`dynamic font ${little_font_package} cache hit, returning cached URL: ${cached.url}`,
		);
		return {
			status: "success",
			location: cached.url,
		};
	}

	const localPath = path.join(
		__dirname,
		"_data",
		"_generated",
		little_font_package,
	);
	let file_exist = false;
	try {
		await fs.promises.access(localPath, fs.constants.F_OK);
		file_exist = true;
	} catch {
		file_exist = false;
	}

	const file_url = `${state.baseURL}/_generated/${little_font_package}`;
	logger.debug(
		`Checking dynamic font: ${little_font_package}, cache exist: ${file_exist}`,
	);
	if (file_exist) {
		dynamicFontUrlCache.set(little_font_package, {
			url: file_url,
			expiresAt: Date.now() + 5 * 60 * 1000,
			// expires for 5 minutes
		});
		logger.debug(
			`動態字型檔 ${little_font_package} 已存在，直接回傳 URL 快取: ${file_url}`,
		);
		return {
			status: "success",
			location: file_url,
		};
	}

	try {
		const generated = await generateFont(
			font_family,
			font_weight,
			original_word_set,
			little_font_package,
		);
		if (generated.status === "failed") {
			return generated;
		}
		const generatedUrl = `${state.baseURL}/_generated/${generated.location}`;
		dynamicFontUrlCache.set(little_font_package, {
			url: generatedUrl,
			expiresAt: Date.now() + 10 * 60 * 1000,
		});
		return {
			status: "success",
			location: generatedUrl,
		};
	} catch (err) {
		logger.error(`字體生成失敗: ${err.message}`);
		throw new Error("Font generation failed", err);
	}
}
export { find_dynamic_font };
