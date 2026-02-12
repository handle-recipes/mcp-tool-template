#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { GoogleAuthClient } from "./lib/auth";
import { FirebaseFunctionsAPI } from "./api";
import { GroupId } from "./types";
import { registerTools } from "./lib/mcp-tool-helper";
import { createRecipeTools } from "./mcp-tools";

// MCP App constants (inlined to avoid ESM-only @modelcontextprotocol/ext-apps/server import)
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const RESOURCE_URI_META_KEY = "ui/resourceUri";
const RECIPE_VIEWER_URI = "ui://recipe-viewer/recipe-viewer.html";

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
        resources: {},
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

    // Register view_recipe tool with MCP App UI metadata.
    // We use the low-level server.server.setRequestHandler approach is too
    // complex -- instead we register via tool() but split the schema to avoid
    // the "Type instantiation is excessively deep" TS error that occurs when
    // zod generics interact with the overloaded server.tool() signatures.
    const viewRecipeSchema = { id: z.string().describe("The ID of the recipe to view") };
    const viewRecipeHandler = async ({ id }: { id: string }) => {
      const recipe = await apiInstance.getRecipe(id);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(recipe),
          },
        ],
        _meta: {
          ui: {
            resourceUri: RECIPE_VIEWER_URI,
          },
          [RESOURCE_URI_META_KEY]: RECIPE_VIEWER_URI,
        },
      };
    };
    (server as any).tool(
      "view_recipe",
      "View a recipe with a rich interactive UI card. Returns recipe data as JSON for the MCP App to render.",
      viewRecipeSchema,
      viewRecipeHandler
    );
  };

  // Register the recipe viewer HTML resource
  const setupResources = () => {
    server.resource(
      "recipe-viewer",
      RECIPE_VIEWER_URI,
      { description: "Interactive recipe viewer app", mimeType: RESOURCE_MIME_TYPE },
      async () => {
        const htmlPath = path.join(__dirname, "app", "recipe-viewer.html");
        const html = fs.readFileSync(htmlPath, "utf-8");
        return {
          contents: [
            {
              uri: RECIPE_VIEWER_URI,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
            },
          ],
        };
      }
    );
  };

  // Initialize tools on first request
  let toolsInitialized = false;
  const ensureToolsInitialized = async () => {
    if (!toolsInitialized) {
      await setupTools();
      setupResources();
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
