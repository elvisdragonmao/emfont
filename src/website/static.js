import { join } from "path";
import fastifyStatic from "@fastify/static";
import { readFile, writeFile } from "fs/promises";
import { minify } from "terser";

export default async (app, state) => {
    let content = await readFile(join(import.meta.dirname, "../emfont.js"), "utf-8");
    content = await minify(content.replace(/{{BASE_URL}}/g, state.baseURL) + "", {
        compress: true,
        mangle: true
    });
    await writeFile(join(import.meta.dirname, "../public/emfont.js"), content.code);

    app.register(fastifyStatic, {
        root: join(import.meta.dirname, "../public"),
        prefix: "/"
    });

    app.register(fastifyStatic, {
        root: join(import.meta.dirname, "../_data/_generated"),
        prefix: "/_generated/",
        decorateReply: false
    });

    app.get("/auth/github", async (req, res) => {
        return res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user`);
    });

    app.get("/emfont.min.js", async (req, res) => {
        return res.redirect("/emfont.js");
    });
};
