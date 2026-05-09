import { createHash } from "crypto";
import { find_dynamic_font } from "./fontMin.js"; // 極致壓縮字型
import {
	find_static_font,
	give_static_font,
} from "../../bootstrap/fontNoMin.js"; // 靜態字型
import { db } from "../database.js";

// Simple in-memory cache for font metadata to avoid repeated DB hits per process.
const fontMetaCache = new Map(); // fontId -> { meta, ts }
const FONT_META_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashString(str) {
	// Node's createHash is faster than crypto.subtle for short strings and sync.
	return createHash("sha1").update(str).digest("hex");
}

function normalizeWordSet(wordSet) {
	// 先去重再排序，讓同一批字在不同排列時會產生同一個 hash。
	return Array.from(new Set([...wordSet]))
		.sort()
		.join("");
}

// hashString 呼叫範例。
//   const str = '你好';
//   console.log(hashString(str)); // 印出 "你好" 的 SHA-1 雜湊值

///g/:font 路由 呼叫的函式。會根據前端需要的字集，回傳字型檔

export async function getFontFamilyMeta(fontId) {
	const cached = fontMetaCache.get(fontId);
	const now = Date.now();
	if (cached && now - cached.ts < FONT_META_TTL_MS) return cached.meta;

	const { rows } = await db.query(
		`SELECT id, weights, family, name
     FROM font_family
     WHERE id = $1`,
		[fontId],
	);
	const meta = rows[0] || null;
	fontMetaCache.set(fontId, { meta, ts: now });
	return meta;
}

export const genFont = async (req, res, state) => {
	//tate 是決定要不要傳 R2>。state.r2 = true 代表前面 init R2 測試成功，後面才會傳
	//檢查字集格式
	try {
		if (!req.body || !req.body.words) {
			return {
				code: 400,
				status: "failed",
				message: "Missing words parameter",
			};
		}
		//req_word_set,min_flag,font_weight 有可能是 undefined
		//req.body.words 是使用者請求的字集
		const req_word_set = req.body.words;
		const min_flag = req.body.min;
		const req_source = req.headers.referer || req.headers.origin || "unknown"; //請求網域
		const font_family_name = req.params.font;
		let font_weight = req.body.weight;
		const meta = await getFontFamilyMeta(font_family_name);
		const font_id = meta ? meta.id : null;

		if (!font_id) {
			return {
				code: 404,
				status: "failed",
				message: `${font_family_name} doesn't exist`,
			};
		}
		//請求字重
		const allWeights = meta.weights;
		if (allWeights.length === 0)
			return {
				code: 503,
				status: "failed",
				message: "Font missing, temporary can't be use.",
			};
		//如果請求的字重不存在，則選擇最接近的字重
		if (!allWeights.includes(font_weight)) {
			const target = !font_weight || font_weight == "null" ? 400 : font_weight;
			font_weight = allWeights.reduce((prev, curr) => {
				return Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev;
			});
		}
		//正在規劃重構，改用 prometheus 監控請求量
		// await db.query(
		// 	`INSERT INTO usage_log (family_id ,weight,referer,text,min) VALUES ($1,$2,$3,$4,$5)`,
		// 	[font_id, font_weight, req_source, req_word_set, min_flag],
		// );
		if (min_flag || process.env.FORCE_MIN == "true") {
			const summery = {
				// This object is used for hashing after JSON.stringify. Do NOT change the property name and its order.
				fontFamily: font_family_name,
				fontWeight: font_weight,
				wordSet: req_word_set,
			};
			const hash = hashString(JSON.stringify(summery));
			const file_path = await find_dynamic_font({
				word_hash: hash,
				font_id: font_id,
				font_family: font_family_name,
				font_weight: font_weight,
				original_word_set: req_word_set,
				state: state,
			});
			if (file_path.status === "failed")
				return {
					code: 400,
					...file_path,
				};
			return {
				code: 200,
				status: "success",
				message: "",
				location: [file_path.location],
				name: font_family_name,
			};
		} else {
			//請求靜態字型
			//TODO:確認字型包是否存在r2，若無，怎麼辦
			// 靜態字型的 pack 索引只跟字元集合有關，不跟輸入順序有關。
			// 先正規化再算 hash，Redis 才能把相同內容但不同順序的請求視為同一筆。
			//靜態字型的 hash 不需要跟動態一樣把字體檔案參數放進去，因為 pack number 每種字都一樣，只會有試著請求不支援的字型拿到 404 的問題。這是可以接受的錯誤，故忽略
			const normalizedWordSet = normalizeWordSet(req_word_set);
			const hash = hashString(normalizedWordSet);
			const font_pack_you_need = await find_static_font(
				normalizedWordSet,
				hash,
			);
			const R2font_url = give_static_font({
				font_family: font_family_name,
				font_weight: font_weight,
				packs: font_pack_you_need,
				state: state,
			});
			return {
				code: 200,
				status: "success",
				message: "",
				location: R2font_url,
				name: font_family_name,
			};
		}

		// return res.status(200).send("Font generated");
	} catch (err) {
		console.error("Error generating font:", err);
		return {
			code: 500,
			status: "failed",
			message: `error generating font: ${err.message}`,
		};
	}
};
