import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import { Unit, UNITS } from "./types";

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
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("Name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternative names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories the ingredient belongs to"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags for the ingredient"),
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
    name: "update_ingredient",
    description: "Update an existing ingredient",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to update"),
      name: z.string().optional().describe("New name for the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("New aliases (replaces existing)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("New categories (replaces existing)"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("New allergens (replaces existing)"),
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
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z.number().optional().describe("Amount of ingredient"),
            unit: z
              .enum(UNITS)
              .describe(
                "Unit of measurement (g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text)"
              ),
            quantityText: z
              .string()
              .optional()
              .describe("Text quantity when unit is free_text"),
            note: z.string().optional().describe("Additional notes"),
          })
        )
        .describe("List of ingredients with quantities"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Required equipment"),
          })
        )
        .describe("Cooking steps in order"),
      tags: z.array(z.string()).optional().describe("Recipe tags"),
      categories: z.array(z.string()).optional().describe("Recipe categories"),
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
    description: "Update an existing recipe",
    schema: z.object({
      id: z.string().describe("ID of the recipe to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New serving count"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum(UNITS),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          })
        )
        .optional()
        .describe("New ingredients list (replaces existing)"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("New steps (replaces existing)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("New tags (replaces existing)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("New categories (replaces existing)"),
      sourceUrl: z.string().optional().describe("New source URL"),
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
              `Updated: ${result.updatedAt}`,
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
    name: "add_step_to_all_recipes",
    description: "Add a step at the beginning of all recipes",
    schema: z.object({
      text: z.string().describe("Step instruction text"),
      imageUrl: z.string().optional().describe("Optional image URL"),
      equipment: z
        .array(z.string())
        .optional()
        .describe("Optional equipment needed"),
    }),
    handler: async ({ text, imageUrl, equipment }) => {
      const result = await api.addStepToAllRecipes({
        text,
        imageUrl,
        equipment,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Bulk operation completed:\n` +
              `Updated: ${result.updated} recipes\n` +
              `Failed: ${result.failed} recipes`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "add_prefix_to_all_recipe_names",
    description: "Add a text prefix to all recipe names",
    schema: z.object({
      prefix: z.string().describe("Text to add at the start of recipe names"),
    }),
    handler: async ({ prefix }) => {
      const result = await api.addPrefixToAllRecipeNames(prefix);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Bulk operation completed:\n` +
              `Updated: ${result.updated} recipes\n` +
              `Failed: ${result.failed} recipes`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "set_source_url_for_all_recipes",
    description: "Set the source URL for all recipes",
    schema: z.object({
      sourceUrl: z.string().describe("Source URL to set for all recipes"),
    }),
    handler: async ({ sourceUrl }) => {
      const result = await api.setSourceUrlForAllRecipes(sourceUrl);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Bulk operation completed:\n` +
              `Updated: ${result.updated} recipes\n` +
              `Failed: ${result.failed} recipes`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "set_tags_for_all_recipes",
    description: "Set tags for all recipes (replaces existing tags)",
    schema: z.object({
      tags: z.array(z.string()).describe("Tags to set for all recipes"),
    }),
    handler: async ({ tags }) => {
      const result = await api.setTagsForAllRecipes(tags);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Bulk operation completed:\n` +
              `Updated: ${result.updated} recipes\n` +
              `Failed: ${result.failed} recipes`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "set_categories_for_all_recipes",
    description: "Set categories for all recipes (replaces existing categories)",
    schema: z.object({
      categories: z
        .array(z.string())
        .describe("Categories to set for all recipes"),
    }),
    handler: async ({ categories }) => {
      const result = await api.setCategoriesForAllRecipes(categories);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Bulk operation completed:\n` +
              `Updated: ${result.updated} recipes\n` +
              `Failed: ${result.failed} recipes`,
          },
        ],
      };
    },
  }),
];
