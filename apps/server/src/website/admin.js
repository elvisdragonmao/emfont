import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { Redis } from "ioredis";
import path from "path";
import { promisify } from "util";
import { regenerateAllStaticFont } from "../bootstrap/fontNoMin.js";
import { get_bullet, get_generated_static_floders } from "../bootstrap/init.js";
import { db } from "../utils/database.js";
import { logger } from "../utils/logger.js";
import { analyseFontsInBatches } from "../utils/read-font-file/analyseFonts.js";

const redis = new Redis(process.env.REDIS_URL);
const uploadJobs = new Map();
const scrypt = promisify(crypto.scrypt);
const adminSessionCookie = "emfont_admin_session";
const adminSessionMaxAgeSeconds = 60 * 60 * 24 * 3;

const originalFontsDir = path.resolve("src/_data/original-fonts");
const generatedFontsDir = path.resolve("src/_data/_generated");
const fontExtensions = ["ttf", "otf"];
const allowedCategories = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy"]);

function fontInfoUrl(state, fontId) {
	return `${state.baseURL.replace(/\/$/, "")}/fonts/${encodeURIComponent(fontId)}`;
}

function getSessionSecret() {
	return process.env.ADMIN_SESSION_SECRET || process.env.PASSWORD || "emfont-development-admin-session-secret";
}

