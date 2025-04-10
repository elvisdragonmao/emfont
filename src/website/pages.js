import { readFileSync } from "fs";
// Read the HTML file in the same directory

export default async app => {
    const template = readFileSync(`${import.meta.dirname}/website.html`, "utf8");

    const metaMap = {
        title: "emfont - 免費中文字體 Webfont 服務",
        description: "免費中文字體 Webfont 服務",
        page: "home"
    };

    const renderSite = (res, data, status = 200) => {
        const finalMeta = { ...metaMap, ...data };
        const html = template.replace(/{{([^{}]+)}}/g, (_, key) => {
            return finalMeta[key] || "";
        });
        res.type("text/html").status(status).send(html);
    };

    app.get("/", async (req, reply) => {
        return renderSite(reply, { page: "home", title: "首頁" });
    });

    app.get("/fonts/:font", async (req, reply) => {
        let page = "font";
        if (req.params.font === "") page = "fonts";
        if (false)
            // 字體不存在
            return renderSite(reply, { page: "notFound" }, 404);
        return reply.view("/src/website.ejs", { user, page });
    });

    app.get("/login", async (req, reply) => {
        return renderSite(reply, { page: "login" });
    });

    app.get("/about", async (req, reply) => {
        return renderSite(reply, { page: "about" });
    });

    app.get("/dashboard", async (req, reply) => {
        const user = req.cookies.token;
        if (!user) return reply.redirect("/login");
        return renderSite(reply, { page: "dashboard" });
    });

    app.setNotFoundHandler((req, reply) => {
        return renderSite(reply, { page: "notFound" });
    });

    app.get("/logout", (req, reply) => {
        reply.clearCookie("token");
        reply.redirect("/");
    });
};
