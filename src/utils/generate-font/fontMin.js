import fs from "fs";
import path from "path";
import { generateFont } from "./makeFont.js";
import { logger } from "../logger.js";

const __dirname = import.meta.dirname;
const dynamicFontUrlCache = new Map();
const dynamicFontInflight = new Map();
const DYNAMIC_FONT_EXISTING_FILE_TTL_MS = 5 * 60 * 1000;
const DYNAMIC_FONT_GENERATED_TTL_MS = 10 * 60 * 1000;
const configuredDynamicFontCacheMaxSize = Number.parseInt(
	process.env.DYNAMIC_FONT_CACHE_MAX_SIZE || "5000",
	10,
);
const DYNAMIC_FONT_CACHE_MAX_SIZE =
	Number.isFinite(configuredDynamicFontCacheMaxSize) &&
	configuredDynamicFontCacheMaxSize > 0
		? configuredDynamicFontCacheMaxSize
		: 5000;

function pruneExpiredCache(now = Date.now()) {
	for (const [key, value] of dynamicFontUrlCache) {
		if (value.expiresAt <= now) {
			dynamicFontUrlCache.delete(key);
		}
	}
}

function setDynamicFontCache(key, url, ttlMs) {
	pruneExpiredCache();
	dynamicFontUrlCache.set(key, {
		url,
		expiresAt: Date.now() + ttlMs,
	});

	while (dynamicFontUrlCache.size > DYNAMIC_FONT_CACHE_MAX_SIZE) {
		const oldestKey = dynamicFontUrlCache.keys().next().value;
		dynamicFontUrlCache.delete(oldestKey);
	}
}

function getDynamicFontCache(key) {
	const cached = dynamicFontUrlCache.get(key);
	if (!cached) return null;
	if (cached.expiresAt <= Date.now()) {
		dynamicFontUrlCache.delete(key);
		return null;
	}

	// Move cache hits to the end so the size cap evicts colder entries first.
	dynamicFontUrlCache.delete(key);
	dynamicFontUrlCache.set(key, cached);
	return cached;
}

async function find_dynamic_font({
	word_hash,
	font_id,
	font_family,
	font_weight,
	original_word_set,
	state,
}) {
	const little_font_package = `${word_hash}-${font_family}-${font_weight}.woff2`;
	const cached = getDynamicFontCache(little_font_package);
	if (cached) {
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

	const inflight = dynamicFontInflight.get(little_font_package);
	if (inflight) {
		logger.debug(`dynamic font ${little_font_package} inflight hit`);
		return inflight;
	}

	const generated = findOrGenerateDynamicFont({
		little_font_package,
		font_family,
		font_weight,
		original_word_set,
		state,
	});
	dynamicFontInflight.set(little_font_package, generated);
	try {
		return await generated;
	} finally {
		dynamicFontInflight.delete(little_font_package);
	}
}

async function findOrGenerateDynamicFont({
	little_font_package,
	font_family,
	font_weight,
	original_word_set,
	state,
}) {
	const localPath = path.join(
		__dirname,
		"..",
		"..",
		"_data",
		"_generated",
		little_font_package,
	);
	logger.debug(`Checking if dynamic font file exists at path: ${localPath}`);
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
		setDynamicFontCache(
			little_font_package,
			file_url,
			DYNAMIC_FONT_EXISTING_FILE_TTL_MS,
		);
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
		setDynamicFontCache(
			little_font_package,
			generatedUrl,
			DYNAMIC_FONT_GENERATED_TTL_MS,
		);
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
