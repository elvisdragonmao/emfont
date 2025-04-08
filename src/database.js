// import { drizzle } from "drizzle-orm/node-postgres";
// import pkg from "pg";
// const { Pool, Client } = pkg;
// import * as schema from "./schema.js";
// import "dotenv/config";

// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
// });

// export const db = drizzle(pool, { schema });

// // Create tables if they don't exist
// db.js
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

const db = new Client({
    connectionString: process.env.DATABASE_URL
});

let dbConnected = false;

async function initDb() {
    try {
        await db.connect();
        console.log("✅ PostgreSQL 連接成功");
        dbConnected = true;
    } catch (err) {
        console.error("❌ PostgreSQL 連接失敗:", err);
        // 不 throw，讓主程式決定怎麼處理
    }
}

export { db, dbConnected, initDb };
