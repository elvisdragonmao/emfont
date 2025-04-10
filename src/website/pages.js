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

    app.get("/", async (req, res) => {
        return renderSite(res, { page: "home" });
    });

    app.get("/fonts", async (req, res) => {
        let page = "font";
        return renderSite(res, { page, title: "字體 | emfont" });
    });

    app.get("/fonts/:font", async (req, res) => {
        let page = "font";
        if (req.params.font === "") page = "fonts";
        if (false)
            // 字體不存在
            return renderSite(res, { page: "notFound" }, 404);
        return renderSite(res, { page, title: "字體 | emfont" });
    });

    app.get("/login", async (req, res) => {
        return renderSite(res, { page: "login", title: "登入 | emfont" });
    });

    app.get("/about", async (req, res) => {
        return renderSite(res, { page: "about", title: "關於 | emfont" });
    });

    app.get("/dashboard", async (req, res) => {
        const user = req.cookies.token;
        if (!user) return res.redirect("/login");
        return renderSite(res, { page: "dashboard", title: "儀表板 | emfont" });
    });

    app.setNotFoundHandler((req, res) => {
        return renderSite(res, { page: "notFound", title: "找不到頁面 | emfont" }, 404);
    });

    app.get("/logout", (req, res) => {
        res.clearCookie("token");
        res.redirect("/");
    });
};
