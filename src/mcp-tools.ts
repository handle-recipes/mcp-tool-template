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
    name: "add_ingredient",
    description: "Create a new ingredient for the group",
    schema: z.object({
      name: z.string().describe("Name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternative names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., 'dairy', 'protein', 'herb')"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g., 'nuts', 'gluten', 'milk')"),
      supportedUnits: z
        .array(z.string())
        .optional()
        .describe("Supported units (e.g., 'g', 'ml', 'piece')"),
    }),
    handler: async (params) => {
      try {
        const ingredient = await api.createIngredient({
          name: params.name,
          aliases: params.aliases,
          categories: params.categories,
          allergens: params.allergens,
          supportedUnits: params.supportedUnits as any,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Created ingredient: ${ingredient.name}\n` +
                `ID: ${ingredient.id}\n` +
                (ingredient.aliases?.length
                  ? `Aliases: ${ingredient.aliases.join(", ")}\n`
                  : "") +
                (ingredient.categories?.length
                  ? `Categories: ${ingredient.categories.join(", ")}\n`
                  : "") +
                (ingredient.allergens?.length
                  ? `Allergens: ${ingredient.allergens.join(", ")}\n`
                  : ""),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to create ingredient: ${error}`);
      }
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
    name: "add_recipe",
    description:
      "Create a new recipe for the group. Can also create missing ingredients in the same request.",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().optional().describe("Short description"),
      servings: z.number().optional().describe("Number of servings"),
      tags: z.array(z.string()).optional().describe("Tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories for the recipe"),
      slug: z.string().optional().describe("Optional slug"),
      sourceUrl: z.string().optional().describe("Source URL"),
      ingredients: z
        .array(
          z.union([
            // Option 1: Reference existing ingredient by ID
            z.object({
              ingredientId: z.string().describe("ID of existing ingredient"),
              quantity: z.number().optional(),
              unit: z.string().optional(),
              quantityText: z.string().optional(),
              note: z.string().optional(),
            }),
            // Option 2: Create new ingredient inline
            z.object({
              ingredientName: z
                .string()
                .describe("Name of ingredient to create"),
              quantity: z.number().optional(),
              unit: z.string().optional(),
              quantityText: z.string().optional(),
              note: z.string().optional(),
              aliases: z
                .array(z.string())
                .optional()
                .describe("Ingredient aliases"),
              categories: z
                .array(z.string())
                .optional()
                .describe("Ingredient categories"),
              allergens: z
                .array(z.string())
                .optional()
                .describe("Ingredient allergens"),
            }),
          ]),
        )
        .optional()
        .describe(
          "Array of ingredients - can use ingredientId for existing or ingredientName to create new",
        ),
      steps: z
        .array(
          z.object({
            text: z.string(),
            equipment: z.array(z.string()).optional(),
          }),
        )
        .optional()
        .describe("Array of step objects"),
    }),
    handler: async (params) => {
      // Process ingredients: create new ones if needed and collect IDs
      const processedIngredients: typeof params.ingredients = [];
      const createdIngredients: string[] = [];

      if (params.ingredients && params.ingredients.length > 0) {
        for (const ing of params.ingredients) {
          const ingredientItem = ing as any;

          if ("ingredientName" in ingredientItem) {
            // Create new ingredient
            try {
              const newIngredient = await api.createIngredient({
                name: ingredientItem.ingredientName,
                aliases: ingredientItem.aliases,
                categories: ingredientItem.categories,
                allergens: ingredientItem.allergens,
              });
              createdIngredients.push(newIngredient.id);

              processedIngredients.push({
                ingredientId: newIngredient.id,
                quantity: ingredientItem.quantity,
                unit: ingredientItem.unit,
                quantityText: ingredientItem.quantityText,
                note: ingredientItem.note,
              });
            } catch (error) {
              throw new Error(
                `Failed to create ingredient "${ingredientItem.ingredientName}": ${error}`,
              );
            }
          } else {
            // Use existing ingredient ID
            processedIngredients.push({
              ingredientId: ingredientItem.ingredientId,
              quantity: ingredientItem.quantity,
              unit: ingredientItem.unit,
              quantityText: ingredientItem.quantityText,
              note: ingredientItem.note,
            });
          }
        }
      }

      const requestBody = {
        name: params.name,
        description: params.description,
        servings: params.servings,
        tags: params.tags,
        categories: params.categories,
        slug: params.slug,
        sourceUrl: params.sourceUrl,
        ingredients: processedIngredients,
        steps: params.steps,
      } as any;

      const created = await api.createRecipe(requestBody);

      let resultText = `Created recipe ${created.id} - ${created.name || params.name}`;
      if (createdIngredients.length > 0) {
        resultText += `\n\nAlso created ${createdIngredients.length} new ingredient(s):\n`;
        createdIngredients.forEach((id, idx) => {
          resultText += `  ${idx + 1}. ${id}\n`;
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    },
  }),
];
