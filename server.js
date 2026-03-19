import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";
import express from "express";

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || "5432"),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const app = express();

const tools = [
  {
    name: "query",
    description: "Execute a SELECT SQL query",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL SELECT query" }
      },
      required: ["sql"]
    }
  },
  {
    name: "execute",
    description: "Execute INSERT, UPDATE, DELETE or any SQL statement",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL statement to execute" },
        params: { type: "array", description: "Optional query parameters", items: {} }
      },
      required: ["sql"]
    }
  }
];

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/sse", async (req, res) => {
  const server = new Server(
    { name: "postgres-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === "query" || name === "execute") {
        const result = await pool.query(args.sql, args.params || []);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              rows: result.rows,
              rowCount: result.rowCount,
              fields: result.fields?.map(f => ({ name: f.name, type: f.dataTypeID }))
            }, null, 2)
          }]
        };
      }
      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  });

  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  res.status(200).json({});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`PostgreSQL MCP server running on HTTP port ${PORT}`);
  console.log(`Connected to: ${process.env.PG_HOST}:${process.env.PG_PORT}/${process.env.PG_DATABASE}`);
});
