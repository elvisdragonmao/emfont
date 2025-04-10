// website
import Fastify from "fastify";
import cors from "@fastify/cors";
//import { users } from "./schema.js";
//import fastifyCookie from "@fastify/cookie";
//import fastifyJwt from "@fastify/jwt";
//import axios from "axios";

// font
import { db } from "./database.js";
import { genFont } from "./gen_font.js";
import { initCheck } from "./init.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
// routes
import registerPages from "./website/pages.js";
import registerApi from "./website/api.js";
import registerStatic from "./website/static.js";

dotenv.config();
let alive = false;
let bulletin = process.env.BULLETIN || "";

const user = {};
const app = Fastify({ logger: true });
//app.register(fastifyCookie);
//app.register(fastifyJwt, { secret: process.env.JWT_SECRET });

app.register(cors, {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
});

await registerPages(app);
await registerApi(app);
await registerStatic(app);

// Start server
const start = async () => {
    try {
        const runPort = process.env.RUN_PORT || 3000;
        app.listen({ port: runPort, host: "0.0.0.0" }, () => {
            console.log(`啟動在 http://localhost:${runPort}`);
        });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();

//init
app.ready().then(async () => {
    const result = await initCheck();
    if (result) {
        console.log("🎉初始化成功，服務已啟動。");
        alive = true;
    } else {
        console.log("😥初始化失敗，網頁仍在運行");
        if (!bulletin) bulletin = "emfont 啟動失敗，暫時無法使用。";
    }
});
