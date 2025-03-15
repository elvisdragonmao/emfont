import { check } from "drizzle-orm/gel-core";
import { db } from "./database.js";
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
// hashString 呼叫範例。必須使用 async function 。重要！！
//   (async () => {
//     const str = '你好';
//     console.log(await hashString(str)); // 印出 "你好" 的 SHA-256 雜湊值
//   })();
  
///g/:font 路由 呼叫的函式。會根據前端需要的字集，回傳字型檔
//靜態字型檔 solution
async function checkFormat(WORD_SET,FONT_NAME) {
    if (!WORD_SET) {
        throw new Error("words_set are required");  // 使用 throw 讓 genFont 捕捉
    }

    const result = await db.query('SELECT id FROM font_types WHERE font_name = $1', [FONT_NAME]);
    if (result.rowCount === 0) {
        throw new Error("Font not found");
    }

    const font_id = result.rows[0].id; // Extracting the id value
    console.log(FONT_NAME,"id is",font_id);
    return font_id; // 如果沒問題，就回傳字型編號
}
function find_static_font(font_tag){
    // 回傳要用到的字型包編號，東西還沒寫，先填 null 應急用
    //查詢請求的字分別散落在哪些字型包中
    //查詢請求的字型包是否存在
    // 回傳要用到的字型包編號，東西還沒寫，先填 null 應急用
    return NULL; // 如果沒問題，就回傳原始值
}
export const genFont = async(req,res) => {
    //檢查字集格式
    try{
        //req.body.word 是使用者請求的字集
        const req_word = req.body.words;
        //font tag 是使用者請求的字型名稱，例如ZhuQueFangSong（朱雀仿宋）等等
        const font_tag = req.params.font;
        console.log("執行到這了",req_word,font_tag);
        await checkFormat(req_word,font_tag);
    }catch(err){
        console.log("gentFont() error in gen_font.js:",err.stack);
        return res.status(400).send(error.message);
    }
    //測試一下

}