function signSessionPayload(payload) {
	return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function createSessionCookie(userId) {
	const expiresAt = Date.now() + adminSessionMaxAgeSeconds * 1000;
	const payload = `${userId}:${expiresAt}`;
	return `${payload}:${signSessionPayload(payload)}`;
}

function readSessionUser(req) {
	const raw = req.cookies?.[adminSessionCookie];
	if (!raw) return null;
	const parts = raw.split(":");
	if (parts.length !== 3) return null;
	const [userId, expiresAt, signature] = parts;
	const payload = `${userId}:${expiresAt}`;
	if (signature !== signSessionPayload(payload)) return null;
	if (Number(expiresAt) < Date.now()) return null;
	return userId;
}

function setAdminSession(res, userId) {
	res.setCookie(adminSessionCookie, createSessionCookie(userId), {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: adminSessionMaxAgeSeconds
	});
}

function clearAdminSession(res) {
	res.clearCookie(adminSessionCookie, { path: "/" });
}

function requireAdminPage(req, res) {
	const userId = readSessionUser(req);
	if (userId) return userId;
	res.redirect("/admin/login");
	return null;
}

function requireAdminApi(req, res) {
	const userId = readSessionUser(req);
	if (userId) return userId;
	res.status(401).send({ status: "failed", message: "Login required" });
	return null;
}

async function hashPassword(password) {
	const salt = crypto.randomBytes(16).toString("base64url");
	const derived = await scrypt(password, salt, 64);
	return `scrypt:${salt}:${derived.toString("base64url")}`;
}

async function verifyPassword(password, passwordHash) {
	const [scheme, salt, hash] = passwordHash.split(":");
	if (scheme !== "scrypt" || !salt || !hash) return false;
	const derived = await scrypt(password, salt, 64);
	const expected = Buffer.from(hash, "base64url");
	return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

async function initBootstrapAdminUser() {
	const userId = process.env.ADMIN_BOOTSTRAP_USER_ID?.trim();
	const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
	if (!userId || !password) return;

	const passwordHash = await hashPassword(password);
	await db.query(
		`
		INSERT INTO admin_users (user_id, password_hash)
		VALUES ($1, $2)
		ON CONFLICT (user_id)
		DO NOTHING
		`,
		[userId, passwordHash]
	);
}

async function loginAdminUser(userId, password) {
	const { rows } = await db.query(
		`
		SELECT user_id, password_hash
		FROM admin_users
		WHERE user_id = $1
		`,
		[userId]
	);
	if (rows.length === 0) return false;
	if (!(await verifyPassword(password, rows[0].password_hash))) return false;
	await db.query(
		`
		UPDATE admin_users
		SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE user_id = $1
		`,
		[userId]
	);
	return true;
}

async function verifyAdminUserPassword(userId, password) {
	if (!userId || !password) return false;
	const { rows } = await db.query(
		`
		SELECT password_hash
		FROM admin_users
		WHERE user_id = $1
		`,
		[userId]
	);
	if (rows.length === 0) return false;
	return verifyPassword(password, rows[0].password_hash);
}

async function syncOriginalFontToMinio({ id, weight, extension, buffer }) {
	if (process.env.SYNC_WITH_MINIO !== "true") return;
	if (!isMinioConfigured()) {
		throw new Error("SYNC_WITH_MINIO=true, but MinIO is not configured");
	}

	const minioClient = createMinioClient();
	const key = `original-fonts/${id}/${weight}.${extension}`;
	await minioClient.send(
		new PutObjectCommand({
			Bucket: process.env.MINIO_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: extension === "otf" ? "font/otf" : "font/ttf"
		})
	);
	logger.info(`Synced original font to MinIO: ${key}`);
}

async function deleteOriginalFontFromMinio({ id, weight, extension }) {
	if (process.env.SYNC_WITH_MINIO !== "true" || !isMinioConfigured()) return;
	const minioClient = createMinioClient();
	const key = `original-fonts/${id}/${weight}.${extension}`;
	await minioClient.send(
		new DeleteObjectCommand({
			Bucket: process.env.MINIO_BUCKET,
			Key: key
		})
	);
	logger.info(`Deleted stale original font from MinIO: ${key}`);
}

async function deleteMinioPrefix(prefix) {
	if (process.env.SYNC_WITH_MINIO !== "true" || !isMinioConfigured()) return;
	const minioClient = createMinioClient();
	let continuationToken;
	do {
		const listed = await minioClient.send(
			new ListObjectsV2Command({
				Bucket: process.env.MINIO_BUCKET,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);
		const objects = (listed.Contents || []).map(item => ({ Key: item.Key }));
		if (objects.length > 0) {
			await minioClient.send(
				new DeleteObjectsCommand({
					Bucket: process.env.MINIO_BUCKET,
					Delete: { Objects: objects }
				})
			);
		}
		continuationToken = listed.NextContinuationToken;
	} while (continuationToken);
	logger.info(`Deleted MinIO prefix: ${prefix}`);
}

async function deleteMinioKeys(minioClient, keys) {
	for (let i = 0; i < keys.length; i += 1000) {
		const chunk = keys.slice(i, i + 1000);
		if (chunk.length === 0) continue;
		await minioClient.send(
			new DeleteObjectsCommand({
				Bucket: process.env.MINIO_BUCKET,
				Delete: {
					Objects: chunk.map(Key => ({ Key }))
				}
			})
		);
	}
}

async function deleteMinioObjectsMatching(prefix, matchesKey) {
	if (process.env.SYNC_WITH_MINIO !== "true" || !isMinioConfigured()) return;
	const minioClient = createMinioClient();
	let continuationToken;
	do {
		const listed = await minioClient.send(
			new ListObjectsV2Command({
				Bucket: process.env.MINIO_BUCKET,
				Prefix: prefix,
				ContinuationToken: continuationToken
			})
		);
		const objects = (listed.Contents || []).filter(item => matchesKey(item.Key)).map(item => item.Key);
		await deleteMinioKeys(minioClient, objects);
		continuationToken = listed.NextContinuationToken;
	} while (continuationToken);
}

function isMinioConfigured() {
	return process.env.MINIO_ENDPOINT && process.env.MINIO_USERNAME && process.env.MINIO_PASSWORD && process.env.MINIO_BUCKET;
}

function createMinioClient() {
	const minioClient = new S3Client({
		region: "auto",
		endpoint: process.env.MINIO_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: process.env.MINIO_USERNAME,
			secretAccessKey: process.env.MINIO_PASSWORD
		}
	});
	return minioClient;
}

async function syncGeneratedStaticFontToMinio({ id, weight, version }) {
	if (process.env.SYNC_WITH_MINIO !== "true") return;
	if (!isMinioConfigured()) {
		throw new Error("SYNC_WITH_MINIO=true, but MinIO is not configured");
	}

	const minioClient = createMinioClient();
	const generatedDirName = `${version}-${id}-${weight}`;
	const generatedDir = path.join(generatedFontsDir, generatedDirName);
	const files = (await readdir(generatedDir)).filter(file => /^\d+\.woff2$/i.test(file));
	if (files.length === 0) {
		throw new Error(`No generated static font files found: ${generatedDirName}`);
	}

	const localKeys = new Set(files.map(file => `_generated/${generatedDirName}/${file}`));
	await Promise.all(
		files.map(async file => {
			const key = `_generated/${generatedDirName}/${file}`;
			const body = await readFile(path.join(generatedDir, file));
			await minioClient.send(
				new PutObjectCommand({
					Bucket: process.env.MINIO_BUCKET,
					Key: key,
					Body: body,
					ContentType: "font/woff2"
				})
			);
		})
	);

	const staleKeys = [];
	let continuationToken;
	do {
		const listed = await minioClient.send(
			new ListObjectsV2Command({
				Bucket: process.env.MINIO_BUCKET,
				Prefix: `_generated/${generatedDirName}/`,
				ContinuationToken: continuationToken
			})
		);
		for (const item of listed.Contents || []) {
			if (!localKeys.has(item.Key)) staleKeys.push(item.Key);
		}
		continuationToken = listed.NextContinuationToken;
	} while (continuationToken);

	await deleteMinioKeys(minioClient, staleKeys);
	logger.info(`Synced generated static fonts to MinIO: _generated/${generatedDirName}/ (${files.length} files)`);
}

async function saveOriginalFontFile({ id, weight, extension, fileBase64 }) {
	if (process.env.SYNC_WITH_MINIO === "true" && !isMinioConfigured()) {
		throw new Error("SYNC_WITH_MINIO=true, but MinIO is not configured");
	}
	const fontDir = path.join(originalFontsDir, id);
	const fontBuffer = Buffer.from(fileBase64, "base64");

	await syncOriginalFontToMinio({ id, weight, extension, buffer: fontBuffer });
	await mkdir(fontDir, { recursive: true });
	await writeFile(path.join(fontDir, `${weight}.${extension}`), fontBuffer);

	for (const oldExtension of fontExtensions) {
		if (oldExtension === extension) continue;
		await rm(path.join(fontDir, `${weight}.${oldExtension}`), {
			force: true
		});
		await deleteOriginalFontFromMinio({ id, weight, extension: oldExtension });
	}
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
		throw new Error("Font ID can only contain letters, numbers, hyphens, and underscores");
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

function normalizeFontExtension(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/^\./, "");
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWeights(value) {
	const weights = normalizeTextArray(value)
		.map(Number)
		.filter(weight => Number.isInteger(weight) && weight >= 1 && weight <= 1000);
	return Array.from(new Set(weights)).sort((a, b) => a - b);
}

function normalizeFontInfoWeights(body) {
	const weights = normalizeWeights(body.weights);
	const replacementWeight = Number(body.replacementWeight);
	if (body.fileBase64 && Number.isInteger(replacementWeight) && replacementWeight >= 1 && replacementWeight <= 1000 && !weights.includes(replacementWeight)) {
		weights.push(replacementWeight);
	}
	return Array.from(new Set(weights)).sort((a, b) => a - b);
}

function assertFontInfoPayload(body) {
	if (!body || typeof body !== "object") throw new Error("Missing request body");
	if (!body.name) throw new Error("Font name is required");
	if (!allowedCategories.has(body.category)) throw new Error("Invalid category");
	const weights = normalizeFontInfoWeights(body);
	if (weights.length === 0) throw new Error("At least one weight is required");
	const format = String(body.format || "").toLowerCase();
	if (!["ttf", "otf"].includes(format)) throw new Error("Invalid font format");
}

function normalizeReplacementFont(body) {
	if (!body.fileBase64 && !body.replacementWeight && !body.extension) return null;
	if (!body.fileBase64) throw new Error("Font file is required");
	const weight = Number(body.replacementWeight);
	if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
		throw new Error("Replacement weight must be an integer between 1 and 1000");
	}
	const extension = normalizeFontExtension(body.extension);
	if (!fontExtensions.includes(extension)) {
		throw new Error("Only ttf and otf fonts are supported");
	}
	return { weight, extension, fileBase64: body.fileBase64 };
}

function assertDemoSentencePayload(body) {
	if (!body || typeof body !== "object") throw new Error("Missing request body");
	if (!body.content?.trim()) throw new Error("Sentence content is required");
}

async function saveFontRecord(body) {
	const id = body.id.trim();
	const weight = Number(body.weight);
	const extension = normalizeFontExtension(body.extension);
	await saveOriginalFontFile({
		id,
		weight,
		extension,
		fileBase64: body.fileBase64
	});

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
			extension
		]
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
		[id]
	);
	return rows[0] || null;
}

async function updateFontRecord(id, body) {
	const replacementFont = normalizeReplacementFont(body);
	if (replacementFont) {
		await saveOriginalFontFile({
			id,
			...replacementFont
		});
		body.format = replacementFont.extension;
	}

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
			normalizeFontInfoWeights(body),
			body.license?.trim() || null,
			body.version?.trim() || null,
			body.description?.trim() || null,
			body.category,
			body.family?.trim() || null,
			normalizeTextArray(body.tags),
			body.repoUrl?.trim() || null,
			normalizeTextArray(body.authors),
			Number(body.demoContentId || 1),
			String(body.format).toLowerCase()
		]
	);
	await redis.del(`fontinfo:${id}`);
	return {
		font: await getFontRecord(id),
		replacementFont
	};
}

