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

### Search
- **`search_recipes`**: Keyword-based recipe search with filtering
- **`semantic_search_recipes`**: AI-powered semantic search using natural language

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
- Create ingredient (`ingredients.create`)
- Update ingredient (`ingredients.update`) 
- Delete ingredient (`ingredients.delete`)

### Recipes
- Create recipe (`recipes.create`)
- Update recipe (`recipes.update`)
- Delete recipe (`recipes.delete`)

## Implementation Guide

To add write operations:

1. **Add tool definition** in the `ListToolsRequestSchema` handler
2. **Add case handler** in the `CallToolRequestSchema` handler  
3. **Use the existing API methods** from `FirebaseFunctionsAPI` class
4. **Handle errors appropriately** and return structured responses

Example structure for adding a create ingredient tool:

```typescript
// In ListToolsRequestSchema handler
{
  name: 'create_ingredient',
  description: 'Create a new ingredient',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Ingredient name' },
      aliases: { type: 'array', items: { type: 'string' } },
      categories: { type: 'array', items: { type: 'string' } },
      allergens: { type: 'array', items: { type: 'string' } },
    },
    required: ['name'],
  },
}

// In CallToolRequestSchema handler
case 'create_ingredient': {
  const { name, aliases, categories, allergens } = args;
  const result = await this.api.createIngredient({
    name, 
    aliases: aliases || [],
    categories: categories || [],
    allergens: allergens || []
  });
  return {
    content: [{
      type: 'text',
      text: `Created ingredient: ${result.name} (${result.id})`
    }]
  };
}
```

### Available API Methods for Write Operations

The `FirebaseFunctionsAPI` class provides these methods for write operations:

**Ingredients:**
- `createIngredient(request)` → `/ingredientsCreate`
- `updateIngredient(id, request)` → `/ingredientsUpdate/{id}`
- `deleteIngredient(id)` → `/ingredientsDelete/{id}`

**Recipes:**
- `createRecipe(request)` → `/recipesCreate`
- `updateRecipe(id, request)` → `/recipesUpdate/{id}` 
- `deleteRecipe(id)` → `/recipesDelete/{id}`

## Usage Examples

Once the MCP server is running, these tools can be called through MCP-compatible clients like Claude Desktop or other MCP implementations.

Example tool calls:
- `get_ingredient` with `{"id": "ingredient-123"}`
- `list_recipes` with `{"limit": "10", "offset": "0"}`  
- `search_recipes` with `{"query": "chocolate cake", "tags": ["dessert"]}`
- `semantic_search_recipes` with `{"query": "healthy dinner with chicken", "topK": 5}`