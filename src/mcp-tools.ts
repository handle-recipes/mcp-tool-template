import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternative names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories this ingredient belongs to"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergens present in this ingredient"),
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
            text: `Created ingredient: ${result.name} (ID: ${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("The updated name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Updated alternative names"),
      categories: z.array(z.string()).optional().describe("Updated categories"),
      allergens: z.array(z.string()).optional().describe("Updated allergens"),
    }),
    handler: async ({ id, name, aliases, categories, allergens }) => {
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (aliases !== undefined) updates.aliases = aliases;
      if (categories !== undefined) updates.categories = categories;
      if (allergens !== undefined) updates.allergens = allergens;

      const result = await api.updateIngredient(id, updates);
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated ingredient: ${result.name} (ID: ${result.id})`,
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
            text: `${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "get_ingredient",
    description: "Get a single ingredient by ID",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to retrieve"),
    }),
    handler: async ({ id }) => {
      const result = await api.getIngredient(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}\n` +
              `Created by Group: ${result.createdByGroupId}`,
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
              ing.categories.join(", ") || "None"
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
      const result = await api.getRecipe(id);
      const ingredientsList = result.ingredients
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
      const stepsList = result.steps
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
              `Recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Source URL: ${result.sourceUrl || "None"}\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Updated: ${result.updatedAt}\n` +
              `Created by Group: ${result.createdByGroupId}`,
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
    description: `Create a new recipe with ingredients and cooking steps.

INGREDIENT FORMAT:
- ingredientId: (required) string - Must be a valid ingredient ID from the system
- unit: (required) Must be one of: "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon", "piece", or "free_text"
- quantity: (optional) number - Required for all units EXCEPT "free_text". Example: 200 for "200g"
- quantityText: (optional) string - ONLY used when unit is "free_text". Example: "a pinch" or "to taste"
- note: (optional) string - Additional notes like "finely chopped"

VALID EXAMPLES:
1. Standard unit: {"ingredientId": "123", "quantity": 200, "unit": "g"}
2. Free text: {"ingredientId": "456", "unit": "free_text", "quantityText": "a pinch"}
3. With note: {"ingredientId": "789", "quantity": 2, "unit": "cup", "note": "finely chopped"}

STEP FORMAT:
- text: (required) string - Description of the cooking step
- equipment: (optional) array of strings - Required equipment like ["oven", "mixing bowl"]`,
    schema: z.object({
      name: z.string().min(1).describe("Recipe name (required, non-empty)"),
      description: z
        .string()
        .min(1)
        .describe("Recipe description (required, non-empty)"),
      servings: z
        .number()
        .positive()
        .describe("Number of servings (required, must be positive)"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z
              .string()
              .min(1)
              .describe("Ingredient ID (required, non-empty string)"),
            quantity: z
              .number()
              .optional()
              .describe(
                "Quantity amount (number). Required for all units EXCEPT 'free_text'"
              ),
            unit: z
              .enum([
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
              ])
              .describe(
                "Unit of measurement (required). Use 'free_text' for measurements like 'a pinch' or 'to taste'"
              ),
            quantityText: z
              .string()
              .optional()
              .describe(
                "Free text quantity like 'a pinch' or 'to taste' (ONLY use when unit is 'free_text')"
              ),
            note: z
              .string()
              .optional()
              .describe("Optional note like 'finely chopped' or 'room temperature'"),
          })
        )
        .min(1)
        .describe("List of ingredients (required, must have at least 1)"),
      steps: z
        .array(
          z.object({
            text: z
              .string()
              .min(1)
              .describe("Step description (required, non-empty)"),
            equipment: z
              .array(z.string())
              .optional()
              .describe(
                "Required equipment like ['oven', 'mixing bowl'] (optional)"
              ),
          })
        )
        .min(1)
        .describe("Cooking steps (required, must have at least 1)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Recipe tags like ['vegan', 'spicy'] (optional)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Recipe categories like ['dessert', 'norwegian'] (optional)"),
      sourceUrl: z
        .string()
        .url()
        .optional()
        .describe("Source URL (optional, must be valid URL if provided)"),
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
      // Validate ingredient formatting
      const errors: string[] = [];

      ingredients.forEach((ing, index) => {
        // Check if unit is free_text
        if (ing.unit === "free_text") {
          if (ing.quantity !== undefined) {
            errors.push(
              `Ingredient #${index + 1}: When unit is "free_text", do NOT provide quantity. Use quantityText instead. Example: {"ingredientId": "${ing.ingredientId}", "unit": "free_text", "quantityText": "a pinch"}`
            );
          }
          if (!ing.quantityText) {
            errors.push(
              `Ingredient #${index + 1}: When unit is "free_text", quantityText is required. Example: {"ingredientId": "${ing.ingredientId}", "unit": "free_text", "quantityText": "to taste"}`
            );
          }
        } else {
          // Standard units
          if (ing.quantity === undefined || ing.quantity === null) {
            errors.push(
              `Ingredient #${index + 1}: quantity is required when unit is "${ing.unit}". Example: {"ingredientId": "${ing.ingredientId}", "quantity": 200, "unit": "${ing.unit}"}`
            );
          }
          if (ing.quantityText) {
            errors.push(
              `Ingredient #${index + 1}: quantityText should only be used with unit "free_text". Remove quantityText or change unit to "free_text".`
            );
          }
        }
      });

      if (errors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `❌ VALIDATION ERRORS - Recipe creation failed:\n\n` +
                errors.join("\n\n") +
                `\n\n📋 FORMATTING GUIDE:\n` +
                `Standard units: {"ingredientId": "abc123", "quantity": 200, "unit": "g"}\n` +
                `Free text: {"ingredientId": "abc123", "unit": "free_text", "quantityText": "a pinch"}\n` +
                `With note: {"ingredientId": "abc123", "quantity": 2, "unit": "cup", "note": "diced"}\n\n` +
                `Valid units: g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text`,
            },
          ],
        };
      }

      try {
        const result = await api.createRecipe({
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
              text: `✅ Created recipe: ${result.name} (ID: ${result.id})`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `❌ Failed to create recipe: ${error.message || error}\n\n` +
                `Check that all ingredient IDs are valid and exist in the system.`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: `Update an existing recipe. All fields except 'id' are optional - only provide fields you want to change.

INGREDIENT FORMAT (same as create_recipe):
- ingredientId: (required) string - Must be a valid ingredient ID from the system
- unit: (required) Must be one of: "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon", "piece", or "free_text"
- quantity: (optional) number - Required for all units EXCEPT "free_text". Example: 200 for "200g"
- quantityText: (optional) string - ONLY used when unit is "free_text". Example: "a pinch" or "to taste"
- note: (optional) string - Additional notes like "finely chopped"

VALID EXAMPLES:
1. Standard unit: {"ingredientId": "123", "quantity": 200, "unit": "g"}
2. Free text: {"ingredientId": "456", "unit": "free_text", "quantityText": "a pinch"}
3. With note: {"ingredientId": "789", "quantity": 2, "unit": "cup", "note": "finely chopped"}`,
    schema: z.object({
      id: z.string().min(1).describe("Recipe ID to update (required)"),
      name: z.string().min(1).optional().describe("Updated recipe name"),
      description: z.string().min(1).optional().describe("Updated description"),
      servings: z
        .number()
        .positive()
        .optional()
        .describe("Updated servings (must be positive)"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z
              .string()
              .min(1)
              .describe("Ingredient ID (required, non-empty string)"),
            quantity: z
              .number()
              .optional()
              .describe(
                "Quantity amount (number). Required for all units EXCEPT 'free_text'"
              ),
            unit: z
              .enum([
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
              ])
              .describe(
                "Unit of measurement (required). Use 'free_text' for measurements like 'a pinch' or 'to taste'"
              ),
            quantityText: z
              .string()
              .optional()
              .describe(
                "Free text quantity like 'a pinch' or 'to taste' (ONLY use when unit is 'free_text')"
              ),
            note: z
              .string()
              .optional()
              .describe("Optional note like 'finely chopped' or 'room temperature'"),
          })
        )
        .min(1)
        .optional()
        .describe(
          "Updated ingredients list (optional, replaces all ingredients if provided)"
        ),
      steps: z
        .array(
          z.object({
            text: z
              .string()
              .min(1)
              .describe("Step description (required, non-empty)"),
            equipment: z
              .array(z.string())
              .optional()
              .describe(
                "Required equipment like ['oven', 'mixing bowl'] (optional)"
              ),
          })
        )
        .min(1)
        .optional()
        .describe(
          "Updated cooking steps (optional, replaces all steps if provided)"
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe("Updated tags (optional, replaces all tags if provided)"),
      categories: z
        .array(z.string())
        .optional()
        .describe(
          "Updated categories (optional, replaces all categories if provided)"
        ),
      sourceUrl: z
        .string()
        .url()
        .optional()
        .describe("Updated source URL (optional, must be valid URL)"),
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
      // Validate ingredient formatting if ingredients are provided
      const errors: string[] = [];

      if (ingredients) {
        ingredients.forEach((ing, index) => {
          // Check if unit is free_text
          if (ing.unit === "free_text") {
            if (ing.quantity !== undefined) {
              errors.push(
                `Ingredient #${index + 1}: When unit is "free_text", do NOT provide quantity. Use quantityText instead. Example: {"ingredientId": "${ing.ingredientId}", "unit": "free_text", "quantityText": "a pinch"}`
              );
            }
            if (!ing.quantityText) {
              errors.push(
                `Ingredient #${index + 1}: When unit is "free_text", quantityText is required. Example: {"ingredientId": "${ing.ingredientId}", "unit": "free_text", "quantityText": "to taste"}`
              );
            }
          } else {
            // Standard units
            if (ing.quantity === undefined || ing.quantity === null) {
              errors.push(
                `Ingredient #${index + 1}: quantity is required when unit is "${ing.unit}". Example: {"ingredientId": "${ing.ingredientId}", "quantity": 200, "unit": "${ing.unit}"}`
              );
            }
            if (ing.quantityText) {
              errors.push(
                `Ingredient #${index + 1}: quantityText should only be used with unit "free_text". Remove quantityText or change unit to "free_text".`
              );
            }
          }
        });
      }

      if (errors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `❌ VALIDATION ERRORS - Recipe update failed:\n\n` +
                errors.join("\n\n") +
                `\n\n📋 FORMATTING GUIDE:\n` +
                `Standard units: {"ingredientId": "abc123", "quantity": 200, "unit": "g"}\n` +
                `Free text: {"ingredientId": "abc123", "unit": "free_text", "quantityText": "a pinch"}\n` +
                `With note: {"ingredientId": "abc123", "quantity": 2, "unit": "cup", "note": "diced"}\n\n` +
                `Valid units: g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text`,
            },
          ],
        };
      }

      try {
        const updates: any = {};
        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (servings !== undefined) updates.servings = servings;
        if (ingredients !== undefined) updates.ingredients = ingredients;
        if (steps !== undefined) updates.steps = steps;
        if (tags !== undefined) updates.tags = tags;
        if (categories !== undefined) updates.categories = categories;
        if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;

        const result = await api.updateRecipe(id, updates);
        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Updated recipe: ${result.name} (ID: ${result.id})`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `❌ Failed to update recipe: ${error.message || error}\n\n` +
                `Check that the recipe ID exists and all ingredient IDs are valid.`,
            },
          ],
        };
      }
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
            text: `${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for features, bugs, or improvements",
    schema: z.object({
      title: z.string().describe("Title of the suggestion"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of the suggestion"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("ID of related recipe if applicable"),
    }),
    handler: async ({
      title,
      description,
      category,
      priority,
      relatedRecipeId,
    }) => {
      const result = await api.createSuggestion({
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
            text: `Created suggestion: ${result.title} (ID: ${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "list_suggestions",
    description: "List suggestions with optional filtering by status",
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
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .optional()
        .describe("Filter by suggestion status"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (suggestion) =>
            `- ${suggestion.title} (${suggestion.id}) - Status: ${suggestion.status}, Votes: ${suggestion.votes}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${result.suggestions.length} suggestions:\n\n${suggestionsList}\n\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Vote on a suggestion (toggles vote on/off)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text: result.voted
              ? `Voted for suggestion: ${result.title} (Total votes: ${result.votes})`
              : `Removed vote from suggestion: ${result.title} (Total votes: ${result.votes})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update the status of a suggestion",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      status: z
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .describe("New status for the suggestion"),
    }),
    handler: async ({ id, status }) => {
      const result = await api.updateSuggestion(id, { id, status });
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated suggestion: ${result.title} - Status: ${result.status}`,
          },
        ],
      };
    },
  }),
];
