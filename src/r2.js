import { S3Client, PutObjectCommand ,ListObjectsV2Command} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config(); // 讀取 .env 變數

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

// 初始化 R2
const initR2 = async state => {
    listFontsTopLevel();
    try {
        if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
            console.log("🏠 R2 沒有設定，會在本地提供字體");
            return;
        }
        // 檢查 R2 連線
        const params = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: "test.txt",
            Body: "test"
        };
        await s3Client.send(new PutObjectCommand(params));
        console.log("✅ R2 測試成功");
        state.r2 = true;
    } catch (error) {
        console.log("❌ R2 測試失敗:", error);
    }
};

// gen public url
const genPublicUrl = remoteFileName => {
    //file name example: XXX.woff2 => is a file name  + Filename Extension
    return `${process.env.R2_PUB_URL_BASE}/fonts/${remoteFileName}`;
};

async function uploadToR2(localFilePath, remoteFileName) {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const uploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `fonts/${remoteFileName}`,
            Body: fileContent,
            ContentType: "font/woff",
            ACL: "public-read"
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const r2Url = genPublicUrl(remoteFileName);
        console.log("☁️ 檔案已上傳至 R2:", r2Url);
        return r2Url;
    } catch (err) {
        console.error("❌ 上傳到 R2 失敗:", err);
        throw err;
    }
}

// 檢查檔案是否存在
const checkR2FileExists = async file_name => {
    try {
        const response = await fetch(genPublicUrl(file_name), {
            method: "HEAD"
        }); // 使用 HEAD 方法減少流量
        if (response.ok) {
            return genPublicUrl(file_name);
        } else {
            console.log(file_name, "檔案不存在");
            return false;
        }
    } catch (error) {
        console.error("❌ 無法連線到 R2:", error);
        return false;
    }
};
async function listFontsTopLevel() {
    try {
      let isTruncated = true;
      let continuationToken;
  
      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: "emfont",//要改成環境變數
          Prefix: "fonts/",
          Delimiter: "/", 
          ContinuationToken: continuationToken,
        });
  
        const response = await s3Client.send(command);
  
        // 列出第一層的子資料夾（CommonPrefixes）
        if (response.CommonPrefixes) {
          response.CommonPrefixes.forEach(prefixObj => {
            console.log(`資料夾：${prefixObj.Prefix}`);
          });
        }
  
        // 列出直接在 fonts/ 下的檔案（不在子資料夾內的）
        if (response.Contents) {
          response.Contents.forEach(obj => {
            console.log(`檔案：${obj.Key}`);
          });
        }
  
        isTruncated = response.IsTruncated;
        continuationToken = response.NextContinuationToken;
      }
    } catch (err) {
      console.error("列出檔案時發生錯誤：", err);
    }
  }
  
export { uploadToR2, checkR2FileExists, initR2 };
