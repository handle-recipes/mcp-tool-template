import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withErrorHandling } from "./mcp-error-handler";

export interface MCPToolConfig<T extends z.ZodRawShape> {
  name: string;
  description: string;
  schema: z.ZodObject<T>;
  handler: (params: z.infer<z.ZodObject<T>>) => Promise<{
    content: Array<{
      type: "text";
      text: string;
    }>;
  }>;
}

export function createMCPTool<T extends z.ZodRawShape>(
  config: MCPToolConfig<T>
): MCPToolConfig<T> {
  // Wrap the handler with error handling
  return {
    ...config,
    handler: withErrorHandling(config.handler),
  };
}

export function registerTools(
  server: McpServer,
  tools: MCPToolConfig<any>[]
): void {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.handler);
  }
}