import { join } from 'path';
import fastifyStatic from "@fastify/static";

export default async app => {
    app.register(fastifyStatic, {
        root: join(import.meta.dirname,"../public"),
        prefix: "/"
    });

    app.get("/auth/github", async (req, res) => {
        return res.redirect(`https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user`);
    });

    app.get("/emfont.min.js", async (req, res) => {
        return res.redirect(301, "/emfont.js");
    });
};
