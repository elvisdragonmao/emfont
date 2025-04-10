import { genFont } from "../gen_font.js";
import { db } from "../database.js";
export default async (app,state) => {
    app.post("/g/:font", async (req, res) => {
        try {
            if (req.params.font === "") {
                //return 404
                return res.status(404).send("Font not found");
            }
            console.log("請求字集:", req.body); // { words: '軟語伴茶',weight: '400', min: 'true', format: 'woff2' }
            await genFont(req, res);
        } catch (error) {
            console.error("字體請求錯誤: ", error.stack);
            res.status(500).send({ status: "failed", message: error.message });
        }
    });

    app.get("/testq", async (req, res) => {
        try {
            const select = await db.query("SELECT * FROM font_requests");
            return res.send({ status: "success", message: "資料庫路由測試成功", data: select.rows });
        } catch (err) {
            console.error("資料庫路由測試失敗", err.stack);
            res.status(500).send("Database query failed");
        }
    });

    app.get("/bulletin", async (req, res) => {
        res.send({ status: state.alive ? "up" : "down", message: state.bulletin });
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
};
