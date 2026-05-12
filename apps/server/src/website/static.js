import fastifyStatic from "@fastify/static";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { minify } from "terser";

const publicRoot = join(import.meta.dirname, "../public");

export default async app => {
	app.register(fastifyStatic, {
		root: join(import.meta.dirname, "../_data/_generated"),
		prefix: "/_generated/",
		decorateReply: false
	});

	app.get("/emfont.js", async (_req, res) => {
		try {
			const content = await readFile(join(publicRoot, "emfont.js"), "utf-8");
			return res.type("application/javascript").send(content);
		} catch {
			return res.status(503).send("// emfont.js is not ready yet");
		}
	});

	app.get("/sitemap.xml", async (_req, res) => {
		try {
			const content = await readFile(join(publicRoot, "sitemap.xml"), "utf-8");
			return res.type("application/xml").send(content);
		} catch {
			return res.status(404).send("Sitemap not generated");
		}
	});

	app.get("/emfont.min.js", async (req, res) => {
		return res.redirect("/emfont.js");
	});
};

/**
 * Generate emfont.js
 */
export async function generateEmfontJS(state) {
	let content = await readFile(join(import.meta.dirname, "../emfont.js"), "utf-8");
	content = content.replace(/{{BASE_URL}}/g, state.baseURL);

	// static_font_version is undefined when initCheck failed
	// for this case, we use a random string as version
	// so restarting the server invalidates the cache
	content = content.replace(/{{FONT_VERSION}}/g, state.static_font_version ?? Math.random().toString(36).substring(2));

	content = await minify(content, {
		compress: true,
		mangle: true
	});

	await mkdir(publicRoot, { recursive: true });
	await writeFile(join(publicRoot, "emfont.js"), content.code);
}
