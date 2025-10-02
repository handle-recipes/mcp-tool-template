import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  // ----------------------
  // Ingredient Tools
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dairy, protein, herb)"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g., nuts, gluten, milk)"),
    }),
    handler: async ({ name, aliases, categories, allergens }) => {
      const result = await api.createIngredient({
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
              `Created ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}`,
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
    name: "update_ingredient",
    description: "Update an existing ingredient",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("The name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dairy, protein, herb)"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g., nuts, gluten, milk)"),
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
            text:
              `Updated ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}`,
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

  // ----------------------
  // Recipe Tools
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z.number().optional().describe("Quantity (if not free_text)"),
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
                "Unit (g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text)"
              ),
            quantityText: z
              .string()
              .optional()
              .describe("Free text quantity (for free_text unit)"),
            note: z.string().optional().describe("Additional note (e.g., chopped)"),
          })
        )
        .describe("List of recipe ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction"),
            imageUrl: z.string().optional().describe("Optional step image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment for this step"),
          })
        )
        .describe("List of recipe steps"),
      tags: z.array(z.string()).optional().describe("Tags (e.g., vegan, spicy)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dessert, norwegian)"),
      sourceUrl: z.string().optional().describe("Source attribution URL"),
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
    name: "update_recipe",
    description: "Update an existing recipe",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("The name of the recipe"),
      description: z.string().optional().describe("Recipe description"),
      servings: z.number().optional().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z.number().optional().describe("Quantity (if not free_text)"),
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
                "Unit (g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text)"
              ),
            quantityText: z
              .string()
              .optional()
              .describe("Free text quantity (for free_text unit)"),
            note: z.string().optional().describe("Additional note (e.g., chopped)"),
          })
        )
        .optional()
        .describe("List of recipe ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction"),
            imageUrl: z.string().optional().describe("Optional step image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment for this step"),
          })
        )
        .optional()
        .describe("List of recipe steps"),
      tags: z.array(z.string()).optional().describe("Tags (e.g., vegan, spicy)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dessert, norwegian)"),
      sourceUrl: z.string().optional().describe("Source attribution URL"),
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
            text:
              `Updated recipe: ${result.name}\n` +
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

  // ----------------------
  // Suggestion Tools
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for a feature, bug, improvement, or other",
    schema: z.object({
      title: z.string().describe("Brief title of the suggestion"),
      description: z.string().describe("Detailed description of the suggestion"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of suggestion (default: other)"),
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
              `Created suggestion: ${result.title}\n` +
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
    name: "list_suggestions",
    description: "List suggestions with optional filtering and pagination",
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
        .describe("Filter by status"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (sugg) =>
            `- ${sugg.title} (${sugg.id}) - ${sugg.category} | ${sugg.priority} | ${sugg.status} | Votes: ${sugg.votes}`
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
    description: "Vote for a suggestion (adds vote if not voted, removes if already voted)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote for"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `${result.voted ? "Added" : "Removed"} vote for: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Current votes: ${result.votes}`,
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
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .describe("New status for the suggestion"),
    }),
    handler: async ({ id, status }) => {
      const result = await api.updateSuggestion(id, { id, status });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated suggestion: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Status: ${result.status}`,
          },
        ],
      };
    },
  }),
];
