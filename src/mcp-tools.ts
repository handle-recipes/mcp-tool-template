import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

// Reusable schema definitions
const unitEnum = z.enum([
  "g",
  "kg",
  "ml",
  "l",
  "oz",
  "lb",
  "tsp",
  "tbsp",
  "fl oz",
  "cup",
  "pint",
  "quart",
  "gallon",
  "piece",
  "free_text",
]);

const recipeIngredientSchema = z.object({
  ingredientId: z
    .string()
    .describe("ID of the ingredient (must exist in the system)"),
  quantity: z
    .number()
    .optional()
    .describe("Numeric quantity (use with standard units like g, ml, cup, etc.)"),
  unit: unitEnum.describe(
    "Unit of measurement. Use 'free_text' for non-standard quantities like 'a pinch' or 'to taste'"
  ),
  quantityText: z
    .string()
    .optional()
    .describe(
      "Text description of quantity (only used when unit is 'free_text'), e.g., 'a pinch', 'to taste'"
    ),
  note: z
    .string()
    .optional()
    .describe("Additional note, e.g., 'finely chopped', 'room temperature'"),
});

const recipeStepSchema = z.object({
  text: z.string().describe("Instruction text for this step"),
  imageUrl: z.string().optional().describe("Optional URL to an image for this step"),
  equipment: z
    .array(z.string())
    .optional()
    .describe("Optional list of equipment needed for this step"),
});

const nutritionalInfoSchema = z
  .object({
    calories: z.number().optional().describe("Calories in kcal per 100g"),
    protein: z.number().optional().describe("Protein in grams per 100g"),
    carbohydrates: z.number().optional().describe("Carbohydrates in grams per 100g"),
    fat: z.number().optional().describe("Fat in grams per 100g"),
    fiber: z.number().optional().describe("Fiber in grams per 100g"),
  })
  .optional();

