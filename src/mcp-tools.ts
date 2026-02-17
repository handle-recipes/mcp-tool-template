import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

// Reusable zod schemas
const unitEnum = z.enum([
  "g", "kg", "ml", "l", "oz", "lb",
  "tsp", "tbsp", "fl oz", "cup",
  "pint", "quart", "gallon", "piece", "free_text",
]);

const recipeIngredientSchema = z.object({
  ingredientId: z.string().describe("ID of the ingredient"),
  quantity: z
    .number()
    .optional()
    .describe("Numeric quantity (omit for free_text unit)"),
  unit: unitEnum.describe("Unit of measurement, or 'free_text' for freeform amounts"),
  quantityText: z
    .string()
    .optional()
    .describe("Text quantity when unit is 'free_text', e.g. 'a pinch'"),
  note: z
    .string()
    .optional()
    .describe("Optional note, e.g. 'finely chopped'"),
});

const recipeStepSchema = z.object({
  text: z.string().describe("Instruction text for this step"),
  equipment: z
    .array(z.string())
    .optional()
    .describe("Optional equipment needed for this step"),
});

const nutritionalInfoSchema = z.object({
  calories: z.number().optional().describe("Calories in kcal per 100g"),
  protein: z.number().optional().describe("Protein in grams per 100g"),
  carbohydrates: z.number().optional().describe("Carbohydrates in grams per 100g"),
  fat: z.number().optional().describe("Fat in grams per 100g"),
  fiber: z.number().optional().describe("Fiber in grams per 100g"),
});

const unitConversionSchema = z.object({
  from: unitEnum.describe("Source unit"),
  to: unitEnum.describe("Target unit (typically 'g' for nutritional calculations)"),
  factor: z.number().describe("Conversion factor (from * factor = to)"),
});

const suggestionCategoryEnum = z.enum(["feature", "bug", "improvement", "other"]);
const suggestionPriorityEnum = z.enum(["low", "medium", "high"]);
const suggestionStatusEnum = z.enum(["submitted", "under-review", "accepted", "rejected", "implemented"]);

// Helper to format ingredient response text
function formatIngredientText(ingredient: any): string {
  return (
    `Ingredient: ${ingredient.name}\n` +
    `ID: ${ingredient.id}\n` +
    `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
    `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
    `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
    `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
    `Created: ${ingredient.createdAt}\n` +
    `Updated: ${ingredient.updatedAt}\n` +
    `Created by Group: ${ingredient.createdByGroupId}`
  );
}