async function removeGeneratedFontPackages(fontId) {
	await mkdir(generatedFontsDir, { recursive: true });
	const pattern = new RegExp(`^\\d+-${escapeRegExp(fontId)}-\\d+$`);
	const entries = await readdir(generatedFontsDir, { withFileTypes: true });
	await Promise.all(
		entries
			.filter(entry => entry.isDirectory() && pattern.test(entry.name))
			.map(entry =>
				rm(path.join(generatedFontsDir, entry.name), {
					recursive: true,
					force: true
				})
			)
	);
}

async function deleteFontRecord(id) {
	await db.query("BEGIN");
	try {
		await db.query(`DELETE FROM usage_log WHERE family_id = $1`, [id]);
		await db.query(`DELETE FROM dynamic_fonts WHERE family_id = $1`, [id]);
		await db.query(
			`
			UPDATE static_fonts
			SET families = array_remove(families, $1)
			WHERE $1 = ANY(families)
			`,
			[id]
		);
		const deleted = await db.query(
			`
			DELETE FROM font_family
			WHERE id = $1
			RETURNING id
			`,
			[id]
		);
		if (deleted.rowCount === 0) throw new Error("Font not found");
		await db.query("COMMIT");
	} catch (error) {
		await db.query("ROLLBACK");
		throw error;
	}

	const cleanupResults = await Promise.allSettled([
		rm(path.join(originalFontsDir, id), { recursive: true, force: true }),
		removeGeneratedFontPackages(id),
		deleteMinioPrefix(`original-fonts/${id}/`),
		deleteMinioPrefix(`css/${id}/`),
		deleteMinioObjectsMatching("_generated/", key => new RegExp(`^_generated/\\d+-${escapeRegExp(id)}-\\d+/`).test(key))
	]);
	for (const result of cleanupResults) {
		if (result.status === "rejected") {
			logger.warn(`Font cleanup skipped after delete: ${result.reason.message}`);
		}
	}
	await redis.del(`fontinfo:${id}`);
}

