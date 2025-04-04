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
    prefix: "/static/"
});

// No matter what is in the URL, serve the website
app.get("/*", async (request, reply) => {
    return reply.view("/src/website.ejs");
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
