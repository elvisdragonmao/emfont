import Fastify from "fastify";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// Register view engine
app.register(fastifyView, { engine: { ejs: ejs } });

// Register static file serving
app.register(import("@fastify/static"), {
    root: path.join(__dirname, "static"),
    prefix: "/static/", 
});

// Dynamic view route
app.get("/:view", async (req, reply) => {
    let { view } = req.params;
    try {
        if (!view || view === "") view = "home";
        if (fs.existsSync(path.join(__dirname, "views", "pages", `${view}.ejs`)))
            return reply.view(`/src/views/pages/${view}.ejs`);
    } catch (err) {
        console.log(err);
        // if can't find view, return 404
        return reply.status(404).view("/src/views/pages/404.ejs");
    }
});

// Start server
const start = async () => {
    try {
        await app.listen({ port: 3000 });
        console.log("Server running at http://localhost:3000");
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
