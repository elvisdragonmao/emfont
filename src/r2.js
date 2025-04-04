import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
// gen public url
const genPublicUrl = (remoteFileName) => {//file name example: XXX.woff2 => is a file name  + Filename Extension 
    return `${process.env.R2_pub_url_base}/fonts/${remoteFileName}`;
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
        console.log("✅ 檔案已上傳至 R2:", r2Url);
        return r2Url;
    } catch (err) {
        console.error("❌ 上傳到 R2 失敗:", err);
        throw err;
    }
}

// 檢查檔案是否存在
const checkFileExists = async (file_name) => {
    try {
        const response = await fetch(genPublicUrl(file_name), {
            method: "HEAD"
        }); // 使用 HEAD 方法減少流量
        if (response.ok) {
            console.log("✅ 檔案存在:", genPublicUrl(file_name));
            return genPublicUrl(file_name);
        } else {
            console.log(file_name,"檔案不存在");
            return false;
        }
    } catch (error) {
        console.error("❌ 無法連線到 R2:", error);
        return false;
    }
};
export { uploadToR2, checkFileExists };
