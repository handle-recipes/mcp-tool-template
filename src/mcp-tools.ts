import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

// ---------------------------------------------------------------------------
// Shared Zod sub-schemas (reused across multiple tools)
// ---------------------------------------------------------------------------

const unitEnum = z.enum([
  "g", "kg", "ml", "l", "oz", "lb",
  "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon",
  "piece", "free_text",
]);

const recipeIngredientSchema = z.object({
  ingredientId: z.string().describe("The ID of the ingredient"),
  unit: unitEnum.describe(
    'Unit for the quantity. Use "free_text" for amounts like "a pinch" or "to taste"'
  ),
  quantity: z
    .number()
    .optional()
    .describe('Numeric quantity (omit when unit is "free_text")'),
  quantityText: z
    .string()
    .optional()
    .describe(
      'Free-text quantity, only used when unit is "free_text" (e.g., "a pinch", "to taste")'
    ),
  note: z
    .string()
    .optional()
    .describe('Optional preparation note (e.g., "finely chopped")'),
});

const recipeStepSchema = z.object({
  text: z.string().describe("The instruction text for this step"),
  equipment: z
    .array(z.string())
    .optional()
    .describe("Optional list of equipment needed for this step"),
});

const nutritionalInfoSchema = z.object({
  calories: z.number().optional().describe("Calories in kcal per 100g"),
  protein: z.number().optional().describe("Protein in grams per 100g"),
  carbohydrates: z
    .number()
    .optional()
    .describe("Carbohydrates in grams per 100g"),
  fat: z.number().optional().describe("Fat in grams per 100g"),
  fiber: z.number().optional().describe("Fiber in grams per 100g"),
});

