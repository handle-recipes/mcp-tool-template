import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import {
  UNIT,
  SUGGESTION_CATEGORY,
  SUGGESTION_PRIORITY,
  SUGGESTION_STATUS,
} from "./types";

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
    description:
      "Create a new recipe with ingredients and steps. Ingredient IDs must reference existing ingredients.",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z
              .string()
              .describe("ID of an existing ingredient"),
            quantity: z
              .number()
              .optional()
              .describe(
                "Numeric quantity (omit if unit is free_text)"
              ),
            unit: z
              .enum(UNIT)
              .describe(
                "Unit of measurement. Use free_text for non-standard quantities"
              ),
            quantityText: z
              .string()
              .optional()
              .describe(
                "Text quantity, only used when unit is free_text (e.g. 'a pinch', 'to taste')"
              ),
            note: z
              .string()
              .optional()
              .describe("Optional note (e.g. 'finely chopped')"),
          })
        )
        .describe("List of ingredients with quantities"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text for this step"),
            imageUrl: z
              .string()
              .optional()
              .describe("Optional image URL for this step"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment needed for this step"),
          })
        )
        .describe("Ordered list of recipe steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags (e.g. 'vegan', 'spicy')"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional categories (e.g. 'dessert', 'norwegian')"),
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
              `Source URL: ${recipe.sourceUrl || "None"}\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Ingredient write tools
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient with optional nutritional info and metadata",
    schema: z.object({
      name: z.string().describe("Primary name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names, spellings, or translations"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Free-text categories (e.g. 'dairy', 'protein', 'herb')"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g. 'nuts', 'gluten', 'milk')"),
      nutrition: z
        .object({
          calories: z.number().optional().describe("Calories in kcal per 100g"),
          protein: z.number().optional().describe("Protein in grams per 100g"),
          carbohydrates: z.number().optional().describe("Carbohydrates in grams per 100g"),
          fat: z.number().optional().describe("Fat in grams per 100g"),
          fiber: z.number().optional().describe("Fiber in grams per 100g"),
        })
        .optional()
        .describe("Nutritional values per 100g"),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe("Additional metadata key-value pairs"),
      supportedUnits: z
        .array(z.enum(UNIT))
        .optional()
        .describe("Supported unit types for this ingredient"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum(UNIT).describe("Source unit"),
            to: z.enum(UNIT).describe("Target unit (typically 'g')"),
            factor: z.number().describe("Conversion factor (from * factor = to)"),
          })
        )
        .optional()
        .describe("Unit conversion rates"),
    }),
    handler: async (params) => {
      const ingredient = await api.createIngredient(params);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient created successfully!\n\n` +
              `Name: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description:
      "Update an existing ingredient. Supports both full field replacement and array operations (add/remove) for aliases, categories, allergens, and supported units.",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to update"),
      name: z.string().optional().describe("New name"),
      aliases: z.array(z.string()).optional().describe("Replace all aliases"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      allergens: z.array(z.string()).optional().describe("Replace all allergens"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Nutritional values per 100g"),
      metadata: z.record(z.string(), z.string()).optional().describe("Replace all metadata"),
      supportedUnits: z.array(z.enum(UNIT)).optional().describe("Replace all supported units"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum(UNIT),
            to: z.enum(UNIT),
            factor: z.number(),
          })
        )
        .optional()
        .describe("Replace all unit conversions"),
      addAliases: z.array(z.string()).optional().describe("Add aliases (cannot use with aliases)"),
      removeAliases: z.array(z.string()).optional().describe("Remove aliases (cannot use with aliases)"),
      addCategories: z.array(z.string()).optional().describe("Add categories (cannot use with categories)"),
      removeCategories: z.array(z.string()).optional().describe("Remove categories (cannot use with categories)"),
      addAllergens: z.array(z.string()).optional().describe("Add allergens (cannot use with allergens)"),
      removeAllergens: z.array(z.string()).optional().describe("Remove allergens (cannot use with allergens)"),
      addSupportedUnits: z.array(z.enum(UNIT)).optional().describe("Add supported units (cannot use with supportedUnits)"),
      removeSupportedUnits: z.array(z.enum(UNIT)).optional().describe("Remove supported units (cannot use with supportedUnits)"),
    }),
    handler: async ({ id, ...updates }) => {
      const ingredient = await api.updateIngredient(id, { id, ...updates });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient updated successfully!\n\n` +
              `Name: ${ingredient.name}\n` +
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
    description: "Delete an ingredient by ID",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to delete"),
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
      id: z.string().describe("ID of the ingredient to duplicate"),
      name: z.string().optional().describe("Override name for the copy"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Override nutritional values"),
      metadata: z.record(z.string(), z.string()).optional().describe("Override metadata"),
      supportedUnits: z.array(z.enum(UNIT)).optional().describe("Override supported units"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum(UNIT),
            to: z.enum(UNIT),
            factor: z.number(),
          })
        )
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
              `Ingredient duplicated successfully!\n\n` +
              `Name: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe write tools
  // ----------------------

  createMCPTool({
    name: "update_recipe",
    description:
      "Update an existing recipe. Supports both full field replacement and array operations (add/remove) for tags, categories, ingredients, and steps.",
    schema: z.object({
      id: z.string().describe("ID of the recipe to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum(UNIT),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .optional()
        .describe("Replace all ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("Replace all steps"),
      tags: z.array(z.string()).optional().describe("Replace all tags"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
      addTags: z.array(z.string()).optional().describe("Add tags (cannot use with tags)"),
      removeTags: z.array(z.string()).optional().describe("Remove tags (cannot use with tags)"),
      addCategories: z.array(z.string()).optional().describe("Add categories (cannot use with categories)"),
      removeCategories: z.array(z.string()).optional().describe("Remove categories (cannot use with categories)"),
      addIngredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum(UNIT),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .optional()
        .describe("Add ingredients (cannot use with ingredients)"),
      removeIngredientIds: z
        .array(z.string())
        .optional()
        .describe("Remove ingredients by ingredient ID (cannot use with ingredients)"),
      addSteps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("Add steps to end (cannot use with steps)"),
      removeStepIndexes: z
        .array(z.number())
        .optional()
        .describe("Remove steps by index (cannot use with steps)"),
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
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Source URL: ${recipe.sourceUrl || "None"}\n` +
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
    description: "Delete a recipe by ID",
    schema: z.object({
      id: z.string().describe("ID of the recipe to delete"),
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
      id: z.string().describe("ID of the recipe to duplicate"),
      name: z.string().optional().describe("Override name for the copy"),
      description: z.string().optional().describe("Override description"),
      servings: z.number().optional().describe("Override servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum(UNIT),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .optional()
        .describe("Override ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("Override steps"),
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
              `Recipe duplicated successfully!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion write tools
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion (feature request, bug report, improvement, etc.)",
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
      const suggestion = await api.createSuggestion(params);
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
              `Description: ${suggestion.description}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Toggle your vote on a suggestion. Voting again removes the vote.",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Vote ${result.voted ? "added" : "removed"} successfully!\n\n` +
              `Title: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Total votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion's title, description, category, priority, status, or related recipe",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to update"),
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
      status: z
        .enum(SUGGESTION_STATUS)
        .optional()
        .describe("New status"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("New related recipe ID"),
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
    description: "Delete a suggestion by ID",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to delete"),
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
      id: z.string().describe("ID of the suggestion to duplicate"),
      title: z.string().optional().describe("Override title for the copy"),
      description: z.string().optional().describe("Override description"),
      category: z.enum(SUGGESTION_CATEGORY).optional().describe("Override category"),
      priority: z.enum(SUGGESTION_PRIORITY).optional().describe("Override priority"),
      relatedRecipeId: z.string().optional().describe("Override related recipe ID"),
    }),
    handler: async ({ id, ...overrides }) => {
      const suggestion = await api.duplicateSuggestion(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Suggestion duplicated successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Description: ${suggestion.description}`,
          },
        ],
      };
    },
  }),
];
