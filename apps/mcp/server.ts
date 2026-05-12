import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import fastify from "fastify";
import { Sessions, streamableHttp } from "fastify-mcp";
import registerEmfontTools from "./tools.js";

const app = fastify();

app.register(streamableHttp, {
    stateful: true,
    mcpEndpoint: "/mcp",
    createServer: () => {
        const mcpServer = new McpServer({
            name: "stateful-streamable-http-server",
            version: "0.0.1",
        });

        // register shared emfont tools
        registerEmfontTools(mcpServer);

        return mcpServer.server;
    },
    sessions: new Sessions<StreamableHTTPServerTransport>(),
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen({
    port: port,
    host: "0.0.0.0",
})
    .then(() => {
        console.log(`Server is running on http://0.0.0.0:${port}/mcp`);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
