# MCP Tools for Recipe Functions

This project includes MCP (Model Context Protocol) tools that provide complete CRUD access to the Firebase Functions recipe API.

## All Available Tools (21 Total)

### Ingredient Tools (6 tools)
- **`create_ingredient`**: Create a new ingredient with nutritional info
- **`get_ingredient`**: Get a single ingredient by ID
- **`list_ingredients`**: List all ingredients with optional pagination
- **`update_ingredient`**: Update an existing ingredient (supports partial updates and array operations)
- **`delete_ingredient`**: Delete (archive) an ingredient
- **`duplicate_ingredient`**: Duplicate an existing ingredient with optional modifications

### Recipe Tools (7 tools)
- **`create_recipe`**: Create a new recipe with ingredients and steps
- **`get_recipe`**: Get a single recipe by ID with full details
- **`list_recipes`**: List all recipes with optional pagination
- **`search_recipes`**: Keyword-based recipe search with filtering
- **`update_recipe`**: Update an existing recipe (supports partial updates and array operations)
- **`delete_recipe`**: Delete (archive) a recipe
- **`duplicate_recipe`**: Duplicate an existing recipe with optional modifications

### Suggestion Tools (6 tools)
- **`create_suggestion`**: Create a new suggestion for features, bugs, improvements
- **`list_suggestions`**: List suggestions with optional pagination and status filtering
- **`update_suggestion`**: Update an existing suggestion
- **`vote_suggestion`**: Vote for a suggestion (or remove your vote)
- **`delete_suggestion`**: Delete (archive) a suggestion
- **`duplicate_suggestion`**: Duplicate an existing suggestion with optional modifications

---

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

---

## Detailed Tool Documentation

### Ingredient Tools

#### `create_ingredient`
Create a new ingredient with nutritional information and metadata.

**Parameters:**
- `name` (required) - Ingredient name
- `aliases` (optional) - Alternate names
- `categories` (optional) - Categories (e.g., 'dairy', 'protein')
- `allergens` (optional) - Allergen tags (e.g., 'nuts', 'gluten')
- `supportedUnits` (optional) - Supported measurement units
- `nutrition` (optional) - Nutritional info per 100g (calories, protein, carbs, fat, fiber)
- `metadata` (optional) - Additional metadata key-value pairs

**Example:**
```json
{
  "name": "Tomato",
  "categories": ["vegetable"],
  "allergens": [],
  "nutrition": {
    "calories": 18,
    "protein": 0.9,
    "carbohydrates": 3.9,
    "fat": 0.2,
    "fiber": 1.2
  }
}
```

#### `update_ingredient`
Update an existing ingredient. Supports both full replacement and incremental array operations.

**Parameters:**
- `id` (required) - ID of ingredient to update
- `name` (optional) - New name
- `aliases` (optional) - Replace all aliases
- `categories` (optional) - Replace all categories
- `allergens` (optional) - Replace all allergens
- `supportedUnits` (optional) - Replace all supported units
- `nutrition` (optional) - Update nutritional information
- `metadata` (optional) - Replace metadata
- **Array operations** (cannot use alongside full replacement):
  - `addAliases` - Add aliases to existing list
  - `removeAliases` - Remove specific aliases
  - `addCategories` - Add categories to existing list
  - `removeCategories` - Remove specific categories
  - `addAllergens` - Add allergens to existing list
  - `removeAllergens` - Remove specific allergens

**Example (full replacement):**
```json
{
  "id": "tomato",
  "categories": ["vegetable", "fruit"]
}
```

**Example (incremental update):**
```json
{
  "id": "tomato",
  "addCategories": ["fruit"],
  "removeAllergens": ["nightshade"]
}
```

#### `delete_ingredient`
Delete (archive) an ingredient.

**Parameters:**
- `id` (required) - ID of ingredient to delete

#### `duplicate_ingredient`
Duplicate an existing ingredient with optional modifications.

**Parameters:**
- `id` (required) - ID of ingredient to duplicate
- All other parameters from `create_ingredient` as optional overrides

#### `get_ingredient`
Get a single ingredient by ID.

