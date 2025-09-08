#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { GoogleAuthClient } from "./lib/auth";
import { FirebaseFunctionsAPI } from "./api";
import { GroupId } from "./types";

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

  // Register tools using the new API
  server.tool(
    "get_ingredient",
    "Get a single ingredient by ID",
    {
      id: z.string().describe("The ID of the ingredient to retrieve"),
    },
    async ({ id }) => {
      const api = await initializeAPI();
      const result = await api.getIngredient(id);
      return {
        content: [
          {
            type: "text",
            text:
              `Ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}\n` +
              `Created: ${new Date(
                result.createdAt.seconds * 1000
              ).toISOString()}\n` +
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    }
  );

  server.tool(
    "list_ingredients",
    "List all ingredients for the group with optional pagination",
    {
      limit: z
        .string()
        .optional()
        .describe("Number of ingredients to return (default: 50)"),
      offset: z
        .string()
        .optional()
        .describe("Number of ingredients to skip for pagination (default: 0)"),
    },
    async ({ limit, offset }) => {
      const api = await initializeAPI();
      const result = await api.listIngredients({ limit, offset });
      const ingredientsList = result.ingredients
        .map(
          (ing) =>
            `- ${ing.name} (${ing.id}) - Categories: ${
              ing.categories.join(", ") || "None"
            }`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${result.ingredients.length} ingredients:\n\n${ingredientsList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_recipe",
    "Get a single recipe by ID",
    {
      id: z.string().describe("The ID of the recipe to retrieve"),
    },
    async ({ id }) => {
      const api = await initializeAPI();
      const result = await api.getRecipe(id);
      const ingredientsList = result.ingredients
        .map((ing) => {
          const quantityText =
            ing.unit === "free_text"
              ? ing.quantityText
              : `${ing.quantity || ""} ${ing.unit}`;
          return `- ${quantityText} (Ingredient ID: ${ing.ingredientId})${
            ing.note ? ` - ${ing.note}` : ""
          }`;
        })
        .join("\n");
      const stepsList = result.steps
        .map(
          (step, i) =>
            `${i + 1}. ${step.text}${
              step.equipment ? ` (Equipment: ${step.equipment.join(", ")})` : ""
            }`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Source URL: ${result.sourceUrl || "None"}\n` +
              `Image URL: ${result.imageUrl || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${new Date(
                result.createdAt.seconds * 1000
              ).toISOString()}\n` +
              `Updated: ${new Date(
                result.updatedAt.seconds * 1000
              ).toISOString()}\n` +
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    }
  );

  server.tool(
    "list_recipes",
    "List all recipes for the group with optional pagination",
    {
      limit: z
        .string()
        .optional()
        .describe("Number of recipes to return (default: 20)"),
      offset: z
        .string()
        .optional()
        .describe("Number of recipes to skip for pagination (default: 0)"),
    },
    async ({ limit, offset }) => {
      const api = await initializeAPI();
      const result = await api.listRecipes({ limit, offset });
      const recipesList = result.recipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Found ${result.recipes.length} recipes:\n\n${recipesList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    }
  );

  server.tool(
    "search_recipes",
    "Search recipes using keyword-based search with optional filtering",
    {
      query: z
        .string()
        .describe("Search terms to look for in recipe names and descriptions"),
      ingredients: z
        .array(z.string())
        .optional()
        .describe("Optional array of ingredient IDs to filter by"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional array of tags to filter by"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional array of categories to filter by"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results (1-50, default: 20)"),
    },
    async ({ query, ingredients, tags, categories, limit }) => {
      const api = await initializeAPI();
      const result = await api.searchRecipes({
        query,
        ingredients,
        tags,
        categories,
        limit,
      });
      const recipesList = result.recipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.description.substring(
              0,
              100
            )}...`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text:
              `Search results for "${result.query}":\n` +
              `Total found: ${result.totalFound}\n\n${recipesList}`,
          },
        ],
      };
    }
  );

  server.tool(
    "semantic_search_recipes",
    "Search recipes using AI-powered semantic search based on natural language queries",
    {
      query: z
        .string()
        .describe(
          'Natural language search query (e.g., "healthy dinner with chicken")'
        ),
      topK: z
        .number()
        .optional()
        .describe("Maximum number of results to return (1-50, default: 8)"),
    },
    async ({ query, topK }) => {
      const api = await initializeAPI();
      const result = await api.semanticSearchRecipes({ query, topK });
      const recipesList = result.recipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.description.substring(
              0,
              100
            )}...`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Semantic search results for "${result.query}" (top ${result.topK}):\n\n${recipesList}`,
          },
        ],
      };
    }
  );

  return server;
};

// Express app setup
const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = getServer();
  try {
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

app.get("/mcp", async (req, res) => {
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
