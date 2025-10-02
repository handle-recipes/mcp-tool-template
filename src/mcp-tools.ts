import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

export const createRecipeTools = (api: FirebaseFunctionsAPI) => [
  // ----------------------
  // Ingredient Tools
  // ----------------------
  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient in the recipe database. Use this when adding a new ingredient that doesn't exist yet. Returns the created ingredient with its generated ID.",
    schema: z.object({
      name: z.string().describe("Name of the ingredient (e.g., 'tomato', 'olive oil', 'chicken breast')"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternative names or spellings (e.g., ['roma tomato', 'plum tomato'] for 'tomato'). Pass as JSON array."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories this ingredient belongs to (e.g., ['vegetable', 'produce'], ['dairy', 'protein']). Pass as JSON array."),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergens present in this ingredient (e.g., ['nuts', 'gluten', 'dairy']). Pass as JSON array."),
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
    description: "Update an existing ingredient's properties. Use this to modify the name, aliases, categories, or allergens of an ingredient. Only include fields you want to change.",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to update (obtained from get_ingredient or list_ingredients)"),
      name: z.string().optional().describe("New name for the ingredient (if changing)"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("New complete list of alternative names (replaces existing). Pass as JSON array."),
      categories: z.array(z.string()).optional().describe("New complete list of categories (replaces existing). Pass as JSON array."),
      allergens: z.array(z.string()).optional().describe("New complete list of allergens (replaces existing). Pass as JSON array."),
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
    description: "Permanently delete an ingredient from the database. WARNING: This action cannot be undone. The ingredient will be soft-deleted (archived).",
    schema: z.object({
      id: z.string().describe("The ID of the ingredient to delete (obtained from get_ingredient or list_ingredients)"),
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
    name: "get_ingredient",
    description: "Retrieve detailed information about a single ingredient by its ID. Returns the ingredient's name, aliases, categories, allergens, and metadata.",
    schema: z.object({
      id: z.string().describe("The unique ID of the ingredient to retrieve"),
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
    description: "List all ingredients in the database with pagination support. Use this to browse available ingredients or find an ingredient ID. Returns a summary of each ingredient including name, ID, and categories.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of ingredients to return per page (default: 50, useful for browsing)"),
      offset: z
        .number()
        .optional()
        .describe("Number of ingredients to skip for pagination (default: 0). Use 50, 100, etc. to get next pages."),
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
    description: "Create a new recipe with ingredients and cooking steps. Use this to add a complete recipe to the database. You must specify ingredients (with their IDs from the ingredient database) and step-by-step instructions. Returns the created recipe with its generated ID and slug.",
    schema: z.object({
      name: z.string().describe("Name of the recipe (e.g., 'Spaghetti Carbonara', 'Chocolate Chip Cookies')"),
      description: z.string().describe("Brief description of the recipe, what it is, and why it's great (1-3 sentences)"),
      servings: z.number().describe("Number of servings this recipe makes (e.g., 4, 6, 12)"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of ingredient from the ingredient database (use list_ingredients or get_ingredient to find IDs)"),
            quantity: z.number().optional().describe("Numeric quantity (e.g., 200 for '200g', 2 for '2 cups'). Required unless unit is 'free_text'."),
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
            ]).describe("Unit of measurement. Use 'free_text' for descriptions like 'a pinch' or 'to taste', then use quantityText instead of quantity."),
            quantityText: z.string().optional().describe("Only use when unit='free_text' for text like 'a pinch', 'to taste', or '1 large'"),
            note: z.string().optional().describe("Optional preparation note (e.g., 'finely chopped', 'room temperature', 'divided')"),
          })
        )
        .describe("Array of ingredients with quantities. Pass as JSON array with objects. Each ingredient needs ingredientId and unit at minimum."),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text for this step (e.g., 'Preheat oven to 350°F', 'Mix flour and sugar')"),
            imageUrl: z.string().optional().describe("Optional URL to an image for this step"),
            equipment: z.array(z.string()).optional().describe("Optional equipment needed for this step (e.g., ['oven', 'mixing bowl']). Pass as JSON array."),
          })
        )
        .describe("Array of cooking steps in order. Pass as JSON array with objects. Each step needs at least 'text'."),
      tags: z.array(z.string()).optional().describe("Recipe tags for filtering (e.g., ['quick', 'vegetarian', 'comfort-food']). Pass as JSON array."),
      categories: z.array(z.string()).optional().describe("Recipe categories (e.g., ['dessert', 'italian', 'main-course']). Pass as JSON array."),
      sourceUrl: z.string().optional().describe("Optional URL to the original recipe source if adapted from elsewhere"),
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
    description: "Update an existing recipe's properties. Use this to modify any aspect of a recipe. Only include the fields you want to change. Note: ingredients and steps are replaced entirely, not merged.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update (obtained from get_recipe, list_recipes, or search_recipes)"),
      name: z.string().optional().describe("New name for the recipe (if changing)"),
      description: z.string().optional().describe("New description (if changing)"),
      servings: z.number().optional().describe("New number of servings (if changing)"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of ingredient from database"),
            quantity: z.number().optional().describe("Numeric quantity (required unless unit='free_text')"),
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
            ]).describe("Unit of measurement"),
            quantityText: z.string().optional().describe("Only for unit='free_text'"),
            note: z.string().optional().describe("Preparation note"),
          })
        )
        .optional()
        .describe("Complete new list of ingredients (replaces all existing). Pass as JSON array."),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z.array(z.string()).optional().describe("Equipment needed (JSON array)"),
          })
        )
        .optional()
        .describe("Complete new list of steps (replaces all existing). Pass as JSON array."),
      tags: z.array(z.string()).optional().describe("New complete list of tags (replaces existing). Pass as JSON array."),
      categories: z.array(z.string()).optional().describe("New complete list of categories (replaces existing). Pass as JSON array."),
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
    description: "Permanently delete a recipe from the database. WARNING: This action cannot be undone. The recipe will be soft-deleted (archived).",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to delete (obtained from get_recipe, list_recipes, or search_recipes)"),
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
    name: "get_recipe",
    description: "Retrieve complete details of a single recipe by its ID. Returns the full recipe including name, description, all ingredients with quantities, cooking steps, tags, categories, and metadata. Use this to view a complete recipe.",
    schema: z.object({
      id: z.string().describe("The unique ID of the recipe to retrieve"),
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
    description: "List all recipes in the database with pagination support. Use this to browse available recipes or find a recipe ID. Returns a summary of each recipe including name, ID, and servings count. For full recipe details, use get_recipe.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of recipes to return per page (default: 20, increase for more results)"),
      offset: z
        .number()
        .optional()
        .describe("Number of recipes to skip for pagination (default: 0). Use 20, 40, etc. to get next pages."),
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
      "Search for recipes using keywords with optional filtering by ingredients, tags, and categories. Use this when you need to find recipes by name, description content, or specific criteria. More powerful than list_recipes for finding specific recipes.",
    schema: z.object({
      query: z
        .string()
        .describe("Search keywords to look for in recipe names and descriptions (e.g., 'chocolate cake', 'spicy chicken', 'quick dinner')"),
      ingredients: z
        .array(z.string())
        .optional()
        .describe("Optional array of ingredient IDs to filter by. Only returns recipes containing ALL specified ingredients. Pass as JSON array."),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional array of tags to filter by (e.g., ['vegetarian', 'quick']). Pass as JSON array."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional array of categories to filter by (e.g., ['dessert', 'italian']). Pass as JSON array."),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (1-50, default: 20)"),
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
    description: "Submit a new suggestion for feature requests, bug reports, or improvements to the recipe system. Use this to track ideas, issues, or enhancements. Returns the created suggestion with status 'submitted'.",
    schema: z.object({
      title: z.string().describe("Brief, clear title summarizing the suggestion (e.g., 'Add nutrition info to recipes', 'Search is slow', 'Support meal planning')"),
      description: z.string().describe("Detailed description explaining the suggestion, why it's needed, and any relevant context (2-5 sentences)"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of the suggestion: 'feature' for new functionality, 'bug' for issues, 'improvement' for enhancements, 'other' for miscellaneous (default: 'other')"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level: 'low' for nice-to-have, 'medium' for should-have, 'high' for critical (default: 'medium')"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional ID of a related recipe if this suggestion is specific to a particular recipe"),
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
    description: "List all suggestions with optional filtering by status and pagination support. Use this to browse suggestions, check their status, and see vote counts. Returns a summary of each suggestion including title, status, priority, votes, and description preview.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Maximum number of suggestions to return per page (default: 20)"),
      offset: z
        .number()
        .optional()
        .describe("Number of suggestions to skip for pagination (default: 0). Use 20, 40, etc. to get next pages."),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("Filter by status: 'submitted' (new), 'under-review' (being evaluated), 'accepted' (approved), 'rejected' (declined), 'implemented' (completed). Omit to see all suggestions."),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (suggestion) =>
            `- ${suggestion.title} (${suggestion.id})\n` +
            `  Status: ${suggestion.status} | Priority: ${suggestion.priority} | Votes: ${suggestion.votes}\n` +
            `  ${suggestion.description.substring(0, 100)}...`
        )
        .join("\n\n");

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
    description: "Vote for a suggestion to show support, or remove your vote if already voted. This is a toggle action - voting again will remove your vote. Use this to indicate which suggestions are most important to your group. Returns whether the vote was added or removed.",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote on (obtained from list_suggestions)"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `${result.voted ? "Voted for" : "Removed vote from"} suggestion: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Total votes: ${result.votes}\n` +
              `Status: ${result.status}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update the status of a suggestion (admin/moderator operation). Use this to change a suggestion's workflow status as it progresses through review and implementation. Requires appropriate permissions.",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update (obtained from list_suggestions)"),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .describe("New status: 'submitted' (reset to new), 'under-review' (being evaluated), 'accepted' (approved for work), 'rejected' (declined/won't implement), 'implemented' (completed and deployed)"),
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
              `New status: ${result.status}\n` +
              `Priority: ${result.priority}\n` +
              `Votes: ${result.votes}`,
          },
        ],
      };
    },
  }),
];
