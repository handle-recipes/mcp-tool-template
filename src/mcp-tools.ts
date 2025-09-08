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
              `Created: ${new Date(
                result.createdAt.seconds * 1000
              ).toISOString()}\n` +
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z.array(z.string()).describe("Aliases for the ingredient"),
      categories: z.array(z.string()).describe("Categories for the ingredient"),
      allergens: z.array(z.string()).describe("Allergens for the ingredient"),
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
              `Ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}\n`
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
            `- ${ing.name} (${ing.id}) - Categories: ${ing.categories.join(", ") || "None"
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
          return `- ${quantityText} (Ingredient ID: ${ing.ingredientId})${ing.note ? ` - ${ing.note}` : ""
            }`;
        })
        .join("\n");
      const stepsList = result.steps
        .map(
          (step, i) =>
            `${i + 1}. ${step.text}${step.equipment ? ` (Equipment: ${step.equipment.join(", ")})` : ""
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
              `Image URL: ${result.imageUrl || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${new Date(
                result.createdAt.seconds * 1000
              ).toISOString()}\n` +
              `Updated: ${new Date(
                result.updatedAt.seconds * 1000
              ).toISOString()}\n` +
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("A short description of the recipe"),
      servings: z.number().min(1).describe("Number of servings"),
      ingredients: z.array(
        z.object({
          ingredientId: z.string().describe("The ID of the ingredient"),
          quantity: z.number().optional().describe("The quantity of the ingredient"),
          unit: z.string().describe("The unit of measurement for the ingredient"),
          quantityText: z.string().optional().describe("Free-text quantity (if unit is 'free_text')"),
          note: z.string().optional().describe("Additional notes for the ingredient"),
        })
      ),
      steps: z.array(
        z.object({
          text: z.string().describe("Instruction text"),
          imageUrl: z.string().optional().describe("Optional step image URL"),
          equipment: z.array(z.string()).optional().describe("Optional equipment needed"),
        })
      ),
      tags: z.array(z.string()).optional().describe("Free-text tags"),
      categories: z.array(z.string()).optional().describe("Recipe categories"),
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
        ingredients: ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          quantity: ing.quantity,
          unit: ing.unit as "g" | "kg" | "ml" | "l" | "piece" | "free_text",
          quantityText: ing.quantityText,
          note: ing.note,
        })),
        steps: steps.map((step) => ({
          text: step.text,
          imageUrl: step.imageUrl,
          equipment: step.equipment,
        })),
        tags: tags || [],
        categories: categories || [],
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
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Source URL: ${result.sourceUrl || "None"}\n` +
              `Ingredients: ${result.ingredients.length}\n` +
              `Steps: ${result.steps.length}\n`,
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
    description: "Search recipes using keyword-based search with optional filtering",
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
];