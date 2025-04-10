// website
import Fastify from "fastify";
import cors from "@fastify/cors";
//import { users } from "./schema.js";
//import fastifyCookie from "@fastify/cookie";
//import fastifyJwt from "@fastify/jwt";
//import axios from "axios";

// font
import { initCheck } from "./init.js";
import dotenv from "dotenv";

// routes
import registerPages from "./website/pages.js";
import registerApi from "./website/api.js";
import registerStatic from "./website/static.js";

dotenv.config();
const state = { alive: false, bulletin: process.env.BULLETIN || "" };

const user = {};
const app = Fastify({ logger: { level: "error" }, ignoreTrailingSlash: true });
//app.register(fastifyCookie);
//app.register(fastifyJwt, { secret: process.env.JWT_SECRET });

app.register(cors, {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
});

await registerPages(app);
await registerApi(app, state);
await registerStatic(app);

// Start server
const start = async () => {
    try {
        const runPort = process.env.RUN_PORT || 3000;
        app.listen({ port: runPort, host: "0.0.0.0" }, () => {
            console.log(`🔗 網頁啟動在 http://localhost:${runPort}`);
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
        console.log("🎉 初始化成功，服務已啟動");
        state.alive = true;
    } else {
        console.log("🤨 初始化失敗，網頁仍在運行");
        if (!state.bulletin) state.bulletin = "emfont 啟動失敗，暫時無法使用。";
    }
});
