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
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    },
  }),
  createMCPTool({
    name: "change_ingredient_name",
    description: "Change the name of an ingredient",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to retrieve"),
      name: z.string().describe("The new name of the ingredient"),
    }),
    handler: async ({ id, name }) => {
      const result = await api.updateIngredient(id, { id, name });
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
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z.array(z.string()).describe("The aliases of the ingredient"),
      categories: z
        .array(z.string())
        .describe("The categories of the ingredient"),
      allergens: z
        .array(z.string())
        .describe("The allergens of the ingredient"),
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
              `Image URL: ${result.imageUrl || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
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
    name: "update_ingredient",
    description: "Update an ingredient with new values",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("The new name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("The new aliases of the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("The new categories of the ingredient"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("The new allergens of the ingredient"),
    }),
    handler: async ({ id, name, aliases, categories, allergens }) => {
      const updateData: any = { id };
      if (name !== undefined) updateData.name = name;
      if (aliases !== undefined) updateData.aliases = aliases;
      if (categories !== undefined) updateData.categories = categories;
      if (allergens !== undefined) updateData.allergens = allergens;

      const result = await api.updateIngredient(id, updateData);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated Ingredient: ${result.name}\n` +
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
            text: `Successfully deleted ingredient: ${result.message}`,
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
      description: z.string().describe("The description of the recipe"),
      servings: z.number().describe("Number of servings the recipe makes"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity of the ingredient"),
            unit: z
              .enum(["g", "kg", "ml", "l", "piece", "free_text"])
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Free text quantity when unit is 'free_text'"),
            note: z
              .string()
              .optional()
              .describe("Additional notes about the ingredient"),
          })
        )
        .describe("List of ingredients for the recipe"),
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
        .describe("List of cooking steps"),
      tags: z.array(z.string()).optional().describe("Tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories for the recipe"),
      sourceUrl: z.string().optional().describe("Source URL for the recipe"),
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
              `Created Recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length} items\n` +
              `Steps: ${result.steps.length} steps\n` +
              `Created by Group: ${result.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe with new values",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("The new name of the recipe"),
      description: z
        .string()
        .optional()
        .describe("The new description of the recipe"),
      servings: z
        .number()
        .optional()
        .describe("New number of servings the recipe makes"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity of the ingredient"),
            unit: z
              .enum(["g", "kg", "ml", "l", "piece", "free_text"])
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Free text quantity when unit is 'free_text'"),
            note: z
              .string()
              .optional()
              .describe("Additional notes about the ingredient"),
          })
        )
        .optional()
        .describe("New list of ingredients for the recipe"),
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
        .optional()
        .describe("New list of cooking steps"),
      tags: z.array(z.string()).optional().describe("New tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("New categories for the recipe"),
      sourceUrl: z
        .string()
        .optional()
        .describe("New source URL for the recipe"),
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
      const updateData: any = { id };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (servings !== undefined) updateData.servings = servings;
      if (ingredients !== undefined) updateData.ingredients = ingredients;
      if (steps !== undefined) updateData.steps = steps;
      if (tags !== undefined) updateData.tags = tags;
      if (categories !== undefined) updateData.categories = categories;
      if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;

      const result = await api.updateRecipe(id, updateData);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated Recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length} items\n` +
              `Steps: ${result.steps.length} steps\n` +
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
            text: `Successfully deleted recipe: ${result.message}`,
          },
        ],
      };
    },
  }),
];
