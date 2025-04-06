import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";
import { db, initDb, dbConnected } from "./database.js"; // 匯入 db.js 中的資料庫連線模組
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import {regenerate_all_static_font} from "./font_nomin.js"
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

dotenv.config(); // 讀取 .env 變數
const sotrge_original_fontsDir = path.resolve("src/_data/fonts"); //原始字型檔存放路徑
const bucketName = process.env.MINIO_BUCKET;
const LOCAL_MINIO_CLIENT = new S3Client({
    region: "auto",
    endpoint: process.env.MINIO_ENDPOINT,
    credentials: {
        accessKeyId: process.env.MINIO_USERNAME,
        secretAccessKey: process.env.MINIO_PASSWORD
    },
    forcePathStyle: true
});

async function listBuckets() {
    try {
        const data = await LOCAL_MINIO_CLIENT.send(new ListBucketsCommand({}));
        console.log(
            "Buckets:",
            data.Buckets.map(b => b.Name)
        );
    } catch (err) {
        console.error("Error listing buckets:", err);
    }
}

async function downloadAllFilesInFonts() {
    const prefix = "original-fonts"; // Directory name in minio
    try {
        // List all files in the original-fonts directory
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix
        });

        const listResponse = await LOCAL_MINIO_CLIENT.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`No files found in the ${bucketName}/original-fonts/ directory.`);
            return;
        }

        console.log(`🔄 Found ${listResponse.Contents.length} 個字體文件，開始下載...`);

        await Promise.all(
            listResponse.Contents.map(async file => {
                const fileKey = file.Key;
                if (!fileKey) return; // Skip if no file key

                // Get file from S3
                const getCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: fileKey
                });

                const data = await LOCAL_MINIO_CLIENT.send(getCommand);

                // 建立本地檔案路徑
                const localPath = path.join("src", "_data", fileKey); // Create path based on fileKey
                const localDir = path.dirname(localPath);
                fs.mkdirSync(localDir, { recursive: true });

                // **使用 Promise 等待檔案寫入完成**
                await new Promise((resolve, reject) => {
                    //Pipe the stream from S3 to the local file
                    const fileStream = fs.createWriteStream(localPath);
                    data.Body.pipe(fileStream);

                    fileStream.on("finish", () => {
                        resolve();
                    });

                    fileStream.on("error", err => {
                        console.error(`❌ 下載檔案失敗: ${fileKey}`, err);
                        reject(err);
                    });
                });
            })
        );

        console.log("✅ 所有字體下載完成");
    } catch (err) {
        console.error("❌ 下載檔案失敗:", err);
    }
}

//init check

// 讀取並執行 SQL 腳本檔案
async function executeSQLFile(filePath) {
    const sql = await fs.promises.readFile(filePath, "utf-8");
    try {
        console.log(`Executing SQL script from ${filePath}`);
        await db.query(sql);
        console.log(`Executed SQL script from ${filePath}`);
    } catch (err) {
        console.error(`Error executing SQL script from ${filePath}:`, err);
        throw new Error(`Error executing SQL script from ${filePath}`);
    }
}

