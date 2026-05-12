import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import registerEmfontTools from "./tools.js";

// Create server instance
const server = new McpServer({
    name: "emfont",
    version: "1.0.0",
});

// Register shared emfont tools
registerEmfontTools(server);

// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("emfont MCP Server running on stdio");
}

main().catch(error => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
