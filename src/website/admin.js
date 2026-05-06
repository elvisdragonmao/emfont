import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Redis } from "ioredis";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";
import { analyseFontsInBatches } from "../utils/read-font-file/analyseFonts.js";
import { get_bullet, get_generated_static_floders } from "../bootstrap/init.js";
import { regenerateAllStaticFont } from "../bootstrap/fontNoMin.js";

const redis = new Redis(process.env.REDIS_URL);
const uploadJobs = new Map();

const originalFontsDir = path.resolve("src/_data/original-fonts");
const allowedCategories = new Set([
	"serif",
	"sans-serif",
	"monospace",
	"cursive",
	"fantasy",
]);

function requireAdmin(req, res) {
	const expected = process.env.ADMIN_UPLOAD_TOKEN || process.env.PASSWORD;
	if (!expected) return true;
	const token =
		req.headers["x-admin-token"] || req.body?.token || req.query?.token || "";
	if (token === expected) return true;
	res.status(403).send({ status: "failed", message: "Invalid admin token" });
	return false;
}

function normalizeTextArray(value) {
	if (Array.isArray(value)) return value.map(String).filter(Boolean);
	if (!value) return [];
	return String(value)
		.split(",")
		.map(item => item.trim())
		.filter(Boolean);
}

function assertUploadPayload(body) {
	if (!body || typeof body !== "object") {
		throw new Error("Missing request body");
	}
	if (!/^[A-Za-z0-9_-]+$/.test(body.id || "")) {
		throw new Error(
			"Font ID can only contain letters, numbers, hyphens, and underscores",
		);
	}
	if (!body.name) throw new Error("Font name is required");
	const weight = Number(body.weight);
	if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
		throw new Error("Weight must be an integer between 1 and 1000");
	}
	const ext = String(body.extension || "")
		.toLowerCase()
		.replace(/^\./, "");
	if (!["ttf", "otf"].includes(ext)) {
		throw new Error("Only ttf and otf fonts are supported");
	}
	if (!allowedCategories.has(body.category)) {
		throw new Error("Invalid category");
	}
	if (!body.fileBase64) throw new Error("Font file is required");
}

async function saveFontRecord(body) {
	const id = body.id.trim();
	const weight = Number(body.weight);
	const extension = String(body.extension).toLowerCase().replace(/^\./, "");
	const fontDir = path.join(originalFontsDir, id);
	await mkdir(fontDir, { recursive: true });
	await writeFile(
		path.join(fontDir, `${weight}.${extension}`),
		Buffer.from(body.fileBase64, "base64"),
	);

	await db.query(
		`
		INSERT INTO font_family (
			id, name, name_zh, name_en, weights, license, version, description,
			category, family, tags, repo_url, authors, demo_content_id, format
		)
		VALUES ($1, $2, $3, $4, ARRAY[$5]::smallint[], $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (id)
		DO UPDATE SET
			name = EXCLUDED.name,
			name_zh = EXCLUDED.name_zh,
			name_en = EXCLUDED.name_en,
			weights = (
				SELECT ARRAY(
					SELECT DISTINCT unnest(COALESCE(font_family.weights, ARRAY[]::smallint[]) || EXCLUDED.weights)
					ORDER BY 1
				)
			),
			license = EXCLUDED.license,
			version = EXCLUDED.version,
			description = EXCLUDED.description,
			category = EXCLUDED.category,
			family = EXCLUDED.family,
			tags = EXCLUDED.tags,
			repo_url = EXCLUDED.repo_url,
			authors = EXCLUDED.authors,
			demo_content_id = EXCLUDED.demo_content_id,
			format = EXCLUDED.format
		`,
		[
			id,
			body.name.trim(),
			body.nameZh?.trim() || null,
			body.nameEn?.trim() || null,
			weight,
			body.license?.trim() || null,
			body.version?.trim() || null,
			body.description?.trim() || null,
			body.category,
			body.family?.trim() || null,
			normalizeTextArray(body.tags),
			body.repoUrl?.trim() || null,
			normalizeTextArray(body.authors),
			Number(body.demoContentId || 1),
			extension,
		],
	);

	return { id, weight, extension };
}

async function generateStaticForUploadedFont(job, font) {
	job.status = "running";
	job.message = "正在分析字型支援的語言";
	await analyseFontsInBatches([
		{
			fontName: font.id,
			weights: String(font.weight),
		},
	]);

	job.message = "正在切割靜態字型包";
	const ok = await regenerateAllStaticFont(
		job.state,
		await get_generated_static_floders(),
		[font.id],
	);
	if (!ok) throw new Error("Static font generation failed");

	job.state.static_font_version = await get_bullet();
	await redis.del(`fontinfo:${font.id}`);
	job.status = "completed";
	job.message = "字型已新增，靜態字型也切好了";
	job.completedAt = new Date().toISOString();
}

export default async function registerAdmin(app, state) {
	app.get("/admin/fonts", async (_req, res) => {
		return res.sendFile("admin-font-upload.html");
	});

	app.get("/api/admin/font-upload-jobs/:jobId", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		const job = uploadJobs.get(req.params.jobId);
		if (!job) {
			return res
				.status(404)
				.send({ status: "failed", message: "Job not found" });
		}
		res.send({
			id: job.id,
			fontId: job.fontId,
			status: job.status,
			message: job.message,
			error: job.error,
			createdAt: job.createdAt,
			completedAt: job.completedAt,
		});
	});

	app.post("/api/admin/fonts", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		try {
			assertUploadPayload(req.body);
			const font = await saveFontRecord(req.body);
			const jobId = `${font.id}-${Date.now().toString(36)}`;
			const job = {
				id: jobId,
				fontId: font.id,
				status: "queued",
				message: "已儲存原始字型，等待切割靜態字型",
				state,
				createdAt: new Date().toISOString(),
			};
			uploadJobs.set(jobId, job);

			generateStaticForUploadedFont(job, font).catch(error => {
				logger.error(`Admin font upload job failed: ${error.message}`);
				job.status = "failed";
				job.message = "靜態字型切割失敗";
				job.error = error.message;
				job.completedAt = new Date().toISOString();
			});

			res.status(202).send({
				status: "accepted",
				message: "Font uploaded. Static generation started.",
				jobId,
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});
}
