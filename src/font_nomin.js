//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案( 開機時重切)
import { db } from "./database.js";
import { generateFont } from "./font_min.js";
async function handle(){
    const word_package_pair = (await db.query("SELECT pack, STRING_AGG(word, '') AS words FROM static_fonts GROUP BY pack ORDER BY pack;")).rows;
    const all_font_family = (await db.query("SELECT font_name FROM font_family")).rows;
    // console.log("max_package_number:", max_package_number);
    // console.log("word_package_pair:", word_package_pair);
    const max_package_number = word_package_pair.length;
    const max_font_family_id = all_font_family.length;
    console.log("max_package_number:", word_package_pair);
    for (let i = 0; i < max_package_number; i++) {
        const words = word_package_pair[i].words;
        const pack = word_package_pair[i].pack;
        for (let j = 0; j < max_font_family_id; j++) {
            const this_font_family = all_font_family[j].font_name;
            generateFont(this_font_family)
        }
        // await genFont(words, pack);
    }
}
handle();