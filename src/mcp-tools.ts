import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import { Unit } from "./types";

// Zod schema for Unit enum
const UnitSchema = z.enum([
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
]);

// Zod schema for UnitConversion
const UnitConversionSchema = z.object({
  from: UnitSchema,
  to: UnitSchema,
  factor: z.number(),
});

// Zod schema for RecipeIngredient
const RecipeIngredientSchema = z.object({
  ingredientId: z.string(),
  quantity: z.number().optional(),
  unit: UnitSchema,
  quantityText: z.string().optional(),
  note: z.string().optional(),
});

// Zod schema for RecipeStep
const RecipeStepSchema = z.object({
  text: z.string(),
  imageUrl: z.string().optional(),
  equipment: z.array(z.string()).optional(),
});

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
              `Supported Units: ${
                ingredient.supportedUnits?.join(", ") || "None"
              }\n` +
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
    description:
      "List ingredients with optional filtering by categories, allergens, and name. " +
      "Filters are applied client-side after fetching ingredients.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of ingredients to return (default: 50)"),
      offset: z
        .number()
        .optional()
        .describe("Number of ingredients to skip for pagination (default: 0)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Filter by categories (e.g., ['dairy', 'protein', 'vegetable']). Matches ingredients with ANY of these categories."),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Filter by allergens - only return ingredients that HAVE these allergens (e.g., ['gluten', 'nuts'])."),
      allergenFree: z
        .array(z.string())
        .optional()
        .describe("Exclude ingredients with these allergens (e.g., ['gluten', 'dairy'] to find gluten-free, dairy-free options)."),
      nameSearch: z
        .string()
        .optional()
        .describe("Filter by partial name match (case-insensitive). Also searches aliases."),
    }),
    handler: async ({ limit, offset, categories, allergens, allergenFree, nameSearch }) => {
      // Fetch more ingredients if filtering
      const hasFilters = categories || allergens || allergenFree || nameSearch;
      const fetchLimit = hasFilters ? 500 : limit;

      const result = await api.listIngredients({ limit: fetchLimit, offset });
      let ingredients = result.ingredients;

      // Apply filters
      if (categories && categories.length > 0) {
        const lowerCategories = categories.map(c => c.toLowerCase());
        ingredients = ingredients.filter(ing =>
          ing.categories?.some(c => lowerCategories.includes(c.toLowerCase()))
        );
      }

      if (allergens && allergens.length > 0) {
        const lowerAllergens = allergens.map(a => a.toLowerCase());
        ingredients = ingredients.filter(ing =>
          ing.allergens?.some(a => lowerAllergens.includes(a.toLowerCase()))
        );
      }

      if (allergenFree && allergenFree.length > 0) {
        const lowerAllergenFree = allergenFree.map(a => a.toLowerCase());
        ingredients = ingredients.filter(ing =>
          !ing.allergens?.some(a => lowerAllergenFree.includes(a.toLowerCase()))
        );
      }

      if (nameSearch) {
        const searchLower = nameSearch.toLowerCase();
        ingredients = ingredients.filter(ing =>
          ing.name.toLowerCase().includes(searchLower) ||
          ing.aliases?.some(alias => alias.toLowerCase().includes(searchLower))
        );
      }

      // Apply limit after filtering
      if (hasFilters && limit) {
        ingredients = ingredients.slice(0, limit);
      }

      const ingredientsList = ingredients
        .map(
          (ing) =>
            `- ${ing.name} (${ing.id})` +
            (ing.categories?.length ? ` - Categories: ${ing.categories.join(", ")}` : "") +
            (ing.allergens?.length ? ` - Allergens: ${ing.allergens.join(", ")}` : "")
        )
        .join("\n");

      // Build filter summary
      const filterParts: string[] = [];
      if (categories?.length) filterParts.push(`categories: ${categories.join(", ")}`);
      if (allergens?.length) filterParts.push(`with allergens: ${allergens.join(", ")}`);
      if (allergenFree?.length) filterParts.push(`without allergens: ${allergenFree.join(", ")}`);
      if (nameSearch) filterParts.push(`name contains: "${nameSearch}"`);
      const filterSummary = filterParts.length > 0 ? `Filters: ${filterParts.join(", ")}\n\n` : "";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${filterSummary}Found ${ingredients.length} ingredients:\n\n${ingredientsList}\n\n` +
              `Has more results: ${hasFilters ? "filtering applied" : result.hasMore}`,
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
    description:
      "List recipes with optional filtering by tags, categories, ingredients, and servings. " +
      "Filters are applied client-side after fetching recipes.",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of recipes to return (default: 20)"),
      offset: z
        .number()
        .optional()
        .describe("Number of recipes to skip for pagination (default: 0)"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tags (e.g., ['vegan', 'quick']). Matches recipes with ANY of these tags."),
      categories: z
        .array(z.string())
        .optional()
        .describe("Filter by categories (e.g., ['dessert', 'italian']). Matches recipes with ANY of these categories."),
      ingredientIds: z
        .array(z.string())
        .optional()
        .describe("Filter by ingredient IDs. Use with ingredientMatch to control matching behavior."),
      ingredientMatch: z
        .enum(["any", "all"])
        .optional()
        .describe("How to match ingredients: 'any' (default) = recipes with at least one ingredient, 'all' = recipes with ALL specified ingredients"),
      minServings: z
        .number()
        .optional()
        .describe("Minimum number of servings"),
      maxServings: z
        .number()
        .optional()
        .describe("Maximum number of servings"),
    }),
    handler: async ({ limit, offset, tags, categories, ingredientIds, ingredientMatch, minServings, maxServings }) => {
      // Fetch more recipes if filtering, to ensure we have enough after filtering
      const hasFilters = tags || categories || ingredientIds || minServings !== undefined || maxServings !== undefined;
      const fetchLimit = hasFilters ? 200 : limit;

      const result = await api.listRecipes({ limit: fetchLimit, offset });
      let recipes = result.recipes;

      // Apply filters
      if (tags && tags.length > 0) {
        const lowerTags = tags.map(t => t.toLowerCase());
        recipes = recipes.filter(r =>
          r.tags?.some(t => lowerTags.includes(t.toLowerCase()))
        );
      }

      if (categories && categories.length > 0) {
        const lowerCategories = categories.map(c => c.toLowerCase());
        recipes = recipes.filter(r =>
          r.categories?.some(c => lowerCategories.includes(c.toLowerCase()))
        );
      }

      if (ingredientIds && ingredientIds.length > 0) {
        const matchAll = ingredientMatch === "all";
        recipes = recipes.filter(r => {
          const recipeIngredientIds = r.ingredients.map(i => i.ingredientId);
          if (matchAll) {
            return ingredientIds.every(id => recipeIngredientIds.includes(id));
          } else {
            return ingredientIds.some(id => recipeIngredientIds.includes(id));
          }
        });
      }

      if (minServings !== undefined) {
        recipes = recipes.filter(r => r.servings >= minServings);
      }

      if (maxServings !== undefined) {
        recipes = recipes.filter(r => r.servings <= maxServings);
      }

      // Apply limit after filtering
      if (hasFilters && limit) {
        recipes = recipes.slice(0, limit);
      }

      const recipesList = recipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings` +
            (recipe.tags?.length ? ` [${recipe.tags.join(", ")}]` : "")
        )
        .join("\n");

      // Build filter summary
      const filterParts: string[] = [];
      if (tags?.length) filterParts.push(`tags: ${tags.join(", ")}`);
      if (categories?.length) filterParts.push(`categories: ${categories.join(", ")}`);
      if (ingredientIds?.length) filterParts.push(`ingredients (${ingredientMatch || "any"}): ${ingredientIds.length} IDs`);
      if (minServings !== undefined) filterParts.push(`min servings: ${minServings}`);
      if (maxServings !== undefined) filterParts.push(`max servings: ${maxServings}`);
      const filterSummary = filterParts.length > 0 ? `Filters: ${filterParts.join(", ")}\n\n` : "";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${filterSummary}Found ${recipes.length} recipes:\n\n${recipesList}\n\n` +
              `Has more results: ${hasFilters ? "filtering applied" : result.hasMore}`,
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
    description:
      "List suggestions with optional filtering by status, category, priority, and text search. " +
      "Status filter uses the backend API; other filters are applied client-side.",
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
        .describe("Filter by suggestion status (uses backend API)"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Filter by suggestion category"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Filter by priority level"),
      textSearch: z
        .string()
        .optional()
        .describe("Search in title and description (case-insensitive)"),
      minVotes: z
        .number()
        .optional()
        .describe("Minimum vote count"),
    }),
    handler: async ({ limit, offset, status, category, priority, textSearch, minVotes }) => {
      // Fetch more suggestions if filtering client-side
      const hasClientFilters = category || priority || textSearch || minVotes !== undefined;
      const fetchLimit = hasClientFilters ? 100 : limit;

      const result = await api.listSuggestions({ limit: fetchLimit, offset, status });
      let suggestions = result.suggestions;

      // Apply client-side filters
      if (category) {
        suggestions = suggestions.filter(s => s.category === category);
      }

      if (priority) {
        suggestions = suggestions.filter(s => s.priority === priority);
      }

      if (textSearch) {
        const searchLower = textSearch.toLowerCase();
        suggestions = suggestions.filter(s =>
          s.title.toLowerCase().includes(searchLower) ||
          s.description.toLowerCase().includes(searchLower)
        );
      }

      if (minVotes !== undefined) {
        suggestions = suggestions.filter(s => s.votes >= minVotes);
      }

      // Apply limit after filtering
      if (hasClientFilters && limit) {
        suggestions = suggestions.slice(0, limit);
      }

      const suggestionsList = suggestions
        .map(
          (suggestion) =>
            `- [${suggestion.status.toUpperCase()}] ${suggestion.title} (${
              suggestion.id
            })\n` +
            `  Category: ${suggestion.category} | Priority: ${suggestion.priority} | Votes: ${suggestion.votes}\n` +
            `  ${suggestion.description.substring(0, 100)}${
              suggestion.description.length > 100 ? "..." : ""
            }`
        )
        .join("\n\n");

      // Build filter summary
      const filterParts: string[] = [];
      if (status) filterParts.push(`status: ${status}`);
      if (category) filterParts.push(`category: ${category}`);
      if (priority) filterParts.push(`priority: ${priority}`);
      if (textSearch) filterParts.push(`text contains: "${textSearch}"`);
      if (minVotes !== undefined) filterParts.push(`min votes: ${minVotes}`);
      const filterSummary = filterParts.length > 0 ? `Filters: ${filterParts.join(", ")}\n\n` : "";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `${filterSummary}Found ${suggestions.length} suggestions:\n\n${suggestionsList}\n\n` +
              `Has more results: ${hasClientFilters ? "filtering applied" : result.hasMore}`,
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
        .array(UnitSchema)
        .optional()
        .describe("Supported unit types for this ingredient"),
      unitConversions: z
        .array(UnitConversionSchema)
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
      const result = await api.createIngredient({
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
      supportedUnits: z.array(UnitSchema).optional().describe("Supported units"),
      unitConversions: z
        .array(UnitConversionSchema)
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
      const result = await api.updateIngredient(id, {
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
      id: z.string().describe("Ingredient ID to delete"),
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
      supportedUnits: z.array(UnitSchema).optional().describe("Supported units"),
      unitConversions: z
        .array(UnitConversionSchema)
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
      const result = await api.duplicateIngredient(id, {
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
      name: z.string().describe("Recipe name"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(RecipeIngredientSchema)
        .describe("List of ingredients with quantities"),
      steps: z
        .array(RecipeStepSchema)
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
      id: z.string().describe("Recipe ID to update"),
      name: z.string().optional().describe("New recipe name"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("Number of servings"),
      ingredients: z
        .array(RecipeIngredientSchema)
        .optional()
        .describe("Updated ingredients list"),
      steps: z
        .array(RecipeStepSchema)
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
      id: z.string().describe("Recipe ID to duplicate"),
      name: z.string().optional().describe("New name for duplicate"),
      description: z.string().optional().describe("New description"),
      servings: z.number().optional().describe("Number of servings"),
      ingredients: z
        .array(RecipeIngredientSchema)
        .optional()
        .describe("Modified ingredients list"),
      steps: z
        .array(RecipeStepSchema)
        .optional()
        .describe("Modified recipe steps"),
      tags: z.array(z.string()).optional().describe("Modified tags"),
      categories: z.array(z.string()).optional().describe("Modified categories"),
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
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
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
            text: result.message,
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
            text: `${result.voted ? "Voted for" : "Removed vote from"} suggestion: ${result.title} (${result.id})\nCurrent votes: ${result.votes}`,
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
