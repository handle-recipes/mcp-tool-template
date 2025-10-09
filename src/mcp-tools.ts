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

  // ----------------------
  // Ingredient Write Operations
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z.array(z.string()).optional().describe("Alternate names or spellings"),
      categories: z.array(z.string()).optional().describe("Categories (e.g., 'vegetable', 'dairy')"),
      allergens: z.array(z.string()).optional().describe("Known allergens"),
      supportedUnits: z.array(z.string()).optional().describe("Units this ingredient can be measured in"),
      metadata: z.record(z.string()).optional().describe("Additional metadata as key-value pairs"),
    }),
    handler: async ({ name, aliases, categories, allergens, supportedUnits, metadata }) => {
      const result = await api.createIngredient({
        name,
        aliases,
        categories,
        allergens,
        supportedUnits: supportedUnits as any,
        metadata,
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
    description: "Update an existing ingredient",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update"),
      name: z.string().optional().describe("New name for the ingredient"),
      aliases: z.array(z.string()).optional().describe("New aliases"),
      categories: z.array(z.string()).optional().describe("New categories"),
      allergens: z.array(z.string()).optional().describe("New allergens"),
      supportedUnits: z.array(z.string()).optional().describe("New supported units"),
      metadata: z.record(z.string()).optional().describe("New metadata"),
    }),
    handler: async ({ id, name, aliases, categories, allergens, supportedUnits, metadata }) => {
      const result = await api.updateIngredient(id, {
        id,
        name,
        aliases,
        categories,
        allergens,
        supportedUnits: supportedUnits as any,
        metadata,
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
    name: "duplicate_ingredient",
    description: "Duplicate an existing ingredient with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to duplicate"),
      name: z.string().optional().describe("New name for the duplicated ingredient"),
      aliases: z.array(z.string()).optional().describe("New aliases"),
      categories: z.array(z.string()).optional().describe("New categories"),
      allergens: z.array(z.string()).optional().describe("New allergens"),
      supportedUnits: z.array(z.string()).optional().describe("New supported units"),
      metadata: z.record(z.string()).optional().describe("New metadata"),
    }),
    handler: async ({ id, name, aliases, categories, allergens, supportedUnits, metadata }) => {
      const result = await api.duplicateIngredient(id, {
        name,
        aliases,
        categories,
        allergens,
        supportedUnits: supportedUnits as any,
        metadata,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Duplicated ingredient: ${result.name} (${result.id})`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe Write Operations
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z.array(z.object({
        ingredientId: z.string().describe("ID of the ingredient"),
        quantity: z.number().optional().describe("Amount (if using unit)"),
        unit: z.string().describe("Unit of measurement"),
        quantityText: z.string().optional().describe("Free-text quantity (when unit is 'free_text')"),
        note: z.string().optional().describe("Additional notes"),
      })).describe("List of ingredients"),
      steps: z.array(z.object({
        text: z.string().describe("Step instruction"),
        equipment: z.array(z.string()).optional().describe("Required equipment"),
      })).describe("Cooking steps"),
      tags: z.array(z.string()).optional().describe("Tags for categorization"),
      categories: z.array(z.string()).optional().describe("Recipe categories"),
      sourceUrl: z.string().optional().describe("Source URL if adapted from another recipe"),
    }),
    handler: async ({ name, description, servings, ingredients, steps, tags, categories, sourceUrl }) => {
      const result = await api.createRecipe({
        name,
        description,
        servings,
        ingredients: ingredients as any,
        steps: steps as any,
        tags,
        categories,
        sourceUrl,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Created recipe: ${result.name} (${result.id})`,
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
      name: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New servings count"),
      ingredients: z.array(z.object({
        ingredientId: z.string(),
        quantity: z.number().optional(),
        unit: z.string(),
        quantityText: z.string().optional(),
        note: z.string().optional(),
      })).optional().describe("New ingredients list"),
      steps: z.array(z.object({
        text: z.string(),
        equipment: z.array(z.string()).optional(),
      })).optional().describe("New steps"),
      tags: z.array(z.string()).optional().describe("New tags"),
      categories: z.array(z.string()).optional().describe("New categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
    }),
    handler: async ({ id, name, description, servings, ingredients, steps, tags, categories, sourceUrl }) => {
      const result = await api.updateRecipe(id, {
        id,
        name,
        description,
        servings,
        ingredients: ingredients as any,
        steps: steps as any,
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
    name: "duplicate_recipe",
    description: "Duplicate an existing recipe with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to duplicate"),
      name: z.string().optional().describe("New name for the duplicated recipe"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("New servings count"),
      ingredients: z.array(z.object({
        ingredientId: z.string(),
        quantity: z.number().optional(),
        unit: z.string(),
        quantityText: z.string().optional(),
        note: z.string().optional(),
      })).optional().describe("New ingredients list"),
      steps: z.array(z.object({
        text: z.string(),
        equipment: z.array(z.string()).optional(),
      })).optional().describe("New steps"),
      tags: z.array(z.string()).optional().describe("New tags"),
      categories: z.array(z.string()).optional().describe("New categories"),
      sourceUrl: z.string().optional().describe("New source URL"),
    }),
    handler: async ({ id, name, description, servings, ingredients, steps, tags, categories, sourceUrl }) => {
      const result = await api.duplicateRecipe(id, {
        name,
        description,
        servings,
        ingredients: ingredients as any,
        steps: steps as any,
        tags,
        categories,
        sourceUrl,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Duplicated recipe: ${result.name} (${result.id})`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion Write Operations
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion",
    schema: z.object({
      title: z.string().describe("Suggestion title"),
      description: z.string().describe("Detailed description"),
      category: z.enum(["feature", "bug", "improvement", "other"]).optional().describe("Suggestion category"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level"),
      relatedRecipeId: z.string().optional().describe("ID of related recipe (if applicable)"),
    }),
    handler: async ({ title, description, category, priority, relatedRecipeId }) => {
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
            text: `Created suggestion: ${result.title} (${result.id})`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update an existing suggestion",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      category: z.enum(["feature", "bug", "improvement", "other"]).optional().describe("New category"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      status: z.enum(["submitted", "under-review", "accepted", "rejected", "implemented"]).optional().describe("New status"),
      relatedRecipeId: z.string().optional().describe("New related recipe ID"),
    }),
    handler: async ({ id, title, description, category, priority, status, relatedRecipeId }) => {
      const result = await api.updateSuggestion(id, {
        id,
        title,
        description,
        category,
        priority,
        status,
        relatedRecipeId,
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
    description: "Delete a suggestion by ID",
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
    name: "vote_suggestion",
    description: "Vote for a suggestion (toggle vote on/off)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote for"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text: `Vote ${result.voted ? "added" : "removed"} for suggestion: ${result.title} (${result.id})\nCurrent votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_suggestion",
    description: "Duplicate an existing suggestion with optional modifications",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to duplicate"),
      title: z.string().optional().describe("New title for the duplicated suggestion"),
      description: z.string().optional().describe("New description"),
      category: z.enum(["feature", "bug", "improvement", "other"]).optional().describe("New category"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      relatedRecipeId: z.string().optional().describe("New related recipe ID"),
    }),
    handler: async ({ id, title, description, category, priority, relatedRecipeId }) => {
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
            text: `Duplicated suggestion: ${result.title} (${result.id})`,
          },
        ],
      };
    },
  }),
];
