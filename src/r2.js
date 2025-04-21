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
    // 沒用我先註解掉，記得應該要移到 init.js initR2 之後，不是在這裡呼叫。
   // listFontsTopLevel();
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
async function listFontsRecursive(state ,prefix = "fonts/",allFontRecords=[]) {
  try {
    if (state.r2 == false) return [];//r2 沒連上就不用試著去要 r2 的檔案狀態了
    let isTruncated = true;
    let continuationToken;

    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      // 遞迴子資料夾
      if (response.CommonPrefixes) {
        for (const prefixObj of response.CommonPrefixes) {
          await listFontsRecursive(prefixObj.Prefix,allFontRecords);
        }
      }

      // 收集這層的檔案
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key !== prefix) {
            const key = obj.Key; // 例："fonts/abc/hello.ttf"
            const fileName = key.split("/").pop(); // 取得檔名 "hello.ttf"
            allFontRecords.push({
                prefix:prefix,//檔案夾路徑
                fileName:fileName,
              lastModified: obj.LastModified
            });
          }
        }
      }

      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
      return allFontRecords;
    }
  } catch (err) {
    console.error("列出檔案時發生錯誤：", err);
  }
}
export { uploadToR2, checkR2FileExists, initR2 ,listFontsRecursive};
