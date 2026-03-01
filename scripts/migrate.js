import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import Postgrator from "postgrator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	const migrationDir = path.join(__dirname, "../migrates");
	if (!fs.existsSync(migrationDir)) {
		throw new Error(`Migration directory "${migrationDir}" does not exist.`);
	}

	const client = new Client(
		process.env.DATABASE_URL
			? { connectionString: process.env.DATABASE_URL }
			: {
					host: process.env.POSTGRES_HOST,
					port: process.env.POSTGRES_PORT
						? Number(process.env.POSTGRES_PORT)
						: undefined,
					database: process.env.POSTGRES_DB,
					user: process.env.POSTGRES_USER,
					password: process.env.POSTGRES_PASSWORD,
				},
	);

	await client.connect();

	try {
		const postgrator = new Postgrator({
			migrationPattern: path.join(migrationDir, "*"),
			driver: "pg",
			//  建立 schemaversion 表格紀錄版本
			schemaTable: "schemaversion",
			execQuery: async query => {
				const res = await client.query(query);
				return { rows: res.rows };
			},
		});

		const applied = await postgrator.migrate();
		console.log(
			"Migrations applied:",
			applied.map(m => m.filename),
		);
		console.log("Migration completed!");
	} finally {
		await client.end();
	}
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
