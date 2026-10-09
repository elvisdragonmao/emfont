import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// Isolate the upload code from admin.js's startup connections to Redis/Postgres.
const source = readFileSync(
	new URL("../src/website/admin.js", import.meta.url),
	"utf8",
);
function section(start, end) {
	return source.slice(source.indexOf(start), source.indexOf(end));
}
function batchContext(existing = new Map()) {
	const writes = [];
	const context = vm.createContext({
		fontFileName: (weight, part, extension) =>
			`${weight}${part ? `-${part}` : ""}.${extension}`,
		listFontPartFiles: (_id, weight) => existing.get(weight) || [],
		saveOriginalFontFile: async file => writes.push(file),
	});
	vm.runInContext(
		section(
			"function parseOriginalUploadName(",
			"async function listOriginalFontFiles(",
		) +
			section(
				"async function saveOriginalFontBatch(",
				"async function getFontRecord(",
			),
		context,
	);
	return { save: context.saveOriginalFontBatch, writes };
}
const file = name => ({ name, fileBase64: "Zm9udA==" });

test("a later orphan part rejects the entire batch before any storage write", async () => {
	const { save, writes } = batchContext();
	await assert.rejects(
		save("Test", [file("400.ttf"), file("500-1.ttf")]),
		/primary file 500.ttf/,
	);
	assert.equal(writes.length, 0);
});

test("a primary in the same batch permits parts regardless of input order", async () => {
	const { save, writes } = batchContext();
	const weights = await save("Test", [
		file("500-1.otf"),
		file("400.ttf"),
		file("500.ttf"),
	]);
	assert.deepEqual(Array.from(weights), [400, 500]);
	assert.deepEqual(
		writes.map(({ weight, part }) => [weight, part]),
		[
			[400, 0],
			[500, 0],
			[500, 1],
		],
	);
	assert.ok(writes.every(write => write.resetParts === false));
});

test("an existing primary permits uploading only a new part", async () => {
	const { save, writes } = batchContext(
		new Map([[400, [{ part: 0, type: "otf" }]]]),
	);
	await save("Test", [file("400-1.ttf")]);
	assert.equal(writes.length, 1);
});

test("existing orphan parts do not count as a primary", async () => {
	const { save, writes } = batchContext(new Map([[400, [{ part: 1 }]]]));
	await assert.rejects(save("Test", [file("400-2.ttf")]), /primary file/);
	assert.equal(writes.length, 0);
});

test("invalid names, duplicate names and missing content reject before writes", async () => {
	for (const files of [
		[file("400.ttf"), file("invalid.ttf")],
		[file("400.ttf"), file("0400.TTF")],
		[file("400.ttf"), { name: "500.ttf" }],
	]) {
		const { save, writes } = batchContext();
		await assert.rejects(save("Test", files));
		assert.equal(writes.length, 0);
	}
});

function uploadRoute({ failDatabase = false } = {}) {
	const calls = [];
	let handler;
	const context = vm.createContext({
		app: {
			post: (_path, callback) => {
				handler = callback;
			},
		},
		requireSuperAdminApi: async () => true,
		getFontRecord: async () => ({ id: "Test", weights: [400] }),
		saveOriginalFontBatch: async () => {
			calls.push("save");
			return [700];
		},
		db: {
			query: async (sql, params) => {
				calls.push({ sql, params });
				if (failDatabase) throw new Error("Database failed");
			},
		},
		redis: { del: async key => calls.push(key) },
		queueStaticGenerationJob: job => {
			calls.push(job);
			return "job-id";
		},
		state: {},
	});
	vm.runInContext(
		section(
			'\tapp.post("/api/admin/fonts/:fontId/original-files",',
			'\tapp.put("/api/admin/fonts/:fontId",',
		),
		context,
	);
	const response = {
		status(code) {
			this.code = code;
			return this;
		},
		send(body) {
			this.body = body;
			return this;
		},
	};
	return { handler, calls, response };
}

test("persist an atomic sorted weight union and invalidate cache before queuing", async () => {
	const { handler, calls, response } = uploadRoute();
	await handler({ params: { fontId: "Test" }, body: { files: [] } }, response);
	assert.equal(response.code, 202);
	assert.equal(calls[0], "save");
	assert.match(calls[1].sql, /UPDATE font_family/);
	assert.match(
		calls[1].sql,
		/DISTINCT unnest\(COALESCE\(weights, ARRAY\[\]::smallint\[\]\) \|\| \$2::smallint\[\]\)/,
	);
	assert.match(calls[1].sql, /ORDER BY 1/);
	assert.equal(calls[1].params[0], "Test");
	assert.deepEqual(Array.from(calls[1].params[1]), [700]);
	assert.equal(calls[2], "fontinfo:Test");
	assert.deepEqual(Array.from(calls[3].font.weights), [700]);
});

test("database failure does not queue a generation job", async () => {
	const { handler, calls, response } = uploadRoute({ failDatabase: true });
	await handler({ params: { fontId: "Test" }, body: { files: [] } }, response);
	assert.equal(response.code, 400);
	assert.equal(calls.length, 2);
	assert.equal(response.body.message, "Database failed");
});
