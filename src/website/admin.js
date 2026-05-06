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

function fontInfoUrl(state, fontId) {
	return `${state.baseURL.replace(/\/$/, "")}/fonts/${encodeURIComponent(fontId)}`;
}

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

function normalizeWeights(value) {
	const weights = normalizeTextArray(value)
		.map(Number)
		.filter(
			weight => Number.isInteger(weight) && weight >= 1 && weight <= 1000,
		);
	return Array.from(new Set(weights)).sort((a, b) => a - b);
}

function assertFontInfoPayload(body) {
	if (!body || typeof body !== "object")
		throw new Error("Missing request body");
	if (!body.name) throw new Error("Font name is required");
	if (!allowedCategories.has(body.category))
		throw new Error("Invalid category");
	const weights = normalizeWeights(body.weights);
	if (weights.length === 0) throw new Error("At least one weight is required");
	const format = String(body.format || "").toLowerCase();
	if (!["ttf", "otf"].includes(format)) throw new Error("Invalid font format");
}

function assertDemoSentencePayload(body) {
	if (!body || typeof body !== "object")
		throw new Error("Missing request body");
	if (!body.content?.trim()) throw new Error("Sentence content is required");
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

async function getFontRecord(id) {
	const { rows } = await db.query(
		`
		SELECT id, name, name_zh, name_en, weights, license, version, description,
			category, family, tags, repo_url, authors, demo_content_id, format
		FROM font_family
		WHERE id = $1
		`,
		[id],
	);
	return rows[0] || null;
}

async function updateFontRecord(id, body) {
	await db.query(
		`
		UPDATE font_family
		SET
			name = $2,
			name_zh = $3,
			name_en = $4,
			weights = $5,
			license = $6,
			version = $7,
			description = $8,
			category = $9,
			family = $10,
			tags = $11,
			repo_url = $12,
			authors = $13,
			demo_content_id = $14,
			format = $15
		WHERE id = $1
		`,
		[
			id,
			body.name.trim(),
			body.nameZh?.trim() || null,
			body.nameEn?.trim() || null,
			normalizeWeights(body.weights),
			body.license?.trim() || null,
			body.version?.trim() || null,
			body.description?.trim() || null,
			body.category,
			body.family?.trim() || null,
			normalizeTextArray(body.tags),
			body.repoUrl?.trim() || null,
			normalizeTextArray(body.authors),
			Number(body.demoContentId || 1),
			String(body.format).toLowerCase(),
		],
	);
	await redis.del(`fontinfo:${id}`);
	return getFontRecord(id);
}

async function listDemoSentences() {
	const { rows } = await db.query(
		`
		SELECT sid, content, language
		FROM demo_sentence
		ORDER BY sid
		`,
	);
	return rows.map(row => ({
		id: row.sid,
		content: row.content,
		language: row.language,
	}));
}

async function createDemoSentence(body) {
	const { rows } = await db.query(
		`
		INSERT INTO demo_sentence (content, language)
		VALUES ($1, $2)
		RETURNING sid, content, language
		`,
		[body.content.trim(), body.language?.trim() || null],
	);
	return {
		id: rows[0].sid,
		content: rows[0].content,
		language: rows[0].language,
	};
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

	app.get("/admin/fonts/edit", async (_req, res) => {
		return res.sendFile("admin-font-edit.html");
	});

	app.get("/api/admin/config", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		res.send({ baseURL: state.baseURL });
	});

	app.get("/api/admin/demo-sentences", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		res.send(await listDemoSentences());
	});

	app.post("/api/admin/demo-sentences", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		try {
			assertDemoSentencePayload(req.body);
			const sentence = await createDemoSentence(req.body);
			res.status(201).send({
				status: "success",
				message: "Demo sentence created",
				sentence,
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});

	app.get("/api/admin/fonts/:fontId", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		const font = await getFontRecord(req.params.fontId);
		if (!font) {
			return res
				.status(404)
				.send({ status: "failed", message: "Font not found" });
		}
		res.send({
			id: font.id,
			name: font.name,
			nameZh: font.name_zh,
			nameEn: font.name_en,
			weights: font.weights || [],
			license: font.license,
			version: font.version,
			description: font.description,
			category: font.category,
			family: font.family,
			tags: font.tags || [],
			repoUrl: font.repo_url,
			authors: font.authors || [],
			demoContentId: font.demo_content_id,
			format: font.format,
			fontUrl: fontInfoUrl(state, font.id),
		});
	});

	app.put("/api/admin/fonts/:fontId", async (req, res) => {
		if (!requireAdmin(req, res)) return;
		try {
			const exists = await getFontRecord(req.params.fontId);
			if (!exists) {
				return res
					.status(404)
					.send({ status: "failed", message: "Font not found" });
			}
			assertFontInfoPayload(req.body);
			const font = await updateFontRecord(req.params.fontId, req.body);
			res.send({
				status: "success",
				message: "Font info updated",
				fontId: font.id,
				fontUrl: fontInfoUrl(state, font.id),
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
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
			fontUrl: fontInfoUrl(state, job.fontId),
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
				fontUrl: fontInfoUrl(state, font.id),
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});
}
