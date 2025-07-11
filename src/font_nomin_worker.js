import { parentPort, workerData } from "worker_threads";
import { generateFont } from "./font_min.js";

(async () => {
	try {
		const { ff_name, support_weights, words, pack, version_num, r2 } =
			workerData;

		async function gen_static_font({
			ff_name,
			support_weights,
			words,
			pack,
			version,
			r2 = false,
		}) {
			try {
				process.stdout.write("\r╚  正在生成第 " + pack + " 包");
				//todo:靜態請求沒有找到檔案也要去重新生成，那邊的請求檔名也要加　version 作為前綴
				pack = pack.toString().padStart(3, "0");
				let generated = await generateFont(
					ff_name,
					support_weights,
					words,
					`${pack}.woff2`,
					`_data/_generated/${version}-${ff_name}-${support_weights}`
				);
				if (generated.status === "failed") return generated;
				//todo:使用超過　3　次才上傳。靜態請求有時候會要傳本地路徑，還要改give_static_font
				// if (!r2) return true;
				// const generated_font_path = path.join(path.dirname(fileURLToPath(import.meta.url)), "_data", "_generated", `${version}-${ff_name}-${support_weights}`, `${pack}.woff2`);
				// await uploadToR2(generated_font_path, `${ff_name}-${support_weights}/${pack}.woff2`);
				return { status: "success" };
			} catch (err) {
				return new Error(err);
			}
		}

		const result = await gen_static_font({
			ff_name: ff_name,
			support_weights: support_weights,
			words: words,
			pack: pack,
			version: version_num,
			r2: r2,
		});

		parentPort.postMessage({
			success: result.status === "success",
			res: result,
			pack: pack,
		});
	} catch (error) {
		parentPort.postMessage({
			success: false,
			errorMsg: error.message || "Unknown error",
			pack: workerData.pack,
		});
	}
})();