async function listDemoSentences() {
	const { rows } = await db.query(
		`
		SELECT sid, content, language
		FROM demo_sentence
		ORDER BY sid
		`
	);
	return rows.map(row => ({
		id: row.sid,
		content: row.content,
		language: row.language
	}));
}

async function createDemoSentence(body) {
	const { rows } = await db.query(
		`
		INSERT INTO demo_sentence (content, language)
		VALUES ($1, $2)
		RETURNING sid, content, language
		`,
		[body.content.trim(), body.language?.trim() || null]
	);
	return {
		id: rows[0].sid,
		content: rows[0].content,
		language: rows[0].language
	};
}

async function generateStaticForUploadedFont(job, font) {
	job.status = "running";
	job.message = "正在分析字型支援的語言";
	await analyseFontsInBatches([
		{
			fontName: font.id,
			weights: String(font.weight)
		}
	]);

	job.message = "正在切割靜態字型包";
	await removeStaticFontPackages(font.id, font.weight);
	const ok = await regenerateAllStaticFont(job.state, await get_generated_static_floders(), [font.id]);
	if (!ok) throw new Error("Static font generation failed");

	const staticFontVersion = await get_bullet();
	job.state.static_font_version = staticFontVersion;
	job.message = "正在同步靜態字型到 MinIO";
	await syncGeneratedStaticFontToMinio({
		id: font.id,
		weight: font.weight,
		version: staticFontVersion
	});
	await redis.del(`fontinfo:${font.id}`);
	job.status = "completed";
	job.message = "字型已新增，靜態字型也切好了";
	job.completedAt = new Date().toISOString();
}

