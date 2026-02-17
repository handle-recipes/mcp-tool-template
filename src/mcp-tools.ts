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
      name: z.string().describe("Ingredient name"),
      aliases: z.array(z.string()).optional().describe("Alternate names"),
      categories: z.array(z.string()).optional().describe("Categories (e.g., 'dairy', 'protein')"),
      allergens: z.array(z.string()).optional().describe("Allergen tags (e.g., 'nuts', 'gluten')"),
      supportedUnits: z
        .array(
          z.enum([
            "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
            "cup", "pint", "quart", "gallon", "piece", "free_text",
          ])
        )
        .optional()
        .describe("Supported units for this ingredient"),
      nutrition: z
        .object({
          calories: z.number().optional().describe("Calories per 100g"),
          protein: z.number().optional().describe("Protein in grams per 100g"),
          carbohydrates: z.number().optional().describe("Carbs in grams per 100g"),
          fat: z.number().optional().describe("Fat in grams per 100g"),
          fiber: z.number().optional().describe("Fiber in grams per 100g"),
        })
        .optional()
        .describe("Nutritional information per 100g"),
      metadata: z.record(z.string()).optional().describe("Additional metadata"),
    }),
    handler: async ({ name, aliases, categories, allergens, supportedUnits, nutrition, metadata }) => {
      const ingredient = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        supportedUnits,
        nutrition,
        metadata,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully created ingredient!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient (supports partial updates and array operations)",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to update"),
      name: z.string().optional().describe("New name"),
      aliases: z.array(z.string()).optional().describe("Replace all aliases"),
      categories: z.array(z.string()).optional().describe("Replace all categories"),
      allergens: z.array(z.string()).optional().describe("Replace all allergens"),
      supportedUnits: z
        .array(
          z.enum([
            "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
            "cup", "pint", "quart", "gallon", "piece", "free_text",
          ])
        )
        .optional()
        .describe("Replace all supported units"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Update nutritional information"),
      metadata: z.record(z.string()).optional().describe("Replace metadata"),
      addAliases: z.array(z.string()).optional().describe("Add aliases (cannot use with 'aliases')"),
      removeAliases: z.array(z.string()).optional().describe("Remove aliases (cannot use with 'aliases')"),
      addCategories: z.array(z.string()).optional().describe("Add categories (cannot use with 'categories')"),
      removeCategories: z.array(z.string()).optional().describe("Remove categories (cannot use with 'categories')"),
      addAllergens: z.array(z.string()).optional().describe("Add allergens (cannot use with 'allergens')"),
      removeAllergens: z.array(z.string()).optional().describe("Remove allergens (cannot use with 'allergens')"),
    }),
    handler: async (params) => {
      const ingredient = await api.updateIngredient(params.id, params);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully updated ingredient!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
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
    description: "Delete an ingredient (soft delete/archive)",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteIngredient(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully deleted ingredient: ${id}\n\n${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_ingredient",
    description: "Duplicate an existing ingredient with optional modifications",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to duplicate"),
      name: z.string().optional().describe("New name for the duplicate"),
      aliases: z.array(z.string()).optional().describe("Override aliases"),
      categories: z.array(z.string()).optional().describe("Override categories"),
      allergens: z.array(z.string()).optional().describe("Override allergens"),
      supportedUnits: z
        .array(
          z.enum([
            "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
            "cup", "pint", "quart", "gallon", "piece", "free_text",
          ])
        )
        .optional()
        .describe("Override supported units"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Override nutritional information"),
      metadata: z.record(z.string()).optional().describe("Override metadata"),
    }),
    handler: async (params) => {
      const { id, ...overrides } = params;
      const ingredient = await api.duplicateIngredient(id, overrides);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully duplicated ingredient!\n\n` +
              `New Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Variant of: ${ingredient.variantOf || "N/A"}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}`,
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

  // ----------------------
  // Recipe Tools
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe with ingredients and steps",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z.number().optional().describe("Quantity (omit if using free text)"),
            unit: z
              .enum([
                "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
                "cup", "pint", "quart", "gallon", "piece", "free_text",
              ])
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe('Free text quantity (only used when unit is "free_text")'),
            note: z.string().optional().describe("Additional note (e.g., 'finely chopped')"),
          })
        )
        .describe("List of ingredients with quantities"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction text"),
            imageUrl: z.string().optional().describe("Optional image URL for this step"),
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
        .describe("Optional tags (e.g., 'vegan', 'spicy')"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional categories (e.g., 'dessert', 'italian')"),
      sourceUrl: z.string().optional().describe("Optional source URL"),
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
              `Successfully created recipe!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n` +
              `Source URL: ${recipe.sourceUrl || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${recipe.createdAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe (supports partial updates and array operations)",
    schema: z.object({
      id: z.string().describe("ID of the recipe to update"),
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New servings count"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum([
              "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
              "cup", "pint", "quart", "gallon", "piece", "free_text",
            ]),
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
      addTags: z.array(z.string()).optional().describe("Add tags (cannot use with 'tags')"),
      removeTags: z.array(z.string()).optional().describe("Remove tags (cannot use with 'tags')"),
      addCategories: z.array(z.string()).optional().describe("Add categories (cannot use with 'categories')"),
      removeCategories: z.array(z.string()).optional().describe("Remove categories (cannot use with 'categories')"),
    }),
    handler: async (params) => {
      const recipe = await api.updateRecipe(params.id, params);

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
              `Successfully updated recipe!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n\n` +
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
    description: "Delete a recipe (soft delete/archive)",
    schema: z.object({
      id: z.string().describe("ID of the recipe to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteRecipe(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully deleted recipe: ${id}\n\n${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description: "Duplicate an existing recipe with optional modifications",
    schema: z.object({
      id: z.string().describe("ID of the recipe to duplicate"),
      name: z.string().optional().describe("New name for the duplicate"),
      description: z.string().optional().describe("Override description"),
      servings: z.number().optional().describe("Override servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.enum([
              "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz",
              "cup", "pint", "quart", "gallon", "piece", "free_text",
            ]),
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
    handler: async (params) => {
      const { id, ...overrides } = params;
      const recipe = await api.duplicateRecipe(id, overrides);

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
              `Successfully duplicated recipe!\n\n` +
              `New Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Variant of: ${recipe.variantOf || "N/A"}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Created: ${recipe.createdAt}`,
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

  // ----------------------
  // Suggestion Tools
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for features, bugs, improvements, or other feedback",
    schema: z.object({
      title: z.string().describe("Brief title for the suggestion"),
      description: z.string().describe("Detailed description of the suggestion"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of suggestion (default: 'other')"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level (default: 'medium')"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional ID of a related recipe"),
    }),
    handler: async ({ title, description, category, priority, relatedRecipeId }) => {
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
              `Successfully created suggestion!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}\n` +
              `Related Recipe: ${suggestion.relatedRecipeId || "None"}\n\n` +
              `Description:\n${suggestion.description}\n\n` +
              `Submitted: ${suggestion.submittedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion (requires appropriate permissions)",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to update"),
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
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("New status"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("New related recipe ID"),
    }),
    handler: async (params) => {
      const suggestion = await api.updateSuggestion(params.id, params);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully updated suggestion!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}\n` +
              `Related Recipe: ${suggestion.relatedRecipeId || "None"}\n\n` +
              `Description:\n${suggestion.description}\n\n` +
              `Updated: ${suggestion.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Vote for a suggestion (or remove your vote if already voted)",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to vote for"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${result.voted ? "Added vote to" : "Removed vote from"} suggestion!\n\n` +
              `Title: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Total Votes: ${result.votes}\n` +
              `Status: ${result.status}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion (soft delete/archive)",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `Successfully deleted suggestion: ${id}\n\n${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description: "Duplicate an existing suggestion with optional modifications",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to duplicate"),
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
    handler: async (params) => {
      const { id, ...overrides } = params;
      const suggestion = await api.duplicateSuggestion(id, overrides);

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully duplicated suggestion!\n\n` +
              `New Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Variant of: ${suggestion.variantOf || "N/A"}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}\n\n` +
              `Description:\n${suggestion.description}\n\n` +
              `Created: ${suggestion.createdAt}`,
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
];
