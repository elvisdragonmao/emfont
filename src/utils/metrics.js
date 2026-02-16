import * as client from "prom-client";
// reference: https://github.com/siimon/prom-client
export async function metricsPlugin(app) {
	client.collectDefaultMetrics();

	const httpRequestDuration = new client.Histogram({
		name: "http_server_request_duration_seconds",
		help: "HTTP request duration in seconds",
		labelNames: ["method", "route", "status_code"],
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	});

	// 記起始時間
	app.addHook("onRequest", async request => {
		request._startAt = process.hrtime.bigint();
	});

	// 回應完成時計算耗時
	app.addHook("onResponse", async (request, reply) => {
		const start = request._startAt;
		if (!start) return;

		const diffNs = process.hrtime.bigint() - start;
		const seconds = Number(diffNs) / 1e9;

		const route = request.routeOptions?.url ?? "unknown_route"; // Fastify route pattern :contentReference[oaicite:2]{index=2}
		httpRequestDuration
			.labels(request.method, route, String(reply.statusCode))
			.observe(seconds);
	});

	app.get("/metrics", async (_req, reply) => {
		reply
			.header("Content-Type", client.register.contentType)
			.send(await client.register.metrics());
	});
}