**Parameters:**
- `id` (required) - ID of ingredient to retrieve

#### `list_ingredients`
List all ingredients with optional pagination.

**Parameters:**
- `limit` (optional) - Number of ingredients to return (default: 50)
- `offset` (optional) - Number of ingredients to skip (default: 0)

---

### Recipe Tools

#### `create_recipe`
Create a new recipe with ingredients and steps.

**Parameters:**
- `name` (required) - Recipe name
- `description` (required) - Recipe description
- `servings` (required) - Number of servings
- `ingredients` (required) - Array of recipe ingredients:
  - `ingredientId` - ID of the ingredient
  - `quantity` - Quantity (omit if using free text)
  - `unit` - Unit of measurement (see Supported Units below)
  - `quantityText` - Free text quantity (only when unit is "free_text")
  - `note` - Additional note (e.g., 'finely chopped')
- `steps` (required) - Array of recipe steps:
  - `text` - Step instruction text
  - `imageUrl` (optional) - Optional image URL
  - `equipment` (optional) - Optional equipment array
- `tags` (optional) - Tags (e.g., 'vegan', 'spicy')
- `categories` (optional) - Categories (e.g., 'dessert', 'italian')
- `sourceUrl` (optional) - Source URL

**Example:**
```json
{
  "name": "Chocolate Chip Cookies",
  "description": "Classic homemade cookies",
  "servings": 24,
  "ingredients": [
    {
      "ingredientId": "flour",
      "quantity": 300,
      "unit": "g"
    },
    {
      "ingredientId": "salt",
      "unit": "free_text",
      "quantityText": "a pinch"
    }
  ],
  "steps": [
    {
      "text": "Preheat oven to 180°C",
      "equipment": ["oven"]
    }
  ],
  "tags": ["dessert", "baking"],
  "categories": ["american"]
}
```

#### `update_recipe`
Update an existing recipe. Supports both full replacement and incremental array operations.

**Parameters:**
- `id` (required) - ID of recipe to update
- `name` (optional) - New name
- `description` (optional) - New description
- `servings` (optional) - New servings count
- `ingredients` (optional) - Replace all ingredients
- `steps` (optional) - Replace all steps
- `tags` (optional) - Replace all tags
- `categories` (optional) - Replace all categories
- `sourceUrl` (optional) - New source URL
- **Array operations** (cannot use alongside full replacement):
  - `addTags` - Add tags to existing list
  - `removeTags` - Remove specific tags
  - `addCategories` - Add categories to existing list
  - `removeCategories` - Remove specific categories

#### `delete_recipe`
Delete (archive) a recipe.

**Parameters:**
- `id` (required) - ID of recipe to delete

#### `duplicate_recipe`
Duplicate an existing recipe with optional modifications.

**Parameters:**
- `id` (required) - ID of recipe to duplicate
- All other parameters from `create_recipe` as optional overrides

#### `get_recipe`
Get a single recipe by ID with full details.

**Parameters:**
- `id` (required) - ID of recipe to retrieve

#### `list_recipes`
List all recipes with optional pagination.

**Parameters:**
- `limit` (optional) - Number of recipes to return (default: 20)
- `offset` (optional) - Number of recipes to skip (default: 0)

#### `search_recipes`
Search recipes using keyword-based search with filtering.

**Parameters:**
- `query` (required) - Search terms for recipe names and descriptions
- `ingredients` (optional) - Array of ingredient IDs to filter by
- `tags` (optional) - Array of tags to filter by
- `categories` (optional) - Array of categories to filter by
- `limit` (optional) - Maximum results (1-50, default: 20)

---

### Suggestion Tools

#### `create_suggestion`
Create a new suggestion for features, bugs, improvements, or other feedback.

**Parameters:**
- `title` (required) - Brief title
- `description` (required) - Detailed description
- `category` (optional) - Category: feature, bug, improvement, other (default: other)
- `priority` (optional) - Priority: low, medium, high (default: medium)
- `relatedRecipeId` (optional) - ID of related recipe

**Example:**
```json
{
  "title": "Add dark mode support",
  "description": "Would be great to have a dark mode option for the recipe viewer",
  "category": "feature",
  "priority": "medium"
}
```