const unitConversionSchema = z.object({
  from: unitEnum.describe("Source unit"),
  to: unitEnum.describe("Target unit (typically 'g' for nutritional calculations)"),
  factor: z
    .number()
    .describe("Conversion factor (from * factor = to). E.g., 1 cup flour = 120g → factor: 120"),
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  // ----------------------
  // Ingredient tools
  // ----------------------

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
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("Primary name of the ingredient (e.g., 'egg')"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names, spellings, or translations"),
      categories: z
        .array(z.string())
        .optional()
        .describe('Free-text categories (e.g., ["dairy", "protein"])'),
      allergens: z
        .array(z.string())
        .optional()
        .describe('Allergen tags (e.g., ["nuts", "gluten"])'),
      nutrition: nutritionalInfoSchema
        .optional()
        .describe("Nutritional values per 100g"),
      metadata: z
        .record(z.string())
        .optional()
        .describe('Additional metadata (e.g., { "saturatedFat": "2.5" })'),
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Units supported for this ingredient"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Unit conversion factors for this ingredient"),
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
              `Ingredient created successfully!\n` +
              `ID: ${ingredient.id}\n` +
              `Name: ${ingredient.name}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description:
      "Update an existing ingredient. Use full array replacement fields (aliases, categories, etc.) OR their addX/removeX counterparts — not both for the same field.",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("New primary name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Replace the entire aliases list"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace the entire categories list"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Replace the entire allergens list"),
      nutrition: nutritionalInfoSchema
        .optional()
        .describe("Replace nutritional values per 100g"),
      metadata: z
        .record(z.string())
        .optional()
        .describe("Replace additional metadata"),
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Replace the entire supportedUnits list"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Replace the entire unitConversions list"),
      addAliases: z
        .array(z.string())
        .optional()
        .describe("Aliases to add (cannot be used with aliases)"),
      removeAliases: z
        .array(z.string())
        .optional()
        .describe("Aliases to remove (cannot be used with aliases)"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Categories to add (cannot be used with categories)"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Categories to remove (cannot be used with categories)"),
      addAllergens: z
        .array(z.string())
        .optional()
        .describe("Allergens to add (cannot be used with allergens)"),
      removeAllergens: z
        .array(z.string())
        .optional()
        .describe("Allergens to remove (cannot be used with allergens)"),
      addSupportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Units to add (cannot be used with supportedUnits)"),
      removeSupportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Units to remove (cannot be used with supportedUnits)"),
    }),
    handler: async ({ id, ...fields }) => {
      const ingredient = await api.updateIngredient(id, { ...fields, id });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient updated successfully!\n` +
              `ID: ${ingredient.id}\n` +
              `Name: ${ingredient.name}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Updated: ${ingredient.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete (archive) an ingredient by ID",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteIngredient(id);
      return {
        content: [{ type: "text" as const, text: result.message }],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_ingredient",
    description:
      "Duplicate an existing ingredient, optionally overriding fields in the copy",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z.string().optional().describe("Name for the duplicate (defaults to original name)"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
      nutrition: nutritionalInfoSchema.optional().describe("Override nutrition"),
      metadata: z.record(z.string()).optional().describe("Override metadata"),
      supportedUnits: z.array(unitEnum).optional().describe("Override supported units"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Override unit conversions"),
    }),
    handler: async ({ id, ...overrides }) => {
      const ingredient = await api.duplicateIngredient(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient duplicated successfully!\n` +
              `New ID: ${ingredient.id}\n` +
              `Name: ${ingredient.name}\n` +
              `Variant of: ${ingredient.variantOf || id}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe tools
  // ----------------------

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
    name: "create_recipe",
    description: "Create a new recipe with ingredients and steps",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("A description of the recipe"),
      servings: z.number().describe("Number of servings the recipe makes"),
      ingredients: z
        .array(recipeIngredientSchema)
        .describe("List of ingredients with quantities"),
      steps: z
        .array(recipeStepSchema)
        .describe("Ordered list of preparation steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe('Optional tags (e.g., ["vegan", "spicy"])'),
      categories: z
        .array(z.string())
        .optional()
        .describe('Optional categories (e.g., ["dessert", "norwegian"])'),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional URL of the original recipe source"),
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
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recipe created successfully!\n` +
              `ID: ${recipe.id}\n` +
              `Name: ${recipe.name}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Ingredients: ${recipe.ingredients.length}\n` +
              `Steps: ${recipe.steps.length}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description:
      "Update an existing recipe. Use full array replacement fields (ingredients, steps, tags, categories) OR their addX/removeX counterparts — not both for the same field.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("New recipe name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New serving count"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Replace the entire ingredients list"),
      steps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Replace the entire steps list"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Replace the entire tags list"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace the entire categories list"),
      sourceUrl: z.string().optional().describe("New source URL"),
      addTags: z
        .array(z.string())
        .optional()
        .describe("Tags to add (cannot be used with tags)"),
      removeTags: z
        .array(z.string())
        .optional()
        .describe("Tags to remove (cannot be used with tags)"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Categories to add (cannot be used with categories)"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Categories to remove (cannot be used with categories)"),
      addIngredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Ingredients to add (cannot be used with ingredients)"),
      removeIngredientIds: z
        .array(z.string())
        .optional()
        .describe("Ingredient IDs to remove (cannot be used with ingredients)"),
      addSteps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Steps to append (cannot be used with steps)"),
      removeStepIndexes: z
        .array(z.number())
        .optional()
        .describe("0-based step indexes to remove (cannot be used with steps)"),
    }),
    handler: async ({ id, ...fields }) => {
      const recipe = await api.updateRecipe(id, { ...fields, id });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recipe updated successfully!\n` +
              `ID: ${recipe.id}\n` +
              `Name: ${recipe.name}\n` +
              `Servings: ${recipe.servings}\n` +
              `Ingredients: ${recipe.ingredients.length}\n` +
              `Steps: ${recipe.steps.length}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Updated: ${recipe.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete (archive) a recipe by ID",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteRecipe(id);
      return {
        content: [{ type: "text" as const, text: result.message }],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description:
      "Duplicate an existing recipe, optionally overriding fields in the copy",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z.string().optional().describe("Name for the duplicate (defaults to original name)"),
      description: z.string().optional().describe("Override description"),
      servings: z.number().optional().describe("Override serving count"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Override ingredients list"),
      steps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Override steps list"),
      tags: z.array(z.string()).optional().describe("Override tags"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      sourceUrl: z.string().optional().describe("Override source URL"),
    }),
    handler: async ({ id, ...overrides }) => {
      const recipe = await api.duplicateRecipe(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recipe duplicated successfully!\n` +
              `New ID: ${recipe.id}\n` +
              `Name: ${recipe.name}\n` +
              `Slug: ${recipe.slug}\n` +
              `Variant of: ${recipe.variantOf || id}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion tools
  // ----------------------

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
    name: "create_suggestion",
    description: "Create a new suggestion (feature request, bug report, or improvement idea)",
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
        .describe("Optional ID of a recipe this suggestion relates to"),
    }),
    handler: async ({ title, description, category, priority, relatedRecipeId }) => {
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
              `Suggestion created successfully!\n` +
              `ID: ${suggestion.id}\n` +
              `Title: ${suggestion.title}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description:
      "Toggle a vote on a suggestion. Voting again removes the vote.",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Vote ${result.voted ? "added" : "removed"}!\n` +
              `Suggestion: ${result.title}\n` +
              `Total votes: ${result.votes}`,
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
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("New priority level"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("New related recipe ID"),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("New status"),
    }),
    handler: async ({ id, ...fields }) => {
      const suggestion = await api.updateSuggestion(id, { ...fields, id });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion updated successfully!\n` +
              `ID: ${suggestion.id}\n` +
              `Title: ${suggestion.title}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete (archive) a suggestion by ID",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteSuggestion(id);
      return {
        content: [{ type: "text" as const, text: result.message }],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description:
      "Duplicate an existing suggestion, optionally overriding fields in the copy",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().optional().describe("Title for the duplicate"),
      description: z.string().optional().describe("Override description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Override category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Override priority"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Override related recipe ID"),
    }),
    handler: async ({ id, ...overrides }) => {
      const suggestion = await api.duplicateSuggestion(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion duplicated successfully!\n` +
              `New ID: ${suggestion.id}\n` +
              `Title: ${suggestion.title}\n` +
              `Variant of: ${suggestion.variantOf || id}`,
          },
        ],
      };
    },
  }),
];
