import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";


dotenv.config(); // 讀取 .env 變數

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function uploadToR2(localFilePath, remoteFileName) {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const uploadParams = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: `fonts/${remoteFileName}`,
            Body: fileContent,
            ContentType: "font/woff",
            ACL: "public-read",
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const r2Url = `${process.env.R2_pub_url_base}/fonts/${remoteFileName}`;
        console.log("✅ 檔案已上傳至 R2:", r2Url);
        return r2Url;
    } catch (err) {
        console.error("❌ 上傳到 R2 失敗:", err);
        throw err;
    }
}
export { uploadToR2 };