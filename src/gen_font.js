import { check } from "drizzle-orm/gel-core";

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
function checkFormat(words) {
    if (!words) {
        throw new Error("Words are required");  // 使用 throw 讓 genFont 捕捉
    }
    //查詢請求的字分別散落在哪些字型包中

    // 回傳要用到的字型包編號，東西還沒寫，先填 null 應急用
    return NULL; // 如果沒問題，就回傳原始值
}
export const genFont = (req,res) => {
    //檢查字集格式
    try{
        checkFormat(req.body.words);
    }catch(err){
        return res.status(400).send(error.message);
    }
    //font ID 是使用者請求的字型名稱，例如ZhuQueFangSong（朱雀仿宋）等等
    var fontID = req.params.font;
    //
}