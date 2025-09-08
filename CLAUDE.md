# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Development Commands:**
- `npm run dev` - Run main service with ts-node (src/index.ts)
- `npm run build` - Compile TypeScript to dist/
- `npm start` - Run compiled service (dist/index.js)

**MCP Server Commands:**
- `npm run mcp` - Run MCP server in development mode (ts-node)
- `npm run mcp:build` - Build and run MCP server in production mode
- `npm run mcp:dev` - Alias for `npm run mcp`

**Setup/Deployment:**
- `npm run setup` - Run setup script (scripts/setup.sh - may not exist)
- `npm run deploy` - Run deployment script (scripts/deploy.sh - may not exist)

## Architecture Overview

This is a **dual-mode Node.js TypeScript service** that operates both as a standalone recipe service and as an MCP (Model Context Protocol) server:

### Core Architecture

1. **Standalone Service Mode** (`src/index.ts`):
   - Performs health checks against Firebase Functions
   - Spawns and manages the MCP server as a child process
   - Handles service lifecycle and graceful shutdown

2. **MCP Server Mode** (`src/mcp-server.ts`):
   - Express HTTP server that handles MCP protocol requests
   - Provides read-only MCP tools for recipe/ingredient management
   - Runs on port 3000 by default, responds to POST /mcp

### Key Components

**Authentication Layer** (`src/lib/auth.ts`):
- `GoogleAuthClient` handles Google service account authentication
- Automatically injects ID tokens into outbound requests
- Uses google-auth-library JWT for token management

**API Client** (`src/api.ts`):
- `FirebaseFunctionsAPI` class provides typed interface to Firebase Functions
- Handles all CRUD operations for ingredients and recipes
- Automatically includes x-group-id headers for multi-tenancy

**MCP Tools** (`src/mcp-tools.ts`):
- Defines read-only MCP tools (get_ingredient, list_recipes, search_recipes, etc.)
- Uses helper functions from `src/lib/mcp-tool-helper.ts` for registration
- Extensible architecture for adding write operations

## Environment Configuration

Required environment variables:
- `FUNCTION_BASE_URL` - Base URL for Firebase Functions v2
- `GROUP_ID` - Group identifier for multi-tenant requests
- `GCP_SA_JSON` - Full JSON service account key (as string)

Optional:
- `PORT` - HTTP port for MCP server (default: 3000)

## Key Files for Extension

**For adding MCP write tools:**
- Edit `src/mcp-tools.ts` to add new tool definitions
- Use existing `FirebaseFunctionsAPI` methods (createRecipe, updateIngredient, etc.)
- Follow the pattern in MCP_TOOLS.md for implementation

**For API modifications:**
- Core API methods are in `src/api.ts`
- Type definitions in `src/types.ts` and `src/apiTypes.ts`
- Authentication logic in `src/lib/auth.ts`

## Development Notes

- The service performs startup health checks before becoming ready
- MCP server tools are lazy-loaded on first request
- Both services share the same environment configuration
- Firebase Functions API uses POST requests exclusively (not REST-style)
- All requests require IAM authentication + x-group-id header