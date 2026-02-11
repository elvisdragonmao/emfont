// website
import Fastify from "fastify";
import cors from "@fastify/cors";
import { loggerStorage, setBaseLogger } from "./utils/logger.js"; // font
import { initCheck } from "./bootstrap/init.js";
import dotenv from "dotenv";

// routes
import registerPages from "./website/pages.js";
import { registerApi } from "./website/api.js";
import registerStatic, { generateEmfontJS } from "./website/static.js";

dotenv.config();
const state = {
	alive: false,
	bulletin: process.env.BULLETIN || "",
	local: true,
	r2: false,
}; //預設很保守，預設都是關閉，會在init過程中打開
const port = process.env.PORT ?? 3000;
state.baseURL = process.env.BASE_URL ?? `http://localhost:${port}`;
if (process.env.MINIO_redirect == "true")
	state.static_font_base = state.baseURL + "/file/_generated";
else state.static_font_base = "_generated";
state.REGEN_STATIC = process.env.REGEN_STATIC === "true";
state.REGEN_CSS = process.env.REGEN_CSS === "true";
state.R2_PUB_URL_BASE = process.env.R2_PUB_URL_BASE ?? "";
state.FONT_CHECK = process.env.FONT_CHECK === "true";

// 設定 logger 格式，根據不同的環境使用不同的設定
// setting logger format, use different setting for different environment
function getLoggerConfig() {
	const envToLogger = {
		development: {
			transport: {
				target: "pino-pretty",
				options: {
					translateTime: "SYS:yyyy-mm-dd HH:MM:ss Z",
					ignore: "pid,hostname",
					colorize: true,
				},
			},
		},
		production: true, // Fastify default pino
		test: false, // disable logging
	};

	return envToLogger[process.env.NODE_ENV] ?? true;
}
const app = Fastify({
	disableRequestLogging: true,
	logger: getLoggerConfig(),
});

setBaseLogger(app.log);

app.register(cors, {
	origin: "*",
	methods: ["GET", "POST"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
});

await registerPages(app);
await registerApi(app, state);
await registerStatic(app);

// Start server
const start = async () => {
	try {
		app.listen({ port: port, host: "0.0.0.0" });
	} catch (err) {
		app.log.error(err);
		process.exit(1);
	}
};

start();

//init
app.ready().then(async () => {
	await initCheck(state, app.log);
	await generateEmfontJS(state);

	if (state.alive) {
		app.log.info("🎉 initialize success. emfont is up!");
	} else {
		app.log.fatal("🤨 initialize failed. But web page is still running");
		if (!state.bulletin)
			state.bulletin += "<br>😭emfont 啟動失敗，暫時無法使用。<br>";
	}
});
app.addHook("onRequest", (request, _reply, done) => {
	loggerStorage.run(request.log, done);
});