async function removeStaticFontPackages(fontId, weight) {
	const pattern = new RegExp(`^\\d+-${escapeRegExp(fontId)}-${escapeRegExp(weight)}$`);
	await mkdir(generatedFontsDir, { recursive: true });
	const entries = await readdir(generatedFontsDir, { withFileTypes: true });
	await Promise.all(
		entries
			.filter(entry => entry.isDirectory() && pattern.test(entry.name))
			.map(entry =>
				rm(path.join(generatedFontsDir, entry.name), {
					recursive: true,
					force: true
				})
			)
	);
}

function queueStaticGenerationJob({ state, font, queuedMessage }) {
	const jobId = `${font.id}-${Date.now().toString(36)}`;
	const job = {
		id: jobId,
		fontId: font.id,
		status: "queued",
		message: queuedMessage,
		state,
		createdAt: new Date().toISOString()
	};
	uploadJobs.set(jobId, job);

	generateStaticForUploadedFont(job, font).catch(error => {
		logger.error(`Admin font upload job failed: ${error.message}`);
		job.status = "failed";
		job.message = "靜態字型切割失敗";
		job.error = error.message;
		job.completedAt = new Date().toISOString();
	});

	return jobId;
}

export default async function registerAdmin(app, state) {
	await initBootstrapAdminUser();

	app.get("/admin/login", async (_req, res) => {
		return res.sendFile("admin-login.html");
	});

	app.post("/api/admin/login", async (req, res) => {
		const userId = req.body?.userId?.trim();
		const password = req.body?.password || "";
		if (!userId || !password) {
			return res.status(400).send({ status: "failed", message: "Missing credentials" });
		}
		if (!(await loginAdminUser(userId, password))) {
			return res.status(401).send({ status: "failed", message: "Invalid credentials" });
		}
		setAdminSession(res, userId);
		res.send({ status: "success", message: "Logged in" });
	});

	app.post("/api/admin/logout", async (_req, res) => {
		clearAdminSession(res);
		res.send({ status: "success", message: "Logged out" });
	});

	app.get("/admin/fonts", async (req, res) => {
		if (!requireAdminPage(req, res)) return;
		return res.sendFile("admin-font-upload.html");
	});

	app.get("/admin/fonts/edit", async (req, res) => {
		if (!requireAdminPage(req, res)) return;
		return res.sendFile("admin-font-edit.html");
	});

	app.get("/api/admin/config", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		res.send({ baseURL: state.baseURL });
	});

	app.get("/api/admin/demo-sentences", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		res.send(await listDemoSentences());
	});

	app.post("/api/admin/demo-sentences", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		try {
			assertDemoSentencePayload(req.body);
			const sentence = await createDemoSentence(req.body);
			res.status(201).send({
				status: "success",
				message: "Demo sentence created",
				sentence
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});

	app.get("/api/admin/fonts/:fontId", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		const font = await getFontRecord(req.params.fontId);
		if (!font) {
			return res.status(404).send({ status: "failed", message: "Font not found" });
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
			fontUrl: fontInfoUrl(state, font.id)
		});
	});

	app.put("/api/admin/fonts/:fontId", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		try {
			const exists = await getFontRecord(req.params.fontId);
			if (!exists) {
				return res.status(404).send({ status: "failed", message: "Font not found" });
			}
			assertFontInfoPayload(req.body);
			const { font, replacementFont } = await updateFontRecord(req.params.fontId, req.body);
			const jobId = replacementFont
				? queueStaticGenerationJob({
						state,
						font: {
							id: font.id,
							weight: replacementFont.weight,
							extension: replacementFont.extension
						},
						queuedMessage: "已更新原始字型，等待重新切割靜態字型"
					})
				: null;
			res.send({
				status: "success",
				message: replacementFont ? "Font file updated. Static generation started." : "Font info updated",
				fontId: font.id,
				fontUrl: fontInfoUrl(state, font.id),
				jobId
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});

	app.delete("/api/admin/fonts/:fontId", async (req, res) => {
		const userId = requireAdminApi(req, res);
		if (!userId) return;
		try {
			const font = await getFontRecord(req.params.fontId);
			if (!font) {
				return res.status(404).send({ status: "failed", message: "Font not found" });
			}
			if (req.body?.confirmId !== req.params.fontId) {
				return res.status(400).send({
					status: "failed",
					message: "Font ID confirmation does not match"
				});
			}
			if (!(await verifyAdminUserPassword(userId, req.body?.password))) {
				return res.status(403).send({ status: "failed", message: "Invalid password" });
			}
			await deleteFontRecord(req.params.fontId);
			res.send({
				status: "success",
				message: "Font deleted",
				fontId: req.params.fontId
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});

	app.get("/api/admin/font-upload-jobs/:jobId", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		const job = uploadJobs.get(req.params.jobId);
		if (!job) {
			return res.status(404).send({ status: "failed", message: "Job not found" });
		}
		res.send({
			id: job.id,
			fontId: job.fontId,
			status: job.status,
			message: job.message,
			error: job.error,
			createdAt: job.createdAt,
			completedAt: job.completedAt,
			fontUrl: fontInfoUrl(state, job.fontId)
		});
	});

	app.post("/api/admin/fonts", async (req, res) => {
		if (!requireAdminApi(req, res)) return;
		try {
			assertUploadPayload(req.body);
			const font = await saveFontRecord(req.body);
			const jobId = queueStaticGenerationJob({
				state,
				font,
				queuedMessage: "已儲存原始字型，等待切割靜態字型"
			});

			res.status(202).send({
				status: "accepted",
				message: "Font uploaded. Static generation started.",
				jobId,
				fontUrl: fontInfoUrl(state, font.id)
			});
		} catch (error) {
			res.status(400).send({ status: "failed", message: error.message });
		}
	});
}
