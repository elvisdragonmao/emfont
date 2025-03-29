import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";
import { db } from "./database.js"; // 匯入 db.js 中的資料庫連線模組
import { S3Client,  ListObjectsV2Command,GetObjectCommand ,ListBucketsCommand} from "@aws-sdk/client-s3";
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

dotenv.config(); // 讀取 .env 變數
const bucketName = process.env.MINIO_BUCKET;
const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.MINIO_ENDPOINT,
    credentials: {
        accessKeyId: process.env.MINIO_USERNAME,
        secretAccessKey: process.env.MINIO_PASSWORD,
    },
    forcePathStyle: true, 
});

async function listBuckets() {
  try {
    const data = await s3Client.send(new ListBucketsCommand({}));
    console.log("Buckets:", data.Buckets.map(b => b.Name));
  } catch (err) {
    console.error("Error listing buckets:", err);
  }
}

async function downloadAllFilesInFonts() {
  const prefix = "fonts"; // Directory name in minio
  try {
    // List all files in the fonts/ directory
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    });

    const listResponse = await s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log("No files found in the fonts/ directory.");
      return;
    }

    console.log(`🔄 Found ${listResponse.Contents.length} 個字體文件，開始下載...`);

    await Promise.all(
      listResponse.Contents.map(async (file) => {
        const fileKey = file.Key;
        if (!fileKey) return; // Skip if no file key

        console.log(`⬇️ 下載中: ${fileKey}`);

        // Get file from S3
        const getCommand = new GetObjectCommand({
          Bucket: bucketName,
          Key: fileKey
        });

        const data = await s3Client.send(getCommand);

        // 建立本地檔案路徑
        const localPath = path.join("src", "static", fileKey);// Create path based on fileKey
        const localDir = path.dirname(localPath);
        fs.mkdirSync(localDir, { recursive: true });

        // **使用 Promise 等待檔案寫入完成**
        await new Promise((resolve, reject) => {
          //Pipe the stream from S3 to the local file
          const fileStream = fs.createWriteStream(localPath);
          data.Body.pipe(fileStream);

          fileStream.on("finish", () => {
            console.log(`✅ 文件已下載: ${fileKey}`);
            resolve();
          });

          fileStream.on("error", (err) => {
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

const fontsDir = path.resolve("src/static/fonts");
//init check

// 讀取並執行 SQL 腳本檔案
async function executeSQLFile(filePath) {
    const sql = await fs.promises.readFile(filePath, 'utf-8');
    try {
      await db.query(sql);
      console.log(`Executed SQL script from ${filePath}`);
    } catch (err) {
      console.error(`Error executing SQL script from ${filePath}:`, err);
    }
  }

//check database
async function insertFontTypes() {
    try {
      // 取得 `fontsDir` 下的所有子項目
      const items = await readdir(fontsDir);
      
      // 篩選出僅包含資料夾的名稱
      const fontNames = [];
      for (const item of items) {
        const itemPath = path.join(fontsDir, item);
        const stats = await stat(itemPath);
        if (stats.isDirectory()) {
          fontNames.push(item);
        }
      }
  
      if (fontNames.length === 0) {
        console.log("No font directories found.");
        return;
      }
      
      // 插入字型名稱（避免重複）
      try {
        for (const fontName of fontNames) {
          await db.query(
            `INSERT INTO font_types (font_name) VALUES ($1)
             ON CONFLICT (font_name) DO NOTHING;`,
            [fontName]
          );
        }
        console.log("Font types inserted successfully.");
      } finally {
      }
    } catch (error) {
      console.error("Error inserting font types:", error);
    }
  }
  //從本地mino空間抓檔案
  async function fech_mino() {
    //刪除本地src/static/fonts/裡面的所有東西
    const all_files_in_folder = await readdir(fontsDir);
  
    // 刪除所有檔案
    for (const item of all_files_in_folder) {
      const itemPath = path.join(fontsDir, item);
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
async function initCheck()
{
    try
    {
      if (process.env.local_test != "true")
      {
          console.log("initCheck: local_test is false");
          await listBuckets();
          await fech_mino();
      }
        const schemaFilePath = path.resolve("src/static/sql/schema.sql");
        await executeSQLFile(schemaFilePath);
        await insertFontTypes();
        //判斷是不是在 zeabur 是才找 minio
        console.log("init success");
        return true;
    }
    catch(err)
    {
        console.error("Error init break:", err);
        return false;
    }
}
export{initCheck}