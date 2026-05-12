import dotenv from "dotenv";
import pg from "pg";
import { logger } from "./logger.js";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10, // pool size
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 2000
});

async function initDb() {
	try {
		await pool.query("SELECT 1");
		logger.info("✅ PostgreSQL pool 連接成功");
		return true;
	} catch (err) {
		logger.error("❌ PostgreSQL pool 連接失敗:", err);
		return false;
	}
}

export { pool as db, initDb };
