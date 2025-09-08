import { GoogleAuthClient } from "./lib/auth";
import { FirebaseFunctionsAPI } from "./api";
import { GroupId } from "./types";
import pRetry from "p-retry";
import { spawn } from "child_process";

import dotenv from "dotenv";
dotenv.config();

interface Config {
  functionBaseUrl: string;
  groupId: GroupId;
  gcpServiceAccountJson: string;
}

function getConfig(): Config {
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

  return config as Config;
}

async function performStartupHealthCheck(api: FirebaseFunctionsAPI): Promise<void> {
  try {
    console.log("🔍 Performing startup health check...");
    const recipes = await api.listRecipes({ limit: 1 });
    console.log(`✅ Health check passed - API is responsive (found ${recipes.recipes.length} recipes)`);
  } catch (error) {
    console.error("❌ Startup health check failed:", error);
    throw error;
  }
}

function startMCPServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting MCP server...");
    
    const mcpProcess = spawn("node", ["dist/mcp-server.js"], {
      stdio: "inherit",
      env: process.env
    });

    mcpProcess.on("spawn", () => {
      console.log("✅ MCP server started successfully");
      resolve();
    });

    mcpProcess.on("error", (error) => {
      console.error("❌ Failed to start MCP server:", error);
      reject(error);
    });

    mcpProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`❌ MCP server exited with code ${code}`);
        reject(new Error(`MCP server exited with code ${code}`));
      }
    });

    // Handle shutdown
    process.on("SIGINT", () => {
      console.log("🔄 Shutting down MCP server...");
      mcpProcess.kill("SIGINT");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("🔄 Shutting down MCP server...");
      mcpProcess.kill("SIGTERM");
      process.exit(0);
    });
  });
}

async function main(): Promise<void> {
  try {
    console.log("🚀 Starting recipes service...");

    const config = getConfig();

    const authClient = new GoogleAuthClient({
      gcpServiceAccountJson: config.gcpServiceAccountJson,
      functionBaseUrl: config.functionBaseUrl,
    });

    const api = new FirebaseFunctionsAPI(
      authClient.getClient(),
      config.groupId
    );

    console.log(`🔗 Connected to: ${config.functionBaseUrl}`);
    console.log(`👥 Group ID: ${config.groupId}`);

    // Perform startup health check with retry
    await pRetry(
      async () => {
        await performStartupHealthCheck(api);
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 2000,
        maxTimeout: 10000,
        onFailedAttempt: (error) => {
          console.log(
            `⏳ Health check attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
          );
        },
      }
    );

    // Start MCP server
    await startMCPServer();

  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Unhandled error:", error);
    process.exit(1);
  });
}