// Helper to format recipe response text
function formatRecipeText(recipe: any): string {
  const ingredientsList = recipe.ingredients
    .map((ing: any) => {
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
      (step: any, i: number) =>
        `${i + 1}. ${step.text}${
          step.equipment ? ` (Equipment: ${step.equipment.join(", ")})` : ""
        }`
    )
    .join("\n");

  return (
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
    `Created by Group: ${recipe.createdByGroupId}`
  );
}

// Helper to format suggestion response text
function formatSuggestionText(suggestion: any): string {
  return (
    `Suggestion: ${suggestion.title}\n` +
    `ID: ${suggestion.id}\n` +
    `Status: ${suggestion.status}\n` +
    `Category: ${suggestion.category}\n` +
    `Priority: ${suggestion.priority}\n` +
    `Votes: ${suggestion.votes}\n` +
    `Description: ${suggestion.description}\n` +
    `Related Recipe ID: ${suggestion.relatedRecipeId || "None"}\n` +
    `Created: ${suggestion.createdAt}\n` +
    `Updated: ${suggestion.updatedAt}`
  );
}

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
        content: [{ type: "text" as const, text: formatIngredientText(ingredient) }],
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
      name: z.string().describe("Primary name of the ingredient"),
      aliases: z.array(z.string()).optional().describe("Alternate names or spellings"),
      categories: z.array(z.string()).optional().describe("Categories, e.g. ['dairy', 'protein']"),
      allergens: z.array(z.string()).optional().describe("Allergen tags, e.g. ['nuts', 'gluten']"),
      nutrition: nutritionalInfoSchema.optional().describe("Nutritional values per 100g"),
      supportedUnits: z.array(unitEnum).optional().describe("Units this ingredient supports"),
      unitConversions: z.array(unitConversionSchema).optional().describe("Unit conversion factors"),
    }),
    handler: async ({ name, aliases, categories, allergens, nutrition, supportedUnits, unitConversions }) => {
      const ingredient = await api.createIngredient({
        name, aliases, categories, allergens, nutrition, supportedUnits, unitConversions,
      });
      return {
        content: [{ type: "text" as const, text: `Ingredient created successfully!\n${formatIngredientText(ingredient)}` }],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient. Provide only the fields you want to change. Use addAliases/removeAliases (and similar) for incremental array updates, or provide the full array to replace it entirely.",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to update"),
      name: z.string().optional().describe("New name"),
      aliases: z.array(z.string()).optional().describe("Replace all aliases"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      allergens: z.array(z.string()).optional().describe("Replace all allergens"),
      nutrition: nutritionalInfoSchema.optional().describe("Replace nutritional info"),
      supportedUnits: z.array(unitEnum).optional().describe("Replace supported units"),
      unitConversions: z.array(unitConversionSchema).optional().describe("Replace unit conversions"),
      addAliases: z.array(z.string()).optional().describe("Add aliases without replacing existing ones"),
      removeAliases: z.array(z.string()).optional().describe("Remove specific aliases"),
      addCategories: z.array(z.string()).optional().describe("Add categories"),
      removeCategories: z.array(z.string()).optional().describe("Remove specific categories"),
      addAllergens: z.array(z.string()).optional().describe("Add allergens"),
      removeAllergens: z.array(z.string()).optional().describe("Remove specific allergens"),
      addSupportedUnits: z.array(unitEnum).optional().describe("Add supported units"),
      removeSupportedUnits: z.array(unitEnum).optional().describe("Remove supported units"),
    }),
    handler: async ({ id, ...updates }) => {
      const ingredient = await api.updateIngredient(id, { id, ...updates });
      return {
        content: [{ type: "text" as const, text: `Ingredient updated successfully!\n${formatIngredientText(ingredient)}` }],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete an ingredient by ID",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to delete"),
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
    description: "Duplicate an existing ingredient, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to duplicate"),
      name: z.string().optional().describe("Override name for the duplicate"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
      nutrition: nutritionalInfoSchema.optional().describe("Override nutritional info"),
      supportedUnits: z.array(unitEnum).optional().describe("Override supported units"),
      unitConversions: z.array(unitConversionSchema).optional().describe("Override unit conversions"),
    }),
    handler: async ({ id, ...overrides }) => {
      const ingredient = await api.duplicateIngredient(id, overrides);
      return {
        content: [{ type: "text" as const, text: `Ingredient duplicated successfully!\n${formatIngredientText(ingredient)}` }],
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
      return {
        content: [{ type: "text" as const, text: formatRecipeText(recipe) }],
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
    description:
      "Create a new recipe with ingredients and steps. Each ingredient needs an ingredientId (use list_ingredients to find IDs) and a unit. For standard units set quantity (number) and unit. For freeform amounts like 'a pinch', set unit to 'free_text' and use quantityText instead.",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings"),
      ingredients: z.array(recipeIngredientSchema).describe("List of ingredients for the recipe"),
      steps: z.array(recipeStepSchema).describe("Ordered list of recipe steps"),
      tags: z.array(z.string()).optional().describe("Optional tags, e.g. ['vegan', 'spicy']"),
      categories: z.array(z.string()).optional().describe("Optional categories, e.g. ['dessert', 'norwegian']"),
      sourceUrl: z.string().optional().describe("Optional source URL for attribution"),
    }),
    handler: async ({ name, description, servings, ingredients, steps, tags, categories, sourceUrl }) => {
      const recipe = await api.createRecipe({
        name, description, servings, ingredients, steps, tags, categories, sourceUrl,
      });
      return {
        content: [{ type: "text" as const, text: `Recipe created successfully!\n${formatRecipeText(recipe)}` }],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description:
      "Update an existing recipe. Provide only the fields you want to change. Use addTags/removeTags, addCategories/removeCategories, addIngredients/removeIngredientIds, addSteps/removeStepIndexes for incremental updates, or provide the full array to replace entirely.",
    schema: z.object({
      id: z.string().describe("ID of the recipe to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New servings count"),
      ingredients: z.array(recipeIngredientSchema).optional().describe("Replace all ingredients"),
      steps: z.array(recipeStepSchema).optional().describe("Replace all steps"),
      tags: z.array(z.string()).optional().describe("Replace all tags"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
      addTags: z.array(z.string()).optional().describe("Add tags without replacing existing ones"),
      removeTags: z.array(z.string()).optional().describe("Remove specific tags"),
      addCategories: z.array(z.string()).optional().describe("Add categories"),
      removeCategories: z.array(z.string()).optional().describe("Remove specific categories"),
      addIngredients: z.array(recipeIngredientSchema).optional().describe("Add ingredients to the recipe"),
      removeIngredientIds: z.array(z.string()).optional().describe("Remove ingredients by their ingredientId"),
      addSteps: z.array(recipeStepSchema).optional().describe("Add steps to the recipe"),
      removeStepIndexes: z.array(z.number()).optional().describe("Remove steps by index (0-based)"),
    }),
    handler: async ({ id, ...updates }) => {
      const recipe = await api.updateRecipe(id, { id, ...updates });
      return {
        content: [{ type: "text" as const, text: `Recipe updated successfully!\n${formatRecipeText(recipe)}` }],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete a recipe by ID",
    schema: z.object({
      id: z.string().describe("ID of the recipe to delete"),
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
    description: "Duplicate an existing recipe, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("ID of the recipe to duplicate"),
      name: z.string().optional().describe("Override name for the duplicate"),
      description: z.string().optional().describe("Override description"),
      servings: z.number().optional().describe("Override servings"),
      ingredients: z.array(recipeIngredientSchema).optional().describe("Override ingredients"),
      steps: z.array(recipeStepSchema).optional().describe("Override steps"),
      tags: z.array(z.string()).optional().describe("Override tags"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      sourceUrl: z.string().optional().describe("Override source URL"),
    }),
    handler: async ({ id, ...overrides }) => {
      const recipe = await api.duplicateRecipe(id, overrides);
      return {
        content: [{ type: "text" as const, text: `Recipe duplicated successfully!\n${formatRecipeText(recipe)}` }],
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
      status: suggestionStatusEnum
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
    description: "Create a new suggestion for recipe improvements or features",
    schema: z.object({
      title: z.string().describe("Title of the suggestion"),
      description: z.string().describe("Detailed description"),
      category: suggestionCategoryEnum.optional().describe("Category: feature, bug, improvement, or other"),
      priority: suggestionPriorityEnum.optional().describe("Priority: low, medium, or high"),
      relatedRecipeId: z.string().optional().describe("ID of a related recipe, if applicable"),
    }),
    handler: async ({ title, description, category, priority, relatedRecipeId }) => {
      const suggestion = await api.createSuggestion({
        title, description, category, priority, relatedRecipeId,
      });
      return {
        content: [{ type: "text" as const, text: `Suggestion created successfully!\n${formatSuggestionText(suggestion)}` }],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Toggle your vote on a suggestion. Voting again removes your vote.",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      const action = result.voted ? "added" : "removed";
      return {
        content: [{ type: "text" as const, text: `Vote ${action} for suggestion "${result.title}" (${result.id}). Total votes: ${result.votes}` }],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion. Provide only the fields you want to change.",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      category: suggestionCategoryEnum.optional().describe("New category"),
      priority: suggestionPriorityEnum.optional().describe("New priority"),
      relatedRecipeId: z.string().optional().describe("New related recipe ID"),
      status: suggestionStatusEnum.optional().describe("New status"),
    }),
    handler: async ({ id, ...updates }) => {
      const suggestion = await api.updateSuggestion(id, { id, ...updates });
      return {
        content: [{ type: "text" as const, text: `Suggestion updated successfully!\n${formatSuggestionText(suggestion)}` }],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion by ID",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to delete"),
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
    description: "Duplicate an existing suggestion, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to duplicate"),
      title: z.string().optional().describe("Override title"),
      description: z.string().optional().describe("Override description"),
      category: suggestionCategoryEnum.optional().describe("Override category"),
      priority: suggestionPriorityEnum.optional().describe("Override priority"),
      relatedRecipeId: z.string().optional().describe("Override related recipe ID"),
    }),
    handler: async ({ id, ...overrides }) => {
      const suggestion = await api.duplicateSuggestion(id, overrides);
      return {
        content: [{ type: "text" as const, text: `Suggestion duplicated successfully!\n${formatSuggestionText(suggestion)}` }],
      };
    },
  }),
];
