import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  // ----------------------
  // Ingredient Tools
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
      name: z.string().describe("Ingredient name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names or spellings"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dairy, protein, herb)"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g., nuts, gluten, milk)"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Nutritional information per 100g/100ml"),
      metadata: z
        .record(z.string())
        .optional()
        .describe("Additional metadata as key-value pairs"),
      supportedUnits: z
        .array(
          z.enum([
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
        )
        .optional()
        .describe("Supported unit types for this ingredient"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum([
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
            to: z.enum([
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
            factor: z.number(),
          })
        )
        .optional()
        .describe("Unit conversion rates"),
    }),
    handler: async ({
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      metadata,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        metadata,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `✅ Ingredient created successfully!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Supported Units: ${ingredient.supportedUnits?.join(", ") || "None"}\n` +
              `Created: ${ingredient.createdAt}\n` +
              `Created by Group: ${ingredient.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_ingredient",
    description: "Update an existing ingredient",
    schema: z.object({
      id: z.string().describe("Ingredient ID to update"),
      name: z.string().optional().describe("New ingredient name"),
      aliases: z.array(z.string()).optional().describe("Alternate names"),
      categories: z.array(z.string()).optional().describe("Categories"),
      allergens: z.array(z.string()).optional().describe("Allergen tags"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Nutritional information"),
      metadata: z.record(z.string()).optional().describe("Additional metadata"),
      supportedUnits: z
        .array(
          z.enum([
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
        )
        .optional()
        .describe("Supported units"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum([
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
            to: z.enum([
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
            factor: z.number(),
          })
        )
        .optional()
        .describe("Unit conversions"),
    }),
    handler: async ({
      id,
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      metadata,
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
        metadata,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `✅ Ingredient updated successfully!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Aliases: ${ingredient.aliases?.join(", ") || "None"}\n` +
              `Categories: ${ingredient.categories?.join(", ") || "None"}\n` +
              `Allergens: ${ingredient.allergens?.join(", ") || "None"}\n` +
              `Updated: ${ingredient.updatedAt}\n` +
              `Updated by Group: ${ingredient.updatedByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_ingredient",
    description: "Delete an ingredient by ID",
    schema: z.object({
      id: z.string().describe("Ingredient ID to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteIngredient(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_ingredient",
    description: "Duplicate an existing ingredient with optional modifications",
    schema: z.object({
      id: z.string().describe("Ingredient ID to duplicate"),
      name: z.string().optional().describe("New name for duplicate"),
      aliases: z.array(z.string()).optional().describe("Alternate names"),
      categories: z.array(z.string()).optional().describe("Categories"),
      allergens: z.array(z.string()).optional().describe("Allergen tags"),
      nutrition: z
        .object({
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbohydrates: z.number().optional(),
          fat: z.number().optional(),
          fiber: z.number().optional(),
        })
        .optional()
        .describe("Nutritional information"),
      metadata: z.record(z.string()).optional().describe("Additional metadata"),
      supportedUnits: z
        .array(
          z.enum([
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
        )
        .optional()
        .describe("Supported units"),
      unitConversions: z
        .array(
          z.object({
            from: z.enum([
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
            to: z.enum([
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
            factor: z.number(),
          })
        )
        .optional()
        .describe("Unit conversions"),
    }),
    handler: async ({
      id,
      name,
      aliases,
      categories,
      allergens,
      nutrition,
      metadata,
      supportedUnits,
      unitConversions,
    }) => {
      const ingredient = await api.duplicateIngredient(id, {
        name,
        aliases,
        categories,
        allergens,
        nutrition,
        metadata,
        supportedUnits,
        unitConversions,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `✅ Ingredient duplicated successfully!\n\n` +
              `Ingredient: ${ingredient.name}\n` +
              `ID: ${ingredient.id}\n` +
              `Variant of: ${ingredient.variantOf || "None"}\n` +
              `Created: ${ingredient.createdAt}\n` +
              `Created by Group: ${ingredient.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe Tools
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
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
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
          })
        )
        .describe("List of ingredients with quantities"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .describe("Recipe steps in order"),
      tags: z.array(z.string()).optional().describe("Recipe tags"),
      categories: z.array(z.string()).optional().describe("Recipe categories"),
      sourceUrl: z.string().optional().describe("Source URL for attribution"),
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
              `✅ Recipe created successfully!\n\n` +
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
              `Created: ${recipe.createdAt}\n` +
              `Created by Group: ${recipe.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe",
    schema: z.object({
      id: z.string().describe("Recipe ID to update"),
      name: z.string().optional().describe("New recipe name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("Number of servings"),
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
          })
        )
        .optional()
        .describe("Updated ingredients list"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("Updated recipe steps"),
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
              `✅ Recipe updated successfully!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Description: ${recipe.description}\n` +
              `Servings: ${recipe.servings}\n` +
              `Tags: ${recipe.tags?.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories?.join(", ") || "None"}\n\n` +
              `Ingredients:\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Updated: ${recipe.updatedAt}\n` +
              `Updated by Group: ${recipe.updatedByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_recipe",
    description: "Delete a recipe by ID",
    schema: z.object({
      id: z.string().describe("Recipe ID to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteRecipe(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description: "Duplicate an existing recipe with optional modifications",
    schema: z.object({
      id: z.string().describe("Recipe ID to duplicate"),
      name: z.string().optional().describe("New name for duplicate"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("Number of servings"),
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
          })
        )
        .optional()
        .describe("Modified ingredients list"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            imageUrl: z.string().optional(),
            equipment: z.array(z.string()).optional(),
          })
        )
        .optional()
        .describe("Modified recipe steps"),
      tags: z.array(z.string()).optional().describe("Modified tags"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Modified categories"),
      sourceUrl: z.string().optional().describe("Modified source URL"),
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
              `✅ Recipe duplicated successfully!\n\n` +
              `Recipe: ${recipe.name}\n` +
              `ID: ${recipe.id}\n` +
              `Slug: ${recipe.slug}\n` +
              `Variant of: ${recipe.variantOf || "None"}\n` +
              `Created: ${recipe.createdAt}\n` +
              `Created by Group: ${recipe.createdByGroupId}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion Tools
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
      title: z.string().describe("Suggestion title"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Suggestion category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level"),
      relatedRecipeId: z.string().optional().describe("Related recipe ID"),
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
              `✅ Suggestion created successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Description: ${suggestion.description}\n` +
              `Votes: ${suggestion.votes}\n` +
              `Related Recipe: ${suggestion.relatedRecipeId || "None"}\n` +
              `Submitted: ${suggestion.submittedAt}\n` +
              `Submitted by Group: ${suggestion.submittedByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion",
    schema: z.object({
      id: z.string().describe("Suggestion ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("New category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("New priority"),
      relatedRecipeId: z.string().optional().describe("Related recipe ID"),
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
              `✅ Suggestion updated successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Status: ${suggestion.status}\n` +
              `Votes: ${suggestion.votes}\n` +
              `Updated: ${suggestion.updatedAt}\n` +
              `Updated by Group: ${suggestion.updatedByGroupId}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "delete_suggestion",
    description: "Delete a suggestion by ID",
    schema: z.object({
      id: z.string().describe("Suggestion ID to delete"),
    }),
    handler: async ({ id }) => {
      const result = await api.deleteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ ${result.message}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "vote_suggestion",
    description: "Vote on a suggestion (toggles vote on/off)",
    schema: z.object({
      id: z.string().describe("Suggestion ID to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `✅ Vote ${result.voted ? "added" : "removed"}!\n\n` +
              `Title: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Total Votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description: "Duplicate an existing suggestion with optional modifications",
    schema: z.object({
      id: z.string().describe("Suggestion ID to duplicate"),
      title: z.string().optional().describe("New title for duplicate"),
      description: z.string().optional().describe("New description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("New category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("New priority"),
      relatedRecipeId: z.string().optional().describe("Related recipe ID"),
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
              `✅ Suggestion duplicated successfully!\n\n` +
              `Title: ${suggestion.title}\n` +
              `ID: ${suggestion.id}\n` +
              `Variant of: ${suggestion.variantOf || "None"}\n` +
              `Category: ${suggestion.category}\n` +
              `Priority: ${suggestion.priority}\n` +
              `Created: ${suggestion.createdAt}\n` +
              `Created by Group: ${suggestion.createdByGroupId}`,
          },
        ],
      };
    },
  }),
];
