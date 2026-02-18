//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案 (開機時重切)
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";
import { readFontBuffer } from "../utils/read-font-file/readFontBuffer.js";
import { Worker } from "worker_threads";
import { Redis } from "ioredis";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import os from "os";
const redis = new Redis(process.env.REDIS_URL);
const __dirname = import.meta.dirname;
const cpuCount = os.cpus().length + parseInt(process.env.THREADS ?? 0);
const runWorker = data => {
	try {
		return new Promise((resolve, reject) => {
			const worker = new Worker(
				path.resolve(__dirname, "../utils/generate-font/fontNoMin.js"),
				{
					workerData: data,
				},
			);

			worker.on("message", result => {
				resolve(result);
			});

			worker.on("error", error => {
				reject(error);
			});

			worker.on("exit", code => {
				if (code !== 0)
					reject(new Error(`Worker stopped with exit code ${code}`));
			});
		});
	} catch (err) {
		logger.error("Worker thread error:", err);
	}
};
async function complete_ff_name_support_char_in_db(ff_name, lost_chars) {
	try {
		if (lost_chars.length == 0) {
			logger.info("╠ 沒有新字需要異動");

			return true;
		}
		const no_record_chars = lost_chars
			.filter(r => r.status === "not_exist_char")
			.map(r => r.char);

		const no_fontfamily_binding = lost_chars
			.filter(r => r.status === "missing_family")
			.map(r => r.char);
		// update support list that exist in db but not in  support family list
		if (no_fontfamily_binding.length != 0) {
			await db.query(
				`UPDATE static_fonts
            SET families = (
                SELECT ARRAY(
                SELECT DISTINCT unnest(families || $1)
                )
            )
            WHERE char = ANY($2)`,
				[[ff_name], no_fontfamily_binding],
			);
		}

		// find the maxiumn pack id and check its total char counts
		const { rows } = await db.query(
			`SELECT pack, COUNT(*)::int AS count
            FROM static_fonts
            WHERE pack = (SELECT MAX(pack) FROM static_fonts)
            GROUP BY pack;
`,
		);

		let currentPack = 0;
		let packCount = 0;

		const { pack, count } = rows[0] ?? {};
		currentPack = pack ? parseInt(pack, 10) : 0;
		packCount = count ?? 0;

		const inserts = [];
		for (const char of no_record_chars) {
			if (packCount >= 135) {
				currentPack += 1;
				packCount = 0;
			}

			inserts.push({
				char,
				pack: currentPack,
				families: [ff_name],
			});

			packCount += 1;
		}

		logger.debug(
			"新字數量:",
			no_record_chars.length,
			"需要新增的資料筆數:",
			inserts.length,
		);
		// 4. 把新字 insert 進去，每次語句插入 1000 個字
		for (let i = 0; i < inserts.length; i += 1000) {
			const batch = inserts.slice(i, i + 1000);
			const values = [];
			const params = [];
			batch.forEach(({ char, pack, families }, index) => {
				const baseIndex = index * 3; //parameterized query count increase 3(char, pack, families) in a for
				values.push(
					`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`,
				);
				params.push(char, pack, families);
			});
			await db.query(
				`INSERT INTO static_fonts (char, pack, families)
                     VALUES ${values.join(",")}
                     `,
				params,
			);
		}
		return true;
	} catch (err) {
		logger.error("更新字型支援清單到資料庫發生錯誤:", err);
		return false;
	}
}
async function regenerateAllStaticFont(state, have_gen_list) {
	// list all have to regenerate fonts family and theirs support weights .
	try {
		const all_fonts = (
			await db.query(
				`SELECT ff.id AS ff_name, w AS support_weights
                FROM font_family ff
                JOIN LATERAL unnest(ff.weights) AS w ON true
                ORDER BY ff.id,support_weights;
            ;`,
			)
		).rows;
		//取得字型版本號，版本號定期更新，所以會自動重切
		let version_num = (
			await db.query(`SELECT bullet from version order BY start DESC limit 1;`)
		).rows; //[0].bullet
		version_num = version_num.length == 0 ? 100 : version_num[0].bullet;
		logger.info(`目前字型版本: ${version_num}`);
		logger.info(`總共有 ${all_fonts.length} 種字型需要檢查是否需要重新生成`);
		// get length of all_fonts
		const all_fonts_length = all_fonts.length;
		let currentIndex = 0;
		for (const { ff_name, support_weights } of all_fonts) {
			currentIndex++;
			logger.debug(
				`正在確認字型 ${ff_name} ${support_weights} 的靜態生成 (${currentIndex}/${all_fonts_length})`,
			);
			const this_font = {
				version: version_num,
				fontName: ff_name, // 字型名稱（資料夾名稱）
				weight: support_weights, // 字型的 weight（檔案名稱中的數字）
			};
			//讀字型檔案，取出所有支援的字型
			const readFile_res = await readFontBuffer(ff_name, support_weights, true);
			if (readFile_res.success == false) {
				logger.warn(`讀取字型檔案失敗！${ff_name} ${support_weights}`);
				continue;
			}
			const fontfile = readFile_res.fontfile;
			const supportedCodePoints = Array.from(fontfile.characterSet);
			const charArray = supportedCodePoints
				.map(cp => String.fromCodePoint(cp))
				.filter(char => char !== "\x00");
			logger.info(
				`╔ ${ff_name} ${support_weights} 有 ${charArray.length} 個字`,
			);
			// 1. 查出資料紀錄不完全的字
			//       |資料庫存在該字|自型支援清單|
			// CASE 1： 0 | 0 | 1 -> 資料庫根本沒有這個字
			// CASE 2： 0 | 1 | X -> don't care 。邏輯上不會有這種情況
			// CASE 3： 1 | 0 | 1 -> 資料庫存在，但支援字型清單不存在該字型
			// CASE 4： 1 | 1 | 0 -> no action
			const { rows: lost_chars } = await db.query(
				`
                SELECT c.char, 
                    CASE 
                        WHEN s.char IS NULL THEN 'not_exist_char'
                        WHEN NOT ($2 = ANY(s.families)) THEN 'missing_family'
                    END AS status
                FROM unnest($1::text[]) AS c(char)
                LEFT JOIN static_fonts s ON s.char = c.char
                WHERE s.char IS NULL OR NOT ($2 = ANY(s.families));`,
				[charArray, ff_name],
			);
			//把此字型支援的所有字元裡頭紀錄的支援字型陣列加入這次的字型（如果還沒加入的話）
			await complete_ff_name_support_char_in_db(ff_name, lost_chars);
			//this_static_font_dir_status 是 ff_name-support_weights 的靜態字型在生成列表中的狀態，
			// 包括字型id 、字重和生成的檔案編號，從 have_gen_list（有所有靜態已生成資料夾的屬性） 拆解出來
			const this_static_font_dir_status = have_gen_list.find(
				item =>
					item.fontName === this_font.fontName &&
					item.weight == this_font.weight &&
					item.version == version_num,
			);
			let existPack = [];
			let ready_regen = []; //put pack number ready to gen
			//查詢這個字型支援字元用到的 pack
			const all_need_gen_pack = (
				await db.query(
					`SELECT pack FROM static_fonts WHERE $1 = ANY(families) GROUP BY pack ORDER BY pack;`,
					[ff_name],
				)
			).rows;
			//all_need_gen_pack=[{ pack: 1 },{ pack: 55 },{ pack: 56 }...]
			const all_pack_numbers = all_need_gen_pack.map(item =>
				item.pack.toString().padStart(3, "0"),
			);
			if (this_static_font_dir_status) {
				existPack = this_static_font_dir_status.files;
				//all_pack_numbers=[00,55,56]
				let regenerate = false;
				//確保該字型資料夾底下的該出現的檔案都在
				all_pack_numbers.forEach(function (pack_num) {
					if (!this_static_font_dir_status.files.includes(pack_num)) {
						ready_regen.push(pack_num);
						regenerate = true;
					}
				});
				if (!regenerate) continue; //全部存在，跳過重新生成
				logger.info(
					`╠ ${ff_name}-${support_weights} 應該共有 ${all_need_gen_pack.length} 包字型。本地只有其中 ${existPack.length} 包字體`,
				);
			} else {
				ready_regen = all_pack_numbers;
			}
			logger.info(
				`╠ 生成 ${ff_name} ${support_weights} 缺少的 ${all_pack_numbers.length - existPack.length} 包靜態字型`,
			);
			//重新生成
			let word_package_pair = (
				await db.query(
					`SELECT pack, STRING_AGG(char, '') AS words FROM static_fonts
                    WHERE char = ANY($1)
                    AND pack = ANY($2::int[])
                    GROUP BY pack ORDER BY pack;`,
					[charArray, ready_regen],
				)
			).rows;
			// {
			//     1:'一堆字',
			//     2:'另一堆字'
			// }

			// 並行生成所有 pack
			const results = [];
			let batchSize = cpuCount;

			// remove the index of existPack in
			word_package_pair = word_package_pair.filter(
				entry => !existPack.includes(entry.pack),
			);
			logger.info(`╠ 正在生成 ${word_package_pair.length} 包字體`);
			for (let i = 0; i < word_package_pair.length; i += batchSize) {
				const batch = word_package_pair.slice(i, i + batchSize);
				const tasks = batch.map(({ pack, words }) => {
					return runWorker({
						ff_name,
						support_weights,
						words,
						pack,
						version_num,
						fontfile,
						r2: state.r2,
					}).catch(error => ({
						success: false,
						errorMsg: error.message || "Unknown error",
						pack,
					}));
				});

				const settled = await Promise.allSettled(tasks);

				for (const res of settled) {
					if (res.status === "fulfilled") {
						if (res.value.success == false) {
							logger.error(
								"生成靜態字型的多執行序發生錯誤！生成中斷！",
								res.value,
							);
							throw new Error(JSON.stringify(res.value));
						}
						results.push(res.value);
					} else {
						results.push({
							success: false,
							errorMsg: res.reason?.message || "Unknown error",
							pack: "??",
						});
					}
				}
			}

			await db.query("COMMIT");
			return true;
		}
	} catch (err) {
		logger.error("生成靜態字體時發生錯誤:", err);
		return false;
	}
	logger.info("✨ 所有靜態字體生成完成！");
}
// /**
//  * 給定文字集合，找會用到的靜態字型 pack number
//  *
//  * @param {string} word_set - 要查詢的文字集合。
//  * @param {string} hash - 用於 Redis 快取的雜湊 key。
//  * @returns {Promise<string[]>} 對應的字型包代碼陣列。
//  */
async function find_static_font(word_set, hash) {
	try {
		word_set = [...word_set];
		const this_key = "s-" + hash; //static font use prefix
		const packs = new Set();
		const hash_record = await redis.smembers(this_key);
		// 若有 Redis miss 的字，就查 PostgreSQL
		if (hash_record.length == 0) {
			const query = `
            SELECT DISTINCT pack,char
            FROM static_fonts 
            WHERE char = ANY($1::text[]);
        `; //不會比對該字型是否支援這個字，優點是不用根據不同的字體就重新去查，資料庫有紀錄的字都會給 pack number ，目標是通用兼容。如果請求到字型沒有的會給出不存在的包，前端會跳 404
			const res = await db.query(query, [word_set]);
			const redisSetPipeline = redis.pipeline();
			for (const row of res.rows) {
				const paddedPack = String(row.pack).padStart(3, "0");
				packs.add(paddedPack);
				// 寫回 Redis 快取
				redisSetPipeline.sadd(this_key, paddedPack);
			}
			//key will expire after 3 Day(60*60*24*3)
			redisSetPipeline.expire(this_key, 259200);
			await redisSetPipeline.exec();
			return Array.from(packs);
		} else {
			const currentTTL = await redis.ttl(this_key);
			// 如果 key 是永久存在（TTL = -1），選擇不動作complete_ff_name_support_char_in_db
			if (currentTTL > 0) {
				const newTTL = currentTTL + 3600; // 重複使用的 key 幫他加 ttl 1 hr
				await redis.expire(this_key, newTTL);
			}
			return hash_record;
		}
	} catch (err) {
		logger.error("查詢靜態字型發生錯誤:", err);
		return [];
	}
}
function give_static_font({ font_family, font_weight, packs, state }) {
	// 回傳字型包路徑
	const version_num = state.static_font_version;
	const prefix = `${version_num}-${font_family}-${font_weight}/`;
	const results = packs.map(pack => {
		const filename = `${pack}.woff2`;
		return `${state.static_font_base}/${prefix}${filename}`;
	});
	// 直接回傳陣列
	return results;
}
export { find_static_font, give_static_font, regenerateAllStaticFont };
