import { find_dynamic_font} from "./font_min.js"; // 極致壓縮字型
import { db } from "./database.js";



async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    // 截取前 10 個字元作為縮短的哈希值
    return fullHash.substring(0, 10);
}

// hashString 呼叫範例。必須使用 async function 。重要！！
//   (async () => {
//     const str = '你好';
//     console.log(await hashString(str)); // 印出 "你好" 的 SHA-256 雜湊值
//   })();

///g/:font 路由 呼叫的函式。會根據前端需要的字集，回傳字型檔
//靜態字型檔 solution
async function checkFormat(WORD_SET, FONT_NAME) {
    //return request {FONT_NAME}'s id in database(if exist)
    if (!WORD_SET) {
        throw new Error("words_set are required"); // 使用 throw 讓 genFont 捕捉
    }
    const result = await db.query(
        "SELECT id FROM font_familys WHERE font_name = $1",
        [FONT_NAME]
    );
    if (result.rowCount === 0) {
        return false;
    }
    const font_id = result.rows[0].id; // Extracting the id value
    console.log(FONT_NAME, "id is", font_id);
    return font_id; // 如果沒問題，就回傳字型編號
}
async function find_static_font(word_set, font_family_name) {
    // 回傳要用到的字型包編號
    // 字串轉成字元陣列給 SQL 查詢
    word_set = word_set.split("");
    //查詢請求的字分別散落在哪些字型包中
    const query =
        "SELECT DISTINCT pack FROM static_fonts WHERE word = ANY($1::text[])";
    const result = await db.query(query, [word_set]);
    const use_packs = result.rows.map((row) => row.pack);
    console.log(word_set, "散落在", use_packs);
    //查詢請求的字型包是否存在
    return 1; // 如果沒問題，就回傳原始值
}

export const genFont = async (req, res) => {
    //檢查字集格式
    try {
        if (!req.body || !req.body.words) {
            return res
                .status(400)
                .json({ status: "failed", message: "Missing words parameter" });
        }
        //req.body.word 是使用者請求的字集
        const req_word_set = req.body.words;
        //req.body.min 是否使用專用壓縮字型
        const min_flag = req.body.min == "true" ? true : false;
        //請求字重
        const font_weight = req.body.weight || 400;
        //req_word_set,min_flag,font_weight 有可能是 undefined
        const req_source =
            req.headers.referer || req.headers.origin || "unknown"; //請求網域

        //font tag 是使用者請求的字型名稱，例如ZhuQueFangSong（朱雀仿宋）等等
        const font_family_name = req.params.font;
        const font_id = await checkFormat(req_word_set, font_family_name);
        if (!font_id) {
            return res.status(400).json({
                status: "failed",
                message: `Invalid font format for ${font_family_name}`
            });
        }

        //待處理：傳入字集都不是中文的情況

        // two condictions: 1.字型包是靜態的 2.字型包是動態的
        if (min_flag || "Each is handsome") {
            //請求動態字型
            console.log("min_flag is FLASE. generate dynamic font");
            const hash = await hashString(req_word_set);
            console.log("hash is", hash);
            const file_path = await find_dynamic_font(
                hash,
                font_id,
                font_family_name,
                font_weight,
                req_word_set,
                req_source
            );
            // 確保 file_path 存在並且有效
            if (!file_path) {
                if (!font_id) {
                    return res
                        .code(400)
                        .send({ status: "failed", message: `Invalid font format for ${font_family_name}` });
                }
            }

            // 讓瀏覽器下載該檔案
            console.log("📥 傳送檔案:", file_path);
            return res.send({
                status: "success",
                message: "",
                location: [file_path],
                name: font_family_name
            });
        } else {
            //請求靜態字型
            console.log("min_flag is true");
            await find_static_font(req_word_set, font_family_name);
        }

        // return res.status(200).send("Font generated");
    } catch (err) {
        console.log("gentFont() error in gen_font.js:", err.stack);

        return res.status(400).send({
            status: "failed",
            message: `error generating font: ${err.message}`
        });
    }
};
