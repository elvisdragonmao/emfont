import fs from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, GetObjectCommand, ListBucketsCommand } from "@aws-sdk/client-s3";
import { promisify } from "util";

export default async () => {
    const bucketName = process.env.MINIO_BUCKET;
    if (!bucketName) {
        console.log("❌ 沒有設定 MINIO_BUCKET 環境變數，無法下載字型");
        return;
    }
    const LOCAL_MINIO_CLIENT = new S3Client({
        region: "auto",
        endpoint: process.env.MINIO_ENDPOINT,
        credentials: {
            accessKeyId: process.env.MINIO_USERNAME,
            secretAccessKey: process.env.MINIO_PASSWORD
        },
        forcePathStyle: true
    });

    try {
        const data = await LOCAL_MINIO_CLIENT.send(new ListBucketsCommand({}));
        console.log(
            "🗃️  MinIO 連接成功，找到的 Bucket:",
            data.Buckets.map(b => b.Name)
        );
    } catch (err) {
        console.error("❌ 無法連接到 MinIO，跳過字型下載", err);
        return;
    }

    const sotrge_original_fontsDir = path.resolve("src/_data/original-fonts");
    const readdir = promisify(fs.readdir);
    const stat = promisify(fs.stat);

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

    // 從 MinIO 抓取檔案，確保下載完成Ｆ
    const prefix = "original-fonts";
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix
        });

        const listResponse = await LOCAL_MINIO_CLIENT.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            console.log(`在 ${bucketName}/original-fonts/ 沒有找到任何字體`);
            return;
        }

        console.log(`🔄 找到 ${listResponse.Contents.length} 個字體文件，開始下載...`);

        await Promise.all(
            listResponse.Contents.map(async file => {
                const fileKey = file.Key;
                if (!fileKey) return;

                const getCommand = new GetObjectCommand({
                    Bucket: bucketName,
                    Key: fileKey
                });

                const data = await LOCAL_MINIO_CLIENT.send(getCommand);

                const localPath = path.join("src", "_data", fileKey);
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
    console.log("✅ 所有字體文件已成功下載");
};