const unitConversionSchema = z.object({
  from: unitEnum.describe("Source unit"),
  to: unitEnum.describe("Target unit (typically 'g' for nutritional calculations)"),
  factor: z.number().describe("Conversion factor (from * factor = to)"),
});

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  createMCPTool({
    name: "get_ingredient",
    description: "Get a single ingredient by ID",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to retrieve"),
    }),
    handler: async ({ id }) => {
      const ingredient = await api.getIngredient(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}\n` +
              `Updated: ${ingredient.updatedAt}\n` +
              `Created by Group: ${ingredient.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "list_ingredients",
    description: "List all ingredients for the group with optional pagination",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of ingredients to return (default: 50)"),
      offset: z
        .number()
        .optional()
        .describe("Number of ingredients to skip for pagination (default: 0)"),
    }),
    handler: async ({ limit, offset }) => {
      const result = await api.listIngredients({ limit, offset });
      const ingredientsList = result.ingredients
        .map(
          (ing) =>
            `- ${ing.name} (${ing.id}) - Categories: ${
              ing.categories?.join(", ") || "None"
            }`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${result.ingredients.length} ingredients:\n\n${ingredientsList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "get_recipe",
    description: "Get a single recipe by ID",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to retrieve"),
    }),
    handler: async ({ id }) => {
      const recipe = await api.getRecipe(id);
      const ingredientsList = recipe.ingredients
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
      const stepsList = recipe.steps
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
            type: "text" as const,
            text:
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Source URL: ${recipe.sourceUrl || "None"}\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${recipe.createdAt}\n` +
              `Updated: ${recipe.updatedAt}\n` +
              `Created by Group: ${recipe.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "list_recipes",
    description: "List all recipes for the group with optional pagination",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of recipes to return (default: 20)"),
      offset: z
        .number()
        .optional()
        .describe("Number of recipes to skip for pagination (default: 0)"),
    }),
    handler: async ({ limit, offset }) => {
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
            type: "text" as const,
            text:
              `Found ${result.recipes.length} recipes:\n\n${recipesList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "search_recipes",
    description:
      "Search recipes using keyword-based search with optional filtering",
    schema: z.object({
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
    }),
    handler: async ({ query, ingredients, tags, categories, limit }) => {
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
            type: "text" as const,
            text:
              `Search results for "${result.query}":\n` +
              `Total found: ${result.totalFound}\n\n${recipesList}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "list_suggestions",
    description: "List suggestions with optional pagination and status filtering",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of suggestions to return (default: 20)"),
      offset: z
        .number()
        .optional()
        .describe("Number of suggestions to skip for pagination (default: 0)"),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("Filter by suggestion status"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (suggestion) =>
            `- [${suggestion.status.toUpperCase()}] ${suggestion.title} (${suggestion.id})\n` +
            `  Category: ${suggestion.category} | Priority: ${suggestion.priority} | Votes: ${suggestion.votes}\n` +
            `  ${suggestion.description.substring(0, 100)}${suggestion.description.length > 100 ? "..." : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${result.suggestions.length} suggestions${status ? ` with status "${status}"` : ""}:\n\n${suggestionsList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe with ingredients and steps",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .describe("List of ingredients for the recipe"),
      steps: z
        .array(recipeStepSchema)
        .describe("Ordered list of recipe steps/instructions"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags, e.g., ['vegan', 'quick', 'spicy']"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional categories, e.g., ['dessert', 'main course', 'italian']"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional source URL for attribution"),
    }),
    handler: async ({
      name,
      description,
      servings,
      ingredients,
      steps,
      tags,
      categories,
      sourceUrl,
    }) => {
      const recipe = await api.createRecipe({
        name,
        description,
        servings,
        ingredients,
        steps,
        tags,
        categories,
        sourceUrl,
      });

      const ingredientsList = recipe.ingredients
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

      const stepsList = recipe.steps
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
            type: "text" as const,
            text:
              `Recipe created successfully!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Source URL: ${recipe.sourceUrl || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${recipe.createdAt}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Ingredient write operations
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("Primary name of the ingredient, e.g., 'egg'"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names, spellings, or translations"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Free-text categories, e.g., ['dairy', 'protein', 'herb']"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags, e.g., ['nuts', 'gluten', 'milk']"),
      nutrition: nutritionalInfoSchema.describe(
        "Optional nutritional values per 100g"
      ),
      metadata: z
        .record(z.string())
        .optional()
        .describe("Additional metadata key-value pairs"),
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Supported unit types for this ingredient"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Unit conversion rates, e.g., 1 cup flour = 120g"),
    }),
    handler: async ({
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      metadata,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        metadata,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient created successfully!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient. Supports both full replacement and partial array operations.",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("New primary name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Replace all aliases with this array"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace all categories with this array"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Replace all allergens with this array"),
      nutrition: nutritionalInfoSchema.describe("New nutritional values per 100g"),
      metadata: z.record(z.string()).optional().describe("New metadata"),
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Replace supported units"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Replace unit conversions"),
      addAliases: z
        .array(z.string())
        .optional()
        .describe("Add these aliases (cannot use with 'aliases')"),
      removeAliases: z
        .array(z.string())
        .optional()
        .describe("Remove these aliases (cannot use with 'aliases')"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Add these categories (cannot use with 'categories')"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Remove these categories (cannot use with 'categories')"),
      addAllergens: z
        .array(z.string())
        .optional()
        .describe("Add these allergens (cannot use with 'allergens')"),
      removeAllergens: z
        .array(z.string())
        .optional()
        .describe("Remove these allergens (cannot use with 'allergens')"),
      addSupportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Add these units (cannot use with 'supportedUnits')"),
      removeSupportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Remove these units (cannot use with 'supportedUnits')"),
    }),
    handler: async ({ id, ...updates }) => {
      const ingredient = await api.updateIngredient(id, { id, ...updates });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient updated successfully!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
              `Updated: ${ingredient.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete an ingredient by ID (soft delete)",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteIngredient(id);

      return {
        content: [
          {
            type: "text" as const,
            text: `Ingredient deleted: ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_ingredient",
    description:
      "Create a copy of an existing ingredient with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z.string().optional().describe("New name for the duplicate"),
      aliases: z.array(z.string()).optional().describe("New aliases"),
      categories: z.array(z.string()).optional().describe("New categories"),
      allergens: z.array(z.string()).optional().describe("New allergens"),
      nutrition: nutritionalInfoSchema.describe("New nutritional values"),
      metadata: z.record(z.string()).optional().describe("New metadata"),
      supportedUnits: z.array(unitEnum).optional().describe("New supported units"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("New unit conversions"),
    }),
    handler: async ({ id, ...overrides }) => {
      const ingredient = await api.duplicateIngredient(id, overrides);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient duplicated successfully!\n\n` +
              `New Ingredient: ${ingredient.name}\n` +
              `New ID: ${ingredient.id}\n` +
              `Original ID: ${ingredient.variantOf || id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe write operations
  // ----------------------

  createMCPTool({
    name: "update_recipe",
    description:
      "Update an existing recipe. Supports both full replacement and partial array operations.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("New recipe name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Replace all ingredients"),
      steps: z.array(recipeStepSchema).optional().describe("Replace all steps"),
      tags: z.array(z.string()).optional().describe("Replace all tags"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
      addTags: z
        .array(z.string())
        .optional()
        .describe("Add these tags (cannot use with 'tags')"),
      removeTags: z
        .array(z.string())
        .optional()
        .describe("Remove these tags (cannot use with 'tags')"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Add these categories (cannot use with 'categories')"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Remove these categories (cannot use with 'categories')"),
      addIngredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Add these ingredients (cannot use with 'ingredients')"),
      removeIngredientIds: z
        .array(z.string())
        .optional()
        .describe("Remove ingredients by ID (cannot use with 'ingredients')"),
      addSteps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Add these steps (cannot use with 'steps')"),
      removeStepIndexes: z
        .array(z.number())
        .optional()
        .describe("Remove steps by index (cannot use with 'steps')"),
    }),
    handler: async ({ id, ...updates }) => {
      const recipe = await api.updateRecipe(id, { id, ...updates });

      const ingredientsList = recipe.ingredients
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

      const stepsList = recipe.steps
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
            type: "text" as const,
            text:
              `Recipe updated successfully!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Updated: ${recipe.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete a recipe by ID (soft delete)",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteRecipe(id);

      return {
        content: [
          {
            type: "text" as const,
            text: `Recipe deleted: ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description: "Create a copy of an existing recipe with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z.string().optional().describe("New name for the duplicate"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("New ingredients list"),
      steps: z.array(recipeStepSchema).optional().describe("New steps list"),
      tags: z.array(z.string()).optional().describe("New tags"),
      categories: z.array(z.string()).optional().describe("New categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
    }),
    handler: async ({ id, ...overrides }) => {
      const recipe = await api.duplicateRecipe(id, overrides);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recipe duplicated successfully!\n\n` +
              `New Recipe: ${recipe.name}\n` +
              `New ID: ${recipe.id}\n` +
              `New Slug: ${recipe.slug}\n` +
              `Original ID: ${recipe.variantOf || id}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Created: ${recipe.createdAt}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion write operations
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for features, bugs, or improvements",
    schema: z.object({
      title: z.string().describe("Brief title for the suggestion"),
      description: z.string().describe("Detailed description of the suggestion"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of the suggestion (default: 'other')"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level (default: 'medium')"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional ID of a related recipe"),
    }),
    handler: async ({
      title,
      description,
      category,
      priority,
      relatedRecipeId,
    }) => {
      const suggestion = await api.createSuggestion({
        title,
        description,
        category,
        priority,
        relatedRecipeId,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion created successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Description: ${suggestion.description}\n` +
              `Related Recipe: ${suggestion.relatedRecipeId || "None"}\n` +
              `Submitted: ${suggestion.submittedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Toggle vote on a suggestion. Voting again removes your vote.",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const suggestion = await api.voteSuggestion(id);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Vote ${suggestion.voted ? "added" : "removed"}!\n\n` +
              `Suggestion: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Current votes: ${suggestion.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("New category"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      relatedRecipeId: z.string().optional().describe("New related recipe ID"),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("New status"),
    }),
    handler: async ({ id, ...updates }) => {
      const suggestion = await api.updateSuggestion(id, { id, ...updates });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion updated successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}\n` +
              `Description: ${suggestion.description}\n` +
              `Updated: ${suggestion.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion by ID (soft delete)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteSuggestion(id);

      return {
        content: [
          {
            type: "text" as const,
            text: `Suggestion deleted: ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description:
      "Create a copy of an existing suggestion with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().optional().describe("New title for the duplicate"),
      description: z.string().optional().describe("New description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("New category"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      relatedRecipeId: z.string().optional().describe("New related recipe ID"),
    }),
    handler: async ({ id, ...overrides }) => {
      const suggestion = await api.duplicateSuggestion(id, overrides);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion duplicated successfully!\n\n` +
              `New Title: ${suggestion.title}\n` +
              `New ID: ${suggestion.id}\n` +
              `Original ID: ${suggestion.variantOf || id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Created: ${suggestion.createdAt}`,
          },
        ],
      };
    },
  }),
];
