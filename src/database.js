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

async function initDb() {
    try {
        await db.connect();
        console.log("✅ PostgreSQL 連接成功");
        return true;
    } catch (err) {
        console.error("❌ PostgreSQL 連接失敗:", err);
        return false;
    }
}

export { db, initDb };
