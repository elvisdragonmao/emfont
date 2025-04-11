import { find_dynamic_font } from "./font_min.js"; // 極致壓縮字型
import { find_static_font, give_static_font } from "./font_nomin.js"; // 靜態字型
import { db } from "./database.js";

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fullHash = hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("");
    return fullHash;
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
    const result = await db.query("SELECT id FROM font_family WHERE id = $1", [FONT_NAME]);
    if (result.rowCount === 0) {
        return false;
    }
    const font_id = result.rows[0].id; // Extracting the id value
    console.log(FONT_NAME, "的 ID 是", font_id);
    return font_id; // 如果沒問題，就回傳字型編號
}

export const genFont = async (req, res, state) => {
    //檢查字集格式
    try {
        if (!req.body || !req.body.words) {
            return res.status(400).json({ status: "failed", message: "Missing words parameter" });
        }
        //req.body.word 是使用者請求的字集
        const req_word_set = req.body.words;
        //req.body.min 是否使用專用壓縮字型
        const min_flag = req.body.min;
        //請求字重
        const font_weight = req.body.weight || 400;
        //req_word_set,min_flag,font_weight 有可能是 undefined
        const req_source = req.headers.referer || req.headers.origin || "unknown"; //請求網域

        //font tag 是使用者請求的字型名稱，例如ZhuQueFangSong（朱雀仿宋）等等
        const font_family_name = req.params.font;
        const font_id = await checkFormat(req_word_set, font_family_name);
        if (!font_id) {
            return res.code(404).send({
                status: "failed",
                message: `${font_family_name} doesn't exist`
            });
        }

        if (min_flag) {
            console.log(`正在生成動態字體`);
            const summery = {
                wordSet: req_word_set,
                fontWeight: font_weight,
                fontFamily: font_family_name
            };
            const hash = await hashString(summery);
            const file_path = await find_dynamic_font(hash, font_id, font_family_name, font_weight, req_word_set, req_source, state);
            console.log(file_path);
            if (file_path.status === "failed") res.code(400).send(file_path);
            return res.send({
                status: "success",
                message: "",
                location: [file_path.location],
                name: font_family_name
            });
        } else {
            //請求靜態字型
            //TODO:確認字型包是否存在r2，若無，怎麼辦
            const font_pack_you_need = await find_static_font(req_word_set);
            const R2font_url = await give_static_font(font_family_name, font_weight, font_pack_you_need, state);
            return res.send({
                status: "success",
                message: "",
                location: R2font_url,
                name: font_family_name
            });
        }

        // return res.status(200).send("Font generated");
    } catch (err) {
        console.log("gentFont() 500 error in gen_font.js:", err.stack);

        return res.status(500).send({
            status: "failed",
            message: `error generating font: ${err.message}`
        });
    }
};
