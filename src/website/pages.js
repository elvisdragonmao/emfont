import { readFileSync } from "fs";
import { db } from "../utils/database.js";
import { metricsPlugin } from "../utils/metrics.js";
import { logger } from "../utils/logger.js";
import {
	createTranslator,
	defaultLocale,
	getLocaleMessages,
	normalizeLocale,
} from "../i18n/index.js";
//prometheus
// Read the HTML file in the same directory

export default async app => {
	const template = readFileSync(`${import.meta.dirname}/website.html`, "utf8");
	const defaultT = createTranslator(defaultLocale);

	const metaMap = {
		title: defaultT("meta.homeTitle"),
		description: defaultT("meta.description"),
		page: "home",
	};

	const getRequestLocale = req => {
		const queryLocale = req.query?.lang;
		const cookieLocale = req.cookies?.emfont_locale;
		const acceptedLocale = req.headers["accept-language"]?.split(",")[0];
		return normalizeLocale(queryLocale || cookieLocale || acceptedLocale);
	};

	const renderSite = (req, res, data, status = 200) => {
		const locale = getRequestLocale(req);
		const t = createTranslator(locale);
		const finalMeta = {
			...metaMap,
			title: t("meta.homeTitle"),
			description: t("meta.description"),
			...data,
		};
		const html = template.replace(/{{([^{}]+)}}/g, (_, key) => {
			if (key.startsWith("t:")) return t(key.slice(2));
			if (key === "locale") return locale;
			return finalMeta[key] || "";
		});
		res.setCookie("emfont_locale", locale, {
			path: "/",
			sameSite: "lax",
			maxAge: 60 * 60 * 24 * 365,
		});
		res.type("text/html").status(status).send(html);
	};

	app.get("/assets/locales/:locale.json", async (req, res) => {
		try {
			return res.send(getLocaleMessages(req.params.locale));
		} catch {
			return res.status(404).send(getLocaleMessages(defaultLocale));
		}
	});

	app.get("/", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		return renderSite(req, res, {
			page: "home",
			title: t("meta.homeTitle"),
			description: t("meta.description"),
		});
	});

	app.get("/fonts", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		let page = "font";
		return renderSite(req, res, { page, title: t("meta.fontsTitle") });
	});

	app.get("/fonts/:font", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		if (req.params.font === "") {
			return renderSite(req, res, {
				page: "fonts",
				title: t("meta.fontsTitle"),
			});
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
					`${req.params.font} is not available record in database. 
					It might be user try to access a font that is not in database, or the font record is not inserted into database successfully. Check if the font record is inserted into database successfully and check if user try to access a font that is not in database.`,
				);
				return renderSite(
					req,
					res,
					{ page: "notFound", title: t("meta.fontNotFoundTitle") },
					404,
				);
			}
			const font = rows[0];
			logger.debug(`Font ${font.name} accessed, id: ${font.id}`);
			return renderSite(req, res, {
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

	await app.register(metricsPlugin);

	app.get("/login", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		return renderSite(req, res, { page: "login", title: t("meta.loginTitle") });
	});

	app.get("/about", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		return renderSite(req, res, { page: "about", title: t("meta.aboutTitle") });
	});

	app.get("/dashboard", async (req, res) => {
		const t = createTranslator(getRequestLocale(req));
		const user = req.cookies.token;
		if (!user) return res.redirect("/login");
		return renderSite(req, res, {
			page: "dashboard",
			title: t("meta.dashboardTitle"),
		});
	});

	// render status.html in public folder
	app.get("/status", async (req, res) => {
		return res.sendFile("status.html");
	});

	app.setNotFoundHandler((req, res) => {
		const t = createTranslator(getRequestLocale(req));
		return renderSite(
			req,
			res,
			{ page: "notFound", title: t("meta.pageNotFoundTitle") },
			404,
		);
	});

	app.get("/logout", (req, res) => {
		res.clearCookie("token");
		res.redirect("/");
	});
};
