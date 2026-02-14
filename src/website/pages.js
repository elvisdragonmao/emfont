import { readFileSync } from "fs";
import { db } from "../utils/database.js";
import metricsPlugin from "fastify-metrics";
import { logger } from "../utils/logger.js";
//prometheus
// Read the HTML file in the same directory

export default async (app) => {
  const template = readFileSync(`${import.meta.dirname}/website.html`, "utf8");

  const metaMap = {
    title: "emfont - 免費中文字體 Webfont 服務",
    description: "免費中文字體 Webfont 服務",
    page: "home",
  };

  const renderSite = (res, data, status = 200) => {
    const finalMeta = { ...metaMap, ...data };
    const html = template.replace(/{{([^{}]+)}}/g, (_, key) => {
      return finalMeta[key] || "";
    });
    res.type("text/html").status(status).send(html);
  };

  app.get("/", async (req, res) => {
    return renderSite(res, { page: "home" });
  });

  app.get("/fonts", async (req, res) => {
    let page = "font";
    return renderSite(res, { page, title: "字體 - emfont" });
  });

  app.get("/fonts/:font", async (req, res) => {
    if (req.params.font === "") {
      return renderSite(res, { page: "fonts", title: "字體 - emfont" });
    }
    try {
      const { rows } = await db.query(
        `
                SELECT id, name, name_zh, name_en, weights, category, tags, family,
                       version, license, repo_url AS source, authors, description
                FROM font_family
                WHERE id = $1
            `,
        [req.params.font],
      );
      if (rows.length === 0) {
        //user try to access a font that is not in database, log a warning and render notFound page
        logger.warn(
          `${req.params.font} is not available record in database. It might be user try to access a font that is not in database, or the font record is not inserted into database successfully. Check if the font record is inserted into database successfully and check if user try to access a font that is not in database.`,
        );
        return renderSite(
          res,
          { page: "notFound", title: "找不到字體 - emfont" },
          404,
        );
      }
      const font = rows[0];
      logger.debug(`Font ${font.name} accessed, id: ${font.id}`);
      return renderSite(res, {
        page: "font",
        title: font.name + " - emfont",
        description: font.description,
      });
    } catch (err) {
      logger.error(
        `Database query failed when accessing font ${req.params.font}: ${err.message}`,
      );
      res.status(500).send("Database query failed");
    }
  });

  //prometheus route
  await app.register(metricsPlugin, { endpoint: "/metrics" });

  app.get("/login", async (req, res) => {
    return renderSite(res, { page: "login", title: "登入 - emfont" });
  });

  app.get("/about", async (req, res) => {
    return renderSite(res, { page: "about", title: "關於 - emfont" });
  });

  app.get("/dashboard", async (req, res) => {
    const user = req.cookies.token;
    if (!user) return res.redirect("/login");
    return renderSite(res, { page: "dashboard", title: "儀表板 - emfont" });
  });

  // render status.html in public folder
  app.get("/status", async (req, res) => {
    return res.sendFile("status.html");
  });

  app.setNotFoundHandler((req, res) => {
    return renderSite(
      res,
      { page: "notFound", title: "找不到頁面 - emfont" },
      404,
    );
  });

  app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/");
  });
};
