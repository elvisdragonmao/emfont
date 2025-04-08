/** @format */

import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyView from "@fastify/view";
import ejs from "ejs";
//import fastifyCookie from "@fastify/cookie";
//import fastifyJwt from "@fastify/jwt";
//import axios from "axios";
import { db } from "./database.js";
//import { users } from "./schema.js";
import { genFont } from "./gen_font.js";
import { initCheck } from "./init.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fastifyStatic from "@fastify/static";
dotenv.config(); // 讀取 .env 變數
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const user = {};
const app = Fastify({ logger: true });

let alive = false;
let bulletin = process.env.BULLETIN || "";

//app.register(fastifyCookie);
//app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
app.register(fastifyView, { engine: { ejs: ejs } });

app.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/"
});

app.register(cors, {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
});

// Pages routes
app.get("/", async (req, reply) => {
    // try {
    //     const token = req.cookies.token;
    //     if (token) {
    //         user = await req.jwtVerify();
    //     }
    // } catch (err) {
    //     console.error("JWT 驗證失敗:", err);
    // }
    return reply.view("/src/website.ejs", { user, page: "home" });
});

app.get("/emfont.min.js", async (req, reply) => {
    return reply.redirect(301, "/emfont.js");
});

app.get("/login", async (req, reply) => {
    return reply.view("/src/website.ejs", { user, page: "login" });
});

app.get("/logout", (req, reply) => {
    reply.clearCookie("token");
    reply.redirect("/");
});

app.get("/fonts/:font", async (req, reply) => {
    let page = "font";
    if (req.params.font === "") page = "fonts";
    if (false)
        // 字體不存在
        return res.status(404).view("/src/website.ejs", { user, page: "notFound" });
    return reply.view("/src/website.ejs", { user, page });
});

app.get("/about", async (req, reply) => {
    return reply.view("/src/website.ejs", { user, page: "about" });
});

app.get("/dashboard", async (req, reply) => {
    const user = req.cookies.token;
    if (!user) return reply.redirect("/login");
    return reply.view("/src/website.ejs", { user, page: "dashboard" });
});

app.get("/auth/github", async (req, reply) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user`;
    reply.redirect(githubAuthUrl);
});

app.post("/g/:font", async (req, res) => {
    //根據前端需要的字集，產生字型檔
    try {
        if (req.params.font === "") {
            //return 404
            return res.status(404).send("Font not found");
        }
        // console.log("請求字型：", req.params); // { font: 'ZhuQueFangSong' }
        console.log("請求字集:", req.body); // { words: '軟語伴茶',weight: '400', min: 'true', format: 'woff2' }
        await genFont(req, res);
    } catch (error) {
        console.log("字體請求錯誤: ", error.stack);
        res.status(500).send({ status: "failed", message: error.message });
    }
});

//測試資料庫路由
app.get("/testq", async (request, reply) => {
    try {
        const select = await db.query("SELECT * FROM font_requests");
        return res.send({ status: "success", message: "資料庫路由測試成功", data: select.rows });
    } catch (err) {
        console.error("資料庫路由測試失敗", err.stack);
        reply.status(500).send("Database query failed");
    }
});

app.get("/bulletin", async (req, res) => {
    res.send({ status: alive ? "up" : "down", message: bulletin });
});

// 404 page
app.setNotFoundHandler((req, reply) => {
    return reply.view("/src/website.ejs", { user, page: "notFound" });
});

// GitHub OAuth callback
// app.get("/callback", async (req, reply) => {
//     const { code } = req.query;
//     if (!code) return reply.send("No code provided");

//     try {
//         const tokenRes = await axios.post(
//             "https://github.com/login/oauth/access_token",
//             {
//                 client_id: process.env.GITHUB_CLIENT_ID,
//                 client_secret: process.env.GITHUB_CLIENT_SECRET,
//                 code,
//             },
//             { headers: { Accept: "application/json" } }
//         );
//         const accessToken = tokenRes.data.access_token;
//         if (!accessToken) return reply.send("Failed to get access token");

//         const userRes = await axios.get("https://api.github.com/user", {
//             headers: { Authorization: `Bearer ${accessToken}` },
//         });
//         const { login, avatar_url } = userRes.data;
//         await db
//             .insert(users)
//             .values({ username: login, avatar: avatar_url })
//             .onConflictDoNothing();
//         console.log("Login success:", login);
//         const token = app.jwt.sign({ username: login, avatar: avatar_url });

//         reply.setCookie("token", token, { httpOnly: true, path: "/" });
//         reply.redirect("/");
//     } catch (err) {
//         reply.send("Login failed");
//     }
// });

// Start server
const start = async () => {
    try {
        const run_port = process.env.PORT || 3000;
        app.listen({ port: run_port, host: "0.0.0.0" }, () => {
            console.log(`啟動在 http://localhost:${run_port}`);
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
