# MCP Tools for Recipe Functions

This project includes MCP (Model Context Protocol) tools that provide read-only access to the Firebase Functions recipe API. These tools are designed for workshop participants to understand and potentially extend.

## Available Read Tools

The following MCP tools are provided for read operations:

### Ingredients
- **`get_ingredient`**: Get a single ingredient by ID
- **`list_ingredients`**: List all ingredients with optional pagination

### Recipes
- **`get_recipe`**: Get a single recipe by ID
- **`list_recipes`**: List all recipes with optional pagination
- **`search_recipes`**: Keyword-based recipe search with filtering

### Suggestions
- **`list_suggestions`**: List suggestions with optional pagination and status filtering

## Running the MCP Server

1. **Development mode** (with TypeScript):
   ```bash
   npm run mcp
   ```

2. **Production mode** (compiled JavaScript):
   ```bash
   npm run mcp:build
   ```

## Environment Variables

The MCP server requires the same environment variables as the main service:

```bash
FUNCTION_BASE_URL=https://your-functions-url.com
GROUP_ID=your-group-id
GCP_SA_JSON='{"type":"service_account",...}'
```

## Extending with Write Operations

The following write operations are left as exercises for workshop participants:

### Ingredients
- Create ingredient
- Update ingredient
- Delete ingredient
- Duplicate ingredient

### Recipes
- Create recipe
- Update recipe
- Delete recipe
- Duplicate recipe

### Suggestions
- Create suggestion
- Update suggestion
- Delete suggestion
- Vote on suggestion
- Duplicate suggestion

## Implementation Guide

To add write operations, edit `src/mcp-tools.ts`:

1. **Use the `createMCPTool` helper** from `src/lib/mcp-tool-helper.ts`
2. **Define your tool schema** using Zod for type-safe parameter validation
3. **Use the existing API methods** from `FirebaseFunctionsAPI` class
4. **Handle errors appropriately** and return structured responses

Example structure for adding a create ingredient tool:

```typescript
import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";

createMCPTool({
  name: "create_ingredient",
  description: "Create a new ingredient",
  schema: z.object({
    name: z.string().describe("Ingredient name"),
    aliases: z.array(z.string()).optional().describe("Alternate names"),
    categories: z.array(z.string()).optional().describe("Categories"),
    allergens: z.array(z.string()).optional().describe("Allergen tags"),
  }),
  handler: async ({ name, aliases, categories, allergens }) => {
    const result = await api.createIngredient({
      name,
      aliases: aliases || [],
      categories: categories || [],
      allergens: allergens || [],
    });
    return {
      content: [
        {
          type: "text" as const,
          text: `Created ingredient: ${result.name} (${result.id})`,
        },
      ],
    };
  },
}),
```

### Available API Methods for Write Operations

The `FirebaseFunctionsAPI` class in `src/api.ts` provides these methods:

**Ingredients:**
- `createIngredient(request)` - Create new ingredient
- `updateIngredient(id, request)` - Update existing ingredient
- `deleteIngredient(id)` - Delete ingredient
- `duplicateIngredient(id, request?)` - Duplicate ingredient with optional overrides

**Recipes:**
- `createRecipe(request)` - Create new recipe
- `updateRecipe(id, request)` - Update existing recipe
- `deleteRecipe(id)` - Delete recipe
- `duplicateRecipe(id, request?)` - Duplicate recipe with optional overrides

**Suggestions:**
- `createSuggestion(request)` - Create new suggestion
- `updateSuggestion(id, request)` - Update existing suggestion
- `deleteSuggestion(id)` - Delete suggestion
- `voteSuggestion(id)` - Vote on suggestion (toggle)
- `duplicateSuggestion(id, request?)` - Duplicate suggestion with optional overrides

All methods use POST requests to Firebase Functions endpoints. See `src/apiTypes.ts` for complete request/response type definitions.

## Usage Examples

Once the MCP server is running, these tools can be called through MCP-compatible clients like Claude Desktop or other MCP implementations.

Example tool calls:
- `get_ingredient` with `{"id": "ingredient-123"}`
- `list_ingredients` with `{"limit": 50, "offset": 0}`
- `list_recipes` with `{"limit": 20, "offset": 0}`
- `search_recipes` with `{"query": "chocolate cake", "tags": ["dessert"]}`
- `list_suggestions` with `{"status": "submitted", "limit": 10}`