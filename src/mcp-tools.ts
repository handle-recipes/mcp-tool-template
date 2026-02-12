import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import {
  UNIT,
  SUGGESTION_CATEGORY,
  SUGGESTION_PRIORITY,
  SUGGESTION_STATUS,
} from "./types";

const recipeIngredientSchema = z.object({
  ingredientId: z.string().describe("ID of the ingredient"),
  quantity: z.number().optional().describe("Quantity (omit if unit is free_text)"),
  unit: z.enum(UNIT).describe("Unit of measurement"),
  quantityText: z
    .string()
    .optional()
    .describe("Free-text quantity (used when unit is free_text)"),
  note: z.string().optional().describe("Free-form note, e.g. 'finely chopped'"),
});

const recipeStepSchema = z.object({
  text: z.string().describe("Instruction text for this step"),
  imageUrl: z.string().optional().describe("Optional image URL for this step"),
  equipment: z
    .array(z.string())
    .optional()
    .describe("Optional equipment needed for this step"),
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

  // ----------------------
  // Ingredient Write Tools
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("Primary name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names or spellings"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g. 'dairy', 'protein', 'herb')"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g. 'nuts', 'gluten', 'milk')"),
      supportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Supported unit types for this ingredient"),
    }),
    handler: async ({ name, aliases, categories, allergens, supportedUnits }) => {
      const result = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        supportedUnits,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Created ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases?.join(", ") || "None"}\n` +
              `Categories: ${result.categories?.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient by ID",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("New name"),
      aliases: z.array(z.string()).optional().describe("Replace all aliases"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace all categories"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Replace all allergens"),
      supportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Replace all supported units"),
      addAliases: z
        .array(z.string())
        .optional()
        .describe("Add aliases (cannot use with aliases)"),
      removeAliases: z
        .array(z.string())
        .optional()
        .describe("Remove aliases (cannot use with aliases)"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Add categories (cannot use with categories)"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Remove categories (cannot use with categories)"),
      addAllergens: z
        .array(z.string())
        .optional()
        .describe("Add allergens (cannot use with allergens)"),
      removeAllergens: z
        .array(z.string())
        .optional()
        .describe("Remove allergens (cannot use with allergens)"),
      addSupportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Add supported units (cannot use with supportedUnits)"),
      removeSupportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Remove supported units (cannot use with supportedUnits)"),
    }),
    handler: async ({ id, ...updates }) => {
      const result = await api.updateIngredient(id, { id, ...updates });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases?.join(", ") || "None"}\n` +
              `Categories: ${result.categories?.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete an ingredient by ID",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteIngredient(id);
      return {
        content: [
          {
            type: "text" as const,
            text: result.message,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_ingredient",
    description:
      "Duplicate an existing ingredient, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z.string().optional().describe("Override name for the duplicate"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
      supportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Override supported units"),
    }),
    handler: async ({ id, ...overrides }) => {
      const result = await api.duplicateIngredient(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Duplicated ingredient: ${result.name}\n` +
              `New ID: ${result.id}\n` +
              `Categories: ${result.categories?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe Write Tools
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .describe("List of ingredients with quantities"),
      steps: z.array(recipeStepSchema).describe("Ordered list of recipe steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags (e.g. 'vegan', 'spicy')"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g. 'dessert', 'norwegian')"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Source attribution URL"),
    }),
    handler: async (params) => {
      const result = await api.createRecipe(params);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Created recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length}\n` +
              `Steps: ${result.steps.length}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe by ID",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New servings count"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Replace all ingredients"),
      steps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Replace all steps"),
      tags: z.array(z.string()).optional().describe("Replace all tags"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace all categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
      addTags: z
        .array(z.string())
        .optional()
        .describe("Add tags (cannot use with tags)"),
      removeTags: z
        .array(z.string())
        .optional()
        .describe("Remove tags (cannot use with tags)"),
      addCategories: z
        .array(z.string())
        .optional()
        .describe("Add categories (cannot use with categories)"),
      removeCategories: z
        .array(z.string())
        .optional()
        .describe("Remove categories (cannot use with categories)"),
      addIngredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Add ingredients (cannot use with ingredients)"),
      removeIngredientIds: z
        .array(z.string())
        .optional()
        .describe("Remove ingredient IDs (cannot use with ingredients)"),
      addSteps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Add steps (cannot use with steps)"),
      removeStepIndexes: z
        .array(z.number())
        .optional()
        .describe("Remove step indexes (cannot use with steps)"),
    }),
    handler: async ({ id, ...updates }) => {
      const result = await api.updateRecipe(id, { id, ...updates });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length}\n` +
              `Steps: ${result.steps.length}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete a recipe by ID",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteRecipe(id);
      return {
        content: [
          {
            type: "text" as const,
            text: result.message,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description: "Duplicate an existing recipe, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z.string().optional().describe("Override name for the duplicate"),
      description: z
        .string()
        .optional()
        .describe("Override description"),
      servings: z.number().optional().describe("Override servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Override ingredients"),
      steps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Override steps"),
      tags: z.array(z.string()).optional().describe("Override tags"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Override categories"),
      sourceUrl: z.string().optional().describe("Override source URL"),
    }),
    handler: async ({ id, ...overrides }) => {
      const result = await api.duplicateRecipe(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Duplicated recipe: ${result.name}\n` +
              `New ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Servings: ${result.servings}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion Write Tools
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion",
    schema: z.object({
      title: z.string().describe("Brief title for the suggestion"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(SUGGESTION_CATEGORY)
        .optional()
        .describe("Category: feature, bug, improvement, or other"),
      priority: z
        .enum(SUGGESTION_PRIORITY)
        .optional()
        .describe("Priority: low, medium, or high"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional related recipe ID"),
    }),
    handler: async (params) => {
      const result = await api.createSuggestion(params);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Created suggestion: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Category: ${result.category}\n` +
              `Priority: ${result.priority}\n` +
              `Status: ${result.status}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion by ID",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      category: z
        .enum(SUGGESTION_CATEGORY)
        .optional()
        .describe("New category"),
      priority: z
        .enum(SUGGESTION_PRIORITY)
        .optional()
        .describe("New priority"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("New related recipe ID"),
      status: z
        .enum(SUGGESTION_STATUS)
        .optional()
        .describe("New status"),
    }),
    handler: async ({ id, ...updates }) => {
      const result = await api.updateSuggestion(id, { id, ...updates });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated suggestion: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Category: ${result.category}\n` +
              `Priority: ${result.priority}\n` +
              `Status: ${result.status}\n` +
              `Votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion by ID",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text: result.message,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description:
      "Toggle vote on a suggestion (adds vote if not voted, removes if already voted)",
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
              `${result.voted ? "Vote added" : "Vote removed"} for: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Current votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description:
      "Duplicate an existing suggestion, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().optional().describe("Override title for the duplicate"),
      description: z
        .string()
        .optional()
        .describe("Override description"),
      category: z
        .enum(SUGGESTION_CATEGORY)
        .optional()
        .describe("Override category"),
      priority: z
        .enum(SUGGESTION_PRIORITY)
        .optional()
        .describe("Override priority"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Override related recipe ID"),
    }),
    handler: async ({ id, ...overrides }) => {
      const result = await api.duplicateSuggestion(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Duplicated suggestion: ${result.title}\n` +
              `New ID: ${result.id}\n` +
              `Category: ${result.category}\n` +
              `Priority: ${result.priority}\n` +
              `Status: ${result.status}`,
          },
        ],
      };
    },
  }),
];
