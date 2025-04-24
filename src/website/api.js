import { genFont } from "../gen_font.js";
import { db } from "../database.js";
export default async (app, state) => {
    app.post("/g/:font", async (req, res) => {
        try {
            if (req.params.font === "") {
                return res.status(404).send({ status: "failed", message: "Font not found" });
            }
            await genFont(req, res, state);
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

    app.post("/bulletin", async (req, res) => {
        const { bulletin, token } = req.body;
        if (token !== process.env.PASSWORD) return res.status(403).send({ status: "failed", message: "Invalid token" });
        if (!bulletin) return res.status(400).send({ status: "failed", message: "No bulletin provided" });
        state.bulletin = bulletin;
        res.send({ status: "success", message: "Bulletin updated" });
    });

    app.get("/list", async (req, res) => {
        const q = req.query.q?.trim();
        const values = [];
        let whereClause = "";

        if (q) {
            values.push(`%${q}%`);
            whereClause = `
                WHERE id ILIKE $1
                OR name ILIKE $1
                OR name_zh ILIKE $1
                OR name_en ILIKE $1
                OR EXISTS (
                    SELECT 1 FROM unnest(authors) AS author WHERE author ILIKE $1
                )
            `;
        }

        try {
            const { rows } = await db.query(
                `
                SELECT id, name, weights, authors, name_zh, name_en,category, tags, family
                FROM font_family
                ${whereClause}
            `,
                values
            );

            const fonts = rows.map(row => ({
                id: row.id,
                name: row.name,
                weight: row.weights || [],
                author: row.authors && row.authors.length > 0 ? row.authors[0] : null,
                name_zh: row.name_zh,
                name_en: row.name_en,
                category: row.category,
                tags: row.tags || [],
                family: row.family
            }));

            return res.send(fonts);
        } catch (err) {
            console.error("讀取字體列表失敗", err.stack);
            res.status(500).send("Database query failed");
        }
    });

    app.get("/info/:fontID", async (req, res) => {
        const fontID = req.params.fontID;
        try {
            const { rows } = await db.query(
                `
                SELECT id, name, name_zh, name_en, weights, category, tags, family,
                       version, license, repo_url AS source, authors, description
                FROM font_family
                WHERE id = $1
            `,
                [fontID]
            );
            if (rows.length === 0) return res.status(404).send({ status: "failed", message: "Font not found" });
            const font = rows[0];
            res.send({
                name: {
                    original: font.name,
                    zh: font.name_zh,
                    en: font.name_en
                },
                category: font.category,
                weight: font.weights || [],
                tag: font.tags || [],
                family: font.family,
                version: font.version,
                license: font.license,
                source: font.source,
                author: font.authors?.[0] || null,
                description: font.description
            });
        } catch (err) {
            console.error("讀取字體資訊失敗", err.stack);
            res.status(500).send("Database query failed");
        }
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
