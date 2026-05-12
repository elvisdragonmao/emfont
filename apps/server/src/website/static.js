import fastifyStatic from "@fastify/static";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { minify } from "terser";

export default async app => {
	app.register(fastifyStatic, {
		root: join(import.meta.dirname, "../public"),
		prefix: "/"
	});

	app.register(fastifyStatic, {
		root: join(import.meta.dirname, "../_data/_generated"),
		prefix: "/_generated/",
		decorateReply: false
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

	await writeFile(join(import.meta.dirname, "../public/emfont.js"), content.code);
}
