import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

// Shared schemas to avoid repetition
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
    .describe("ID of the ingredient (from list_ingredients)"),
  quantity: z
    .number()
    .optional()
    .describe(
      "Numeric quantity (use with standard units like g, ml, piece, etc.)"
    ),
  unit: unitEnum.describe(
    "Unit of measurement. Use 'free_text' for non-standard amounts (then set quantityText instead of quantity)"
  ),
  quantityText: z
    .string()
    .optional()
    .describe(
      "Free-form quantity text, only used when unit is 'free_text' (e.g., 'a pinch', 'to taste')"
    ),
  note: z
    .string()
    .optional()
    .describe("Optional note, e.g., 'finely chopped'"),
});

const recipeStepSchema = z.object({
  text: z.string().describe("Instruction text for this step"),
  equipment: z
    .array(z.string())
    .optional()
    .describe("Optional equipment needed for this step"),
});

const nutritionalInfoSchema = z
  .object({
    calories: z
      .number()
      .optional()
      .describe("Calories in kcal per 100g"),
    protein: z
      .number()
      .optional()
      .describe("Protein in grams per 100g"),
    carbohydrates: z
      .number()
      .optional()
      .describe("Carbohydrates in grams per 100g"),
    fat: z.number().optional().describe("Fat in grams per 100g"),
    fiber: z
      .number()
      .optional()
      .describe("Fiber in grams per 100g"),
  })
  .optional()
  .describe("Nutritional values per 100g of ingredient");

const unitConversionSchema = z.object({
  from: unitEnum.describe("Source unit"),
  to: unitEnum.describe("Target unit (typically 'g' for nutritional calculations)"),
  factor: z.number().describe("Conversion factor (from * factor = to)"),
});

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
      name: z.string().describe("Primary name of the ingredient, e.g., 'egg'"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names, spellings, or languages"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories, e.g., ['dairy', 'protein']"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags, e.g., ['nuts', 'gluten', 'milk']"),
      nutrition: nutritionalInfoSchema,
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Supported unit types for this ingredient"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe(
          "Unit conversion rates, e.g., 1 cup flour = 120g: { from: 'cup', to: 'g', factor: 120 }"
        ),
    }),
    handler: async ({
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient created successfully!\n` +
              `Name: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
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
      "Update an existing ingredient. Only provided fields will be changed.",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("New name for the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Replace all aliases"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace all categories"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Replace all allergens"),
      nutrition: nutritionalInfoSchema,
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Replace all supported units"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Replace all unit conversions"),
    }),
    handler: async ({
      id,
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.updateIngredient(id, {
        id,
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient updated successfully!\n` +
              `Name: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}`,
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
      "Create a copy of an existing ingredient, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z
        .string()
        .optional()
        .describe("New name for the duplicated ingredient"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Override categories"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Override allergens"),
      nutrition: nutritionalInfoSchema,
      supportedUnits: z
        .array(unitEnum)
        .optional()
        .describe("Override supported units"),
      unitConversions: z
        .array(unitConversionSchema)
        .optional()
        .describe("Override unit conversions"),
    }),
    handler: async ({
      id,
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.duplicateIngredient(id, {
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient duplicated successfully!\n` +
              `Name: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}`,
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
    description:
      "Create a new recipe with ingredients and steps. Each ingredient needs an ingredientId (from list_ingredients) and a unit. For standard units, provide quantity and unit. For free-form amounts, use unit 'free_text' with quantityText.",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .describe("List of ingredients with quantities"),
      steps: z
        .array(recipeStepSchema)
        .describe("Ordered list of recipe steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags, e.g., ['vegan', 'spicy']"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional categories, e.g., ['dessert', 'norwegian']"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional source attribution URL"),
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
              `Name: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
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
      "Update an existing recipe. Only provided fields will be changed. When updating ingredients or steps, the full array is replaced.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("New name for the recipe"),
      description: z
        .string()
        .optional()
        .describe("New description for the recipe"),
      servings: z.number().optional().describe("New number of servings"),
      ingredients: z
        .array(recipeIngredientSchema)
        .optional()
        .describe("Replace all ingredients"),
      steps: z
        .array(recipeStepSchema)
        .optional()
        .describe("Replace all steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Replace all tags"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Replace all categories"),
      sourceUrl: z
        .string()
        .optional()
        .describe("New source attribution URL"),
    }),
    handler: async ({
      id,
      name,
      description,
      servings,
      ingredients,
      steps,
      tags,
      categories,
      sourceUrl,
    }) => {
      const recipe = await api.updateRecipe(id, {
        id,
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
              `Recipe updated successfully!\n` +
              `Name: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
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
    description:
      "Create a copy of an existing recipe, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z
        .string()
        .optional()
        .describe("New name for the duplicated recipe"),
      description: z.string().optional().describe("Override description"),
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
    handler: async ({
      id,
      name,
      description,
      servings,
      ingredients,
      steps,
      tags,
      categories,
      sourceUrl,
    }) => {
      const recipe = await api.duplicateRecipe(id, {
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
              `Recipe duplicated successfully!\n` +
              `Name: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Servings: ${recipe.servings}\n` +
              `Ingredients: ${recipe.ingredients.length}\n` +
              `Steps: ${recipe.steps.length}`,
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
    description: "Create a new suggestion",
    schema: z.object({
      title: z.string().describe("Brief title for the suggestion"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of suggestion"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional related recipe ID"),
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
              `Suggestion created successfully!\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
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
      "Toggle vote on a suggestion. Voting again removes the vote.",
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
              `Vote ${result.voted ? "added" : "removed"} for suggestion: ${result.title}\n` +
              `Current votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description:
      "Update an existing suggestion. Only provided fields will be changed.",
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
    handler: async ({
      id,
      title,
      description,
      category,
      priority,
      relatedRecipeId,
      status,
    }) => {
      const suggestion = await api.updateSuggestion(id, {
        id,
        title,
        description,
        category,
        priority,
        relatedRecipeId,
        status,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion updated successfully!\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
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
    name: "duplicate_suggestion",
    description:
      "Create a copy of an existing suggestion, optionally overriding fields",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().optional().describe("New title for the duplicate"),
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
    handler: async ({
      id,
      title,
      description,
      category,
      priority,
      relatedRecipeId,
    }) => {
      const suggestion = await api.duplicateSuggestion(id, {
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
              `Suggestion duplicated successfully!\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}`,
          },
        ],
      };
    },
  }),
];
