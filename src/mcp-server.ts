#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { GoogleAuthClient } from "./lib/auth";
import { FirebaseFunctionsAPI } from "./api";
import { GroupId } from "./types";
import { registerTools } from "./lib/mcp-tool-helper";
import { createRecipeTools } from "./mcp-tools";

interface MCPConfig {
  functionBaseUrl: string;
  groupId: GroupId;
  gcpServiceAccountJson: string;
}

function getConfig(): MCPConfig {
  const config = {
    functionBaseUrl: process.env.FUNCTION_BASE_URL,
    groupId: process.env.GROUP_ID,
    gcpServiceAccountJson: process.env.GCP_SA_JSON,
  };

  if (!config.functionBaseUrl) {
    throw new Error("FUNCTION_BASE_URL environment variable is required");
  }
  if (!config.groupId) {
    throw new Error("GROUP_ID environment variable is required");
  }
  if (!config.gcpServiceAccountJson) {
    throw new Error("GCP_SA_JSON environment variable is required");
  }

  return config as MCPConfig;
}

const getServer = () => {
  // Create an MCP server
  const server = new McpServer(
    {
      name: "recipes-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize API lazily
  let api: FirebaseFunctionsAPI | null = null;

  const initializeAPI = async () => {
    if (api) return api;

    const config = getConfig();
    const authClient = new GoogleAuthClient({
      gcpServiceAccountJson: config.gcpServiceAccountJson,
      functionBaseUrl: config.functionBaseUrl,
    });
    api = new FirebaseFunctionsAPI(authClient.getClient(), config.groupId);
    return api;
  };

  // Register tools using the helper
  const setupTools = async () => {
    const apiInstance = await initializeAPI();
    const tools = createRecipeTools(apiInstance);
    registerTools(server, tools);
  };

  // Initialize tools on first request
  let toolsInitialized = false;
  const ensureToolsInitialized = async () => {
    if (!toolsInitialized) {
      await setupTools();
      toolsInitialized = true;
    }
  };

  return { server, ensureToolsInitialized };
};

// Express app setup
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { server, ensureToolsInitialized } = getServer();
  try {
    // Ensure tools are initialized before handling the request
    await ensureToolsInitialized();
    
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      console.log("Request closed");
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (_req, res) => {
  console.log("Received GET MCP request");
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed.",
      },
      id: null,
    })
  );
});

// Start the server
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, (error?: Error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`Recipe MCP server running on http://localhost:${PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  process.exit(0);
});