//check database
async function insertFontTypes() {
    try {
        // 取得 `sotrge_original_fontsDir` 下的所有子項目
        const ALL_FONTS_dir = await readdir(sotrge_original_fontsDir);
        const fontData = [];

        for (const one_font_family of ALL_FONTS_dir) {
            const itemPath = path.join(sotrge_original_fontsDir, one_font_family);
            console.log("itemPath:", itemPath);
            const stats = await stat(itemPath);

            if (stats.isDirectory()) {
                // 讀取該資料夾內的所有檔案
                const fontFiles = await readdir(itemPath);
                for (const fontFile of fontFiles) {
                    // 匹配檔名中的數字作為 weight（假設檔名包含數字，200.ttf）
                    if (!fontFile.endsWith(".ttf") && !fontFile.endsWith(".otf")) {
                        console.log("Skipping:", fontFile); // 確保 README.md 這類檔案不會進來
                        continue;
                    }
                    const match = fontFile.match(/.*?(\d+)\.(ttf|otf)$/);
                    if (match) {
                        const weight = match[1]; // 取得數字部分作為 weight
                        console.log("weight:", weight);
                        // 將資料夾名（font_name）和提取的 weight 存入 fontData
                        fontData.push({
                            fontName: one_font_family, // 字型名稱（資料夾名稱）
                            weight: weight // 字型的 weight（檔案名稱中的數字）
                        });
                    }
                }
            }
        }
        console.log(`find ${fontData.length} font file\n=================`);
        if (fontData.length === 0) {
            console.log("No font directories found.");
            //中止程式
            throw new Error("No font directories found.");
        }

        // sync all font file in _fata/fonts let records are same with SQL 
        try {
            //clear avaible font-weight. it will regenerate in for loop below 
            await db.query("UPDATE font_family SET weights = ARRAY[]::smallint[]");
            for (const { fontName, weight } of fontData) {
                // console.log(fontName, typeof fontName, weight, typeof parseInt(weight));
                const qresult_font_family = await db.query(
                    // if someone `font-family` row has exist but not this weight, then add this weight to the array
                    `
                        SELECT id,repo_url from font_family WHERE id= $1;
                        `,
                    [fontName]
                );//表格內目前的字型名稱大小寫和檔案的大小寫不一樣
                const verify_font_file= qresult_font_family.rows[0] //can use .id ,.repo_url get vaild value
                // console.log(typeof(verify_font_file),verify_font_file)
                if (!verify_font_file) {
                    throw new TypeError(`${fontName}-${weight} doesn't in SQL record.
                                        Pls remove it in workspace folder or add its 
                                        information in database`);
                }
                //if database does't exist this weight record , append it in arrary
                await db.query(`UPDATE font_family SET weights =
                                        array_append(COALESCE(weights, '{}'), $1)
                                        WHERE id = $2 AND NOT ($1 = ANY(weights));`
                                ,[weight,fontName])
            }
            console.log("Font types inserted successfully.");
        } catch (error) {
            console.error(`Error when check font file`, error);
            throw error;
        }
    } catch (error) {
        console.error(`Error when check font file`, error);
        throw error;
    }
}
//從本地mino空間抓檔案
async function fech_mino() {
    //刪除本地src/_data/fonts/裡面的所有東西
    const all_files_in_folder = await readdir(sotrge_original_fontsDir);

    // 刪除所有檔案
    for (const one_font_family of all_files_in_folder) {
        const itemPath = path.join(sotrge_original_fontsDir, one_font_family);
        const stats = await stat(itemPath);
        if (stats.isDirectory()) {
            await fs.promises.rm(itemPath, { recursive: true, force: true });
        } else {
            await fs.promises.unlink(itemPath);
        }
    }

    console.log("✅ 本地字體檔案已清除");

    // 從 MinIO 抓取檔案，確保下載完成
    await downloadAllFilesInFonts();
    console.log("✅ 所有字體文件已成功下載");
}

async function initCheck() {
    try {
        await initDb();
        if (!dbConnected) {
            console.error("Database connection failed. Exiting...");
            return false;
        }
        //判斷是不是在 zeabur ，是才找 minio
        if (process.env.LOCAL_TEST !== 'true') {
            console.log("initCheck: local_test is false");
            await listBuckets();
            await fech_mino();
            await regenerate_all_static_font();
        }
        const schemaFilePath = path.resolve("src/_data/sql/schema.sql");
        const word_feq_FilePath = path.resolve("src/_data/sql/words.sql");
        await executeSQLFile(schemaFilePath);
        await executeSQLFile(word_feq_FilePath);
        await insertFontTypes();
        console.log("init success");
        return true;
    } catch (err) {
        console.error("Error init break:", err);
        return false;
    }
}
export { initCheck };
