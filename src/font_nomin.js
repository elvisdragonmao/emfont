//切割靜態字型檔（非極致壓縮）
//依照字頻表分裝檔案( 開機時重切)
import { db } from "./database.js";
import { generateFont } from "./font_min.js";
import { uploadToR2 } from "./r2.js";
import { fileURLToPath } from "url";
import path from "path";
async function handle() {
    const word_package_pair = (
        await db.query(
            "SELECT pack, STRING_AGG(word, '') AS words FROM static_fonts GROUP BY pack ORDER BY pack;"
        )
    ).rows;
    // list all fonts family and theirs support weights
    const all_font_family = (
        await db.query(
            "SELECT name as ff_name, weights as support_weights FROM font_family"
        )
    ).rows;
    // console.log("max_package_number:", max_package_number);
    // console.log("word_package_pair:", word_package_pair);
    const max_package_number = word_package_pair.length;
    // const max_font_family_id = all_font_family.length;
    // console.log("max_package_number:", word_package_pair);
    for (const { ff_name, support_weights } of all_font_family) {
        for (const weight_number of support_weights) {
            for (let i = 0; i < max_package_number; i++) {
                const words = word_package_pair[i].words;
                const pack = word_package_pair[i].pack;
                await generateFont(ff_name,weight_number,words,`${pack}.woff2`,
                            `_data/_generated/${ff_name}-${weight_number}`)
                const generated_font_path = path.join(
                                path.dirname(fileURLToPath(import.meta.url)),
                                "_data",
                                "_generated",
                                `${ff_name}-${weight_number}`,
                                `${pack}.woff2`
                            );
                await uploadToR2(generated_font_path,`${ff_name}-${weight_number}/`);
                
            }
            
        }
        //when generate entir family-fontWeight folder 
        console.log("generate statice font package for ",ff_name)
    }
    console.log("done!")
}
await handle();
