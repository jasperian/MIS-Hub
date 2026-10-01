import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MisClient } from "../mcp/client";
import { createMisServer } from "../mcp/server";

async function main() {
  const allowWrites = process.env.MIS_MCP_ALLOW_WRITES === "true";
  const client = new MisClient({
    url: process.env.MIS_MCP_URL || "http://127.0.0.1:3000",
    session: process.env.MIS_MCP_SESSION,
    email: process.env.MIS_MCP_EMAIL,
    password: process.env.MIS_MCP_PASSWORD,
    allowWrites,
  });
  await createMisServer(client, allowWrites).connect(new StdioServerTransport());
}
main().catch(() => {
  console.error("MIS MCP could not start. Check the connection URL and configuration.");
  process.exitCode = 1;
});
