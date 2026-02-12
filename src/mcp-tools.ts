import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

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
            }`,
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
            }`,
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
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings`,
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
              100,
            )}...`,
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
    name: "create_ingredient",
    description: "Create a new ingredient with name, categories, and allergens",
    schema: z.object({
      name: z.string().describe("Primary name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names or spellings"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories like 'dairy', 'protein', 'herb'"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags like 'nuts', 'gluten', 'milk'"),
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

  createMCPTool({
    name: "update_ingredient",
    description:
      "Update an existing ingredient (only for ingredients you created)",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("Updated primary name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Updated alternate names"),
      categories: z.array(z.string()).optional().describe("Updated categories"),
      allergens: z.array(z.string()).optional().describe("Updated allergens"),
    }),
    handler: async ({ id, name, aliases, categories, allergens }) => {
      const result = await api.updateIngredient(id, {
        id,
        name,
        aliases,
        categories,
        allergens,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Updated ingredient: ${result.name} (${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete an ingredient (only for ingredients you created)",
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
      "Create a duplicate of an existing ingredient that you can edit",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z.string().optional().describe("Override the name"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
    }),
    handler: async ({ id, name, aliases, categories, allergens }) => {
      const result = await api.duplicateIngredient(id, {
        name,
        aliases,
        categories,
        allergens,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Duplicated ingredient: ${result.name} (${result.id})\n` +
              `Original: ${result.variantOf || "N/A"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe with ingredients and steps",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().describe("Recipe description"),
      servings: z.number().min(1).describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Amount (omit for free_text)"),
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
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Text for free_text unit (e.g., 'a pinch')"),
            note: z
              .string()
              .optional()
              .describe("Additional notes (e.g., 'finely chopped')"),
          }),
        )
        .describe("List of ingredients with quantities"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction"),
            imageUrl: z.string().optional().describe("Optional step image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Equipment needed for this step"),
          }),
        )
        .describe("Ordered cooking steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags like 'vegan', 'spicy'"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories like 'dessert', 'norwegian'"),
      sourceUrl: z.string().optional().describe("Source URL"),
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
            text: `Created recipe: ${result.name} (${result.id})\nSlug: ${result.slug}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe (only for recipes you created)",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("Updated recipe name"),
      description: z.string().optional().describe("Updated description"),
      servings: z.number().min(1).optional().describe("Updated servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum([
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
            ]),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .optional()
        .describe("Updated ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          }),
        )
        .optional()
        .describe("Updated steps"),
      tags: z.array(z.string()).optional().describe("Updated tags"),
      categories: z.array(z.string()).optional().describe("Updated categories"),
      sourceUrl: z.string().optional().describe("Updated source URL"),
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
      const result = await api.updateRecipe(id, {
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
            text: `Updated recipe: ${result.name} (${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete a recipe (only for recipes you created)",
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
    description: "Create a duplicate of an existing recipe that you can edit",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z.string().optional().describe("Override the name"),
      description: z.string().optional().describe("Override description"),
      servings: z.number().min(1).optional().describe("Override servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum([
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
            ]),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .optional()
        .describe("Override ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          }),
        )
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
      const result = await api.duplicateRecipe(id, {
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
              `Duplicated recipe: ${result.name} (${result.id})\n` +
              `Slug: ${result.slug}\n` +
              `Original: ${result.variantOf || "N/A"}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_suggestion",
    description:
      "Create a new feature request, bug report, or improvement suggestion",
    schema: z.object({
      title: z.string().max(200).describe("Brief title for the suggestion"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of suggestion (default: feature)"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level (default: medium)"),
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
            text:
              `Created suggestion: ${result.title} (${result.id})\n` +
              `Status: ${result.status}\n` +
              `Category: ${result.category}\n` +
              `Priority: ${result.priority}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "list_suggestions",
    description:
      "List suggestions with optional pagination and status filtering",
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
            `- [${suggestion.status.toUpperCase()}] ${suggestion.title} (${suggestion.id})\n` +
            `  Category: ${suggestion.category} | Priority: ${suggestion.priority} | Votes: ${suggestion.votes}\n` +
            `  ${suggestion.description.substring(0, 100)}${suggestion.description.length > 100 ? "..." : ""}`,
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
    name: "vote_suggestion",
    description:
      "Vote on a suggestion (toggles vote - removes if already voted, adds if not)",
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
              `${result.voted ? "Added vote to" : "Removed vote from"} suggestion: ${result.title} (${result.id})\n` +
              `Total votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description:
      "Update an existing suggestion (only for suggestions you created)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      title: z.string().max(200).optional().describe("Updated title"),
      description: z.string().optional().describe("Updated description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Updated category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Updated priority"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Updated related recipe ID"),
      status: z
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .optional()
        .describe("Updated status"),
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
      const result = await api.updateSuggestion(id, {
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
            text: `Updated suggestion: ${result.title} (${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion (only for suggestions you created)",
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
      "Create a duplicate of an existing suggestion that you can edit",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().max(200).optional().describe("Override the title"),
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
      const result = await api.duplicateSuggestion(id, {
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
              `Duplicated suggestion: ${result.title} (${result.id})\n` +
              `Original: ${result.variantOf || "N/A"}\n` +
              `Status: ${result.status}\n` +
              `Votes: ${result.votes}`,
          },
        ],
      };
    },
  }),
];
