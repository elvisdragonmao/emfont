import { genFont } from "../utils/generate-font/genFont.js";
import { db } from "../utils/database.js";
import { writeFile } from "fs/promises";
import { join } from "path";
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL);
const generateSitemap = async state => {
    const { rows } = await db.query(`SELECT id FROM font_family`);
    const content = rows.map(row => `<url><loc>${state.baseURL}/fonts/${row.id}/</loc></url>`).join("\n");
    let pageList = ["", "/about", "/fonts", "/login", "/about", "/dashboard"];
    const pages = pageList.map(row => `<url><loc>${state.baseURL}${row}/</loc></url>`).join("\n");
    await writeFile(
        join(import.meta.dirname, "../public/sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${content}
${pages}
</urlset>`
    );
};

const registerApi = async (app, state) => {
    app.get("/robots.txt", (req, res) => {
        if (state.baseURL === "https://font.emtech.cc") {
            res.type("text/plain").send("User-agent: *\nAllow: /\nSitemap: https://font.emtech.cc/sitemap.xml");
        } else {
            res.type("text/plain").send("User-agent: *\nDisallow: /");
        }
    });

    app.post("/g/:font", async (req, res) => {
        try {
            if (req.params.font === "") {
                return res.status(404).send({ status: "failed", message: "Font not found" });
            }
            const response = await genFont(req, res, state);
            res.status(response.code).send(response);
        } catch (error) {
            console.error("字體請求錯誤: ", error.stack);
            res.status(500).send({ status: "failed", message: error.message });
        }
    });

    app.get("/g/:font", async (req, res) => {
        res.status(405).send("You can only use POST method to request font in JSON format");
    });

    app.get("/css/:font", async (req, res) => {
        console.log("Received CSS request for font:", req.params.font);
        try {
            if (req.params.font === "") {
                return res.status(404).send("/* Please enter font name */");
            }
            const font_id = req.params.font;
            req.body = {};
            req.body.words = req.query.words?.trim() ?? null;
            req.body.weight = req.query.weight?.trim() ?? null;
            if (!req.body.words) {
                const { rows } = await db.query(`SELECT name, weights FROM font_family WHERE id = $1`, [font_id]);
                if (rows.length === 0)
                    return {
                        code: 404,
                        status: "failed",
                        message: "Font not found"
                    };
                let allWeights = rows[0].weights;
                if (allWeights.rowCount === 0) {
                    return res.status(404).send({
                        code: 404,
                        status: "failed",
                        message: "No weights available for this font"
                    });
                }
                if (req.body.weight && allWeights.includes(req.body.weight)) {
                    allWeights = [req.body.weight];
                }
                return res.type("text/css").send(allWeights.map(weight => `@import url('${state.baseURL}/css/${font_id}/${weight}');`).join("\n"));
                //https://font.emtech.cc/file/original-fonts/GenSekiGothicTC/400.otf
            } else {
                req.body.min = req.query.min?.trim() ?? false;
                req.body.format = req.query.format?.trim() ?? null;
                const response = await genFont(req, res, state);
                if (response.code == 200) {
                    const urls = response.location.map(font => `url('${font}') format('woff2')`).join(",\n");
                    return res.type("text/css").send(`@font-face {
  font-family: '${response.name}';
  src: ${urls};
  font-weight: ${req.params.weight || "normal"};
  font-display: swap;
}
`);
                } else res.status(response.code).send(response);
            }
        } catch (error) {
            console.error("字體請求錯誤: ", error.stack);
            res.status(500).send({ status: "failed", message: error.message });
        }
    });

    app.post("/css/:font", async (req, res) => {
        res.status(405).send("You can only use GET method to request CSS font");
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
                SELECT id, name, weights, authors, name_zh, name_en,category, tags, family,demo_content_id
                FROM font_family
                ${whereClause} ORDER BY id
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
                family: row.family,
                sid: row.demo_content_id
            }));

            return res.send(fonts);
        } catch (err) {
            console.error("讀取字體列表失敗", err.stack);
            res.status(500).send("Database query failed");
        }
    });
    //取得展示用句子和他的 ID
    app.get("/lorem", async (req, res) => {
        try {
            const id_to_content_result = await db.query(`
                SELECT sid, content
                FROM demo_sentence;
                `);

            const sidToContent = {};
            for (const row of id_to_content_result.rows) {
                sidToContent[row.sid] = row.content;
            }
            res.send(sidToContent);
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    app.get("/info/:fontID", async (req, res) => {
        const fontID = req.params.fontID;
        try {
            const redisKey = `fontinfo:${fontID}`;
            const cached = await redis.get(redisKey);
            if (cached) {
                return res.send(JSON.parse(cached));
            }
            const { rows } = await db.query(
                `
                SELECT id, name, name_zh, name_en, weights, category, tags, family,
                       version, license, repo_url AS source, authors, description,format,demo_content_id
                FROM font_family
                WHERE id = $1
            `,
                [fontID]
            );
            if (rows.length === 0) return res.status(404).send({ status: "failed", message: "Font not found" });
            const font = rows[0];
            const response = {
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
                description: font.description,
                format: font.format,
                sid: font.demo_content_id
            };
            await redis.set(redisKey, JSON.stringify(response), "EX", 3600);
            res.send(response);
        } catch (err) {
            console.error("讀取字體資訊失敗", err.stack);
            res.status(500).send("Database query failed");
        }
    });
};

export { registerApi, generateSitemap };