#### `update_suggestion`
Update an existing suggestion.

**Parameters:**
- `id` (required) - ID of suggestion to update
- `title` (optional) - New title
- `description` (optional) - New description
- `category` (optional) - New category
- `priority` (optional) - New priority
- `status` (optional) - New status: submitted, under-review, accepted, rejected, implemented
- `relatedRecipeId` (optional) - New related recipe ID

#### `vote_suggestion`
Vote for a suggestion (or remove your vote if already voted).

**Parameters:**
- `id` (required) - ID of suggestion to vote for

#### `delete_suggestion`
Delete (archive) a suggestion.

**Parameters:**
- `id` (required) - ID of suggestion to delete

#### `duplicate_suggestion`
Duplicate an existing suggestion with optional modifications.

**Parameters:**
- `id` (required) - ID of suggestion to duplicate
- All other parameters from `create_suggestion` as optional overrides

#### `list_suggestions`
List suggestions with optional pagination and status filtering.

**Parameters:**
- `limit` (optional) - Number of suggestions to return (default: 20)
- `offset` (optional) - Number of suggestions to skip (default: 0)
- `status` (optional) - Filter by status: submitted, under-review, accepted, rejected, implemented

---

## Supported Units

All tools that accept unit parameters support the following units:

**Metric:**
- Weight: `g`, `kg`
- Volume: `ml`, `l`

**Imperial/US:**
- Weight: `oz`, `lb`
- Volume: `tsp`, `tbsp`, `fl oz`, `cup`, `pint`, `quart`, `gallon`

**Other:**
- Count: `piece`
- Free text: `free_text` (use with `quantityText` field)

---

## Implementation Details

### Architecture
All MCP tools follow a consistent pattern:

1. **Tool Definition** - Created using `createMCPTool()` helper from `src/lib/mcp-tool-helper.ts`
2. **Schema Validation** - Uses Zod for type-safe parameter validation
3. **API Integration** - Calls methods on `FirebaseFunctionsAPI` class from `src/api.ts`
4. **Response Formatting** - Returns structured text responses in MCP format

### Key Features
- **Soft Deletes**: All delete operations archive data rather than permanently removing it
- **Duplicate Operations**: Create variants with `variantOf` field pointing to the original
- **Partial Updates**: Update operations support both full replacement and incremental changes
- **Auto-Authentication**: Server automatically handles authentication and group ID injection
- **Standardized Units**: Nutritional information is always per 100g

### Error Handling
- Tools return structured error messages when operations fail
- API validation errors are passed through to the client
- Authentication errors are handled by the underlying API client

---

## Usage Examples

Once the MCP server is running, these tools can be called through MCP-compatible clients like Claude Desktop or other MCP implementations.

**Example tool calls:**

```json
// Get an ingredient
{"name": "get_ingredient", "arguments": {"id": "tomato"}}

// List recipes
{"name": "list_recipes", "arguments": {"limit": 20, "offset": 0}}

// Create a recipe
{"name": "create_recipe", "arguments": {
  "name": "Simple Salad",
  "description": "A quick and healthy salad",
  "servings": 2,
  "ingredients": [
    {"ingredientId": "tomato", "quantity": 2, "unit": "piece"},
    {"ingredientId": "lettuce", "quantity": 100, "unit": "g"}
  ],
  "steps": [
    {"text": "Wash and chop vegetables"},
    {"text": "Mix in a bowl and serve"}
  ],
  "tags": ["healthy", "vegetarian"]
}}

// Search recipes
{"name": "search_recipes", "arguments": {
  "query": "chocolate cake",
  "tags": ["dessert"],
  "limit": 10
}}

// Vote on a suggestion
{"name": "vote_suggestion", "arguments": {"id": "suggestion-123"}}
```

---

## File Locations

- **Tool Definitions**: `src/mcp-tools.ts`
- **Tool Helper**: `src/lib/mcp-tool-helper.ts`
- **API Client**: `src/api.ts`
- **Type Definitions**: `src/types.ts`, `src/apiTypes.ts`
- **MCP Server**: `src/mcp-server.ts`
