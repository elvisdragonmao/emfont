import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
// credit: https://robvanderg.github.io/scripts/scripts/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * @class ScriptFinder
 * Loads and caches Unicode script definitions.
 * Downloads and parses Scripts.txt, then caches as JSON for fast lookup.
 */
export class ScriptFinder {
	/**
	 * Class that loads Unicode script definitions.
	 * It automatically downloads the Unicode Scripts.txt file (if missing),
	 * parses it, and saves a JSON cache.
	 *
	 * The data structure maps ranges of valid Unicode code points to their
	 * corresponding script names (e.g., Latin, Han, Cyrillic).
	 *
	 */
	constructor() {
		this.ranges = [];
		this.starts = [];

		const staticDir = path.join(__dirname, "static");
		const cachePath = path.join(staticDir, "Scripts.json");
		const textPath = path.join(staticDir, "Scripts.txt");

		if (!fs.existsSync(staticDir)) {
			fs.mkdirSync(staticDir, { recursive: true });
		}

		if (fs.existsSync(cachePath)) {
			const { ranges, starts } = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
			this.ranges = ranges;
			this.starts = starts;
		} else {
			if (!fs.existsSync(textPath)) {
				const url = "https://www.unicode.org/Public/16.0.0/ucd/Scripts.txt";
				const file = fs.createWriteStream(textPath);
				const downloadDone = new Promise((resolve, reject) => {
					https
						.get(url, res => {
							if (res.statusCode !== 200) return reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
							res.pipe(file);
							file.on("finish", () => file.close(resolve));
						})
						.on("error", reject);
				});

				this._loadAfterDownload = downloadDone.then(() => this._loadFromText(textPath, cachePath));
			} else {
				this._loadAfterDownload = this._loadFromText(textPath, cachePath);
			}
		}
	}

	async _loadFromText(textPath, cachePath) {
		const lines = fs.readFileSync(textPath, "utf-8").split("\n");

		for (const line of lines) {
			// 對 scripts.txt 做一點字串處理，拿出 code block 的定義
			if (line.startsWith("#") || !line.includes(";")) continue;

			const [rangeStr, scriptNameRaw] = line.split(";");
			const scriptName = scriptNameRaw.trim().split(/\s+/)[0];
			const rangeParts = rangeStr.trim().split("..");

			const start = parseInt(rangeParts[0], 16);
			const end = rangeParts.length === 2 ? parseInt(rangeParts[1], 16) : start;

			this.ranges.push([start, end, scriptName]);
		}
		//排序節點
		this.ranges.sort((a, b) => a[0] - b[0]);
		this.starts = this.ranges.map(([start]) => start);

		fs.writeFileSync(cachePath, JSON.stringify({ ranges: this.ranges, starts: this.starts }, null, 2));
	}

	async _ensureLoaded() {
		if (this._loadAfterDownload) {
			await this._loadAfterDownload;
			this._loadAfterDownload = null;
		}
	}

	async findChar(codepoint) {
		await this._ensureLoaded();
		let left = 0;
		let right = this.starts.length;
		// 二分搜
		while (left < right) {
			const mid = Math.floor((left + right) / 2);
			if (codepoint < this.starts[mid]) {
				right = mid;
			} else {
				left = mid + 1;
			}
		}

		const idx = left - 1;
		if (idx >= 0) {
			const [start, end, script] = this.ranges[idx];
			if (codepoint >= start && codepoint <= end) {
				return script;
			}
		}
		return null;
	}

	/**
	 * @param {string} text
	 * @returns {Promise<Record<string, number> | null>}
	 */
	async charClassify(text) {
		/*
        Parameters
        ----------
        text: str
            The input text
        Returns
        -------
        script: Record<string, number> | null
            出現的文字所屬分類和字數量

    */
		await this._ensureLoaded();
		const classes = {};

		for (const char of text) {
			const code = char.codePointAt(0);
			const script = await this.findChar(code);
			if (!script) continue;

			classes[script] = (classes[script] || 0) + 1;
		}

		return Object.keys(classes).length === 0 ? null : classes;
	}
}
