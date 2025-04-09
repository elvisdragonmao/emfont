import Fastify from "fastify";
import fastifyView from "@fastify/view";
import ejs from "ejs";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import fastifyStatic from "@fastify/static";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = Fastify({ logger: true });

// Register view engine
app.register(fastifyView, { engine: { ejs: ejs } });

// Register static file serving
app.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/"
});
let user = "";
// Catch-all route
app.get("/", async (req, reply) => {
    return reply.view("/src/website.ejs", { user, page: "home" });
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
