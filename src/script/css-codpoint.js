import { db } from "../utils/database.js";
async function make_css_code_point(font_id, weight) {
	const { rows } = await db.query(
		`select pack,string_agg("char" , '') AS chars  from static_fonts where $1 = any (families) group by pack`,
		[font_id]
	);
	// from char to unicode-range
	const packs = rows.map((row) => {
		const codePoints = Array.from(row.chars).map((ch) => ch.codePointAt(0));
		codePoints.sort((a, b) => a - b);

		const ranges = [];
		let start = codePoints[0];
		let prev = codePoints[0];
		for (let i = 1; i < codePoints.length; i++) {
			const cp = codePoints[i];
			if (cp === prev + 1) {
				prev = cp;
			} else {
				//連續區段結束，換段
				ranges.push([start, prev]);
				start = cp;
				prev = cp;
			}
		}
		//手動加最後一段
		ranges.push([start, prev]);
		// 格式化成 CSS 的 unicode-range
		const unicodeRanges = ranges.map(([a, b]) =>
			a === b
				? `U+${a.toString(16)}`
				: `U+${a.toString(16)}-${b.toString(16)}`
		);

		return {
			pack: row.pack,
			unicodeRanges: unicodeRanges.join(", "),
		};
	});
	// 產生 CSS
	const cssBlocks = packs.map(
		(p) => `@font-face {
        font-family: '${font_id}';
        font-style: normal;
        font-weight: ${weight};
        font-display: swap;
        src: url(/fonts/${font_id}-${p.pack}.woff2) format('woff2');
        unicode-range: ${p.unicodeRanges};
    }`
	);
	return {
		code: 200,
		font_id,
        cssBlocks
	};
}
export { make_css_code_point };
