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
  // Smart Ingredient Tools
  // ----------------------

  createMCPTool({
    name: "find_or_create_ingredient",
    description:
      "Search for an ingredient by name. If found, return it. If not found, create it with the provided details.",
    schema: z.object({
      name: z.string().describe("The name of the ingredient to find or create"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names (used only if creating)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (used only if creating)"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (used only if creating)"),
    }),
    handler: async ({ name, aliases, categories, allergens }) => {
      // First, try to find existing ingredient by listing all and searching
      const allIngredients = await api.listIngredients({ limit: 1000 });
      const normalizedName = name.toLowerCase().trim();

      const existing = allIngredients.ingredients.find(
        (ing) =>
          ing.name.toLowerCase() === normalizedName ||
          ing.aliases.some((alias) => alias.toLowerCase() === normalizedName)
      );

      if (existing) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Found existing ingredient: ${existing.name}\n` +
                `ID: ${existing.id}\n` +
                `Aliases: ${existing.aliases.join(", ") || "None"}\n` +
                `Categories: ${existing.categories.join(", ") || "None"}\n` +
                `Allergens: ${existing.allergens.join(", ") || "None"}`,
            },
          ],
        };
      }

      // Not found, create new
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
              `Created new ingredient: ${result.name}\n` +
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
    name: "batch_create_ingredients",
    description:
      "Create multiple ingredients at once from a list. Skips ingredients that already exist.",
    schema: z.object({
      ingredients: z
        .array(
          z.object({
            name: z.string().describe("Ingredient name"),
            aliases: z.array(z.string()).optional().describe("Alternate names"),
            categories: z.array(z.string()).optional().describe("Categories"),
            allergens: z.array(z.string()).optional().describe("Allergens"),
          })
        )
        .describe("List of ingredients to create"),
    }),
    handler: async ({ ingredients }) => {
      // Get all existing ingredients
      const allIngredients = await api.listIngredients({ limit: 1000 });
      const existingNames = new Set(
        allIngredients.ingredients.map((ing) => ing.name.toLowerCase())
      );

      const results: { created: string[]; skipped: string[] } = {
        created: [],
        skipped: [],
      };

      for (const ing of ingredients) {
        const normalizedName = ing.name.toLowerCase().trim();
        if (existingNames.has(normalizedName)) {
          results.skipped.push(ing.name);
        } else {
          const result = await api.createIngredient(ing);
          results.created.push(result.name);
          existingNames.add(normalizedName);
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Batch ingredient creation complete:\n` +
              `Created: ${results.created.length} (${results.created.join(", ") || "None"})\n` +
              `Skipped (already exist): ${results.skipped.length} (${results.skipped.join(", ") || "None"})`,
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

  // ----------------------
  // Smart Recipe Tools
  // ----------------------

  createMCPTool({
    name: "add_recipe_with_ingredient_names",
    description:
      "Create a recipe using ingredient names instead of IDs. Automatically resolves ingredient names to IDs, creating missing ingredients as needed.",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientName: z
              .string()
              .describe("Name of the ingredient (will be resolved to ID)"),
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
              .describe("Unit"),
            quantityText: z
              .string()
              .optional()
              .describe("Free text quantity (for free_text unit)"),
            note: z.string().optional().describe("Additional note (e.g., chopped)"),
          })
        )
        .describe("List of recipe ingredients with names"),
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
      // Get all ingredients to resolve names to IDs
      const allIngredients = await api.listIngredients({ limit: 1000 });
      const ingredientMap = new Map(
        allIngredients.ingredients.map((ing) => [
          ing.name.toLowerCase(),
          ing.id,
        ])
      );

      // Also map aliases
      for (const ing of allIngredients.ingredients) {
        for (const alias of ing.aliases) {
          ingredientMap.set(alias.toLowerCase(), ing.id);
        }
      }

      const resolvedIngredients = [];
      const createdIngredients: string[] = [];

      for (const ing of ingredients) {
        const normalizedName = ing.ingredientName.toLowerCase().trim();
        let ingredientId = ingredientMap.get(normalizedName);

        // If not found, create it
        if (!ingredientId) {
          const newIng = await api.createIngredient({
            name: ing.ingredientName,
          });
          ingredientId = newIng.id;
          ingredientMap.set(normalizedName, ingredientId);
          createdIngredients.push(ing.ingredientName);
        }

        resolvedIngredients.push({
          ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          quantityText: ing.quantityText,
          note: ing.note,
        });
      }

      const result = await api.createRecipe({
        name,
        description,
        servings,
        ingredients: resolvedIngredients,
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
              `Steps: ${result.steps.length}\n` +
              (createdIngredients.length > 0
                ? `\nAuto-created ingredients: ${createdIngredients.join(", ")}`
                : ""),
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "duplicate_recipe",
    description: "Clone an existing recipe with a new name",
    schema: z.object({
      recipeId: z.string().describe("ID of the recipe to duplicate"),
      newName: z.string().describe("Name for the duplicated recipe"),
      modifyDescription: z
        .string()
        .optional()
        .describe("Optional new description (uses original if not provided)"),
    }),
    handler: async ({ recipeId, newName, modifyDescription }) => {
      const original = await api.getRecipe(recipeId);

      const result = await api.createRecipe({
        name: newName,
        description: modifyDescription || original.description,
        servings: original.servings,
        ingredients: original.ingredients,
        steps: original.steps,
        tags: original.tags,
        categories: original.categories,
        sourceUrl: original.sourceUrl,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Duplicated recipe from: ${original.name}\n` +
              `New recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "get_recipe_with_full_details",
    description:
      "Get a recipe with all ingredient IDs resolved to full ingredient details including names, allergens, and categories",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to retrieve"),
    }),
    handler: async ({ id }) => {
      const recipe = await api.getRecipe(id);

      // Fetch all ingredients referenced in the recipe
      const ingredientDetails = await Promise.all(
        recipe.ingredients.map((ing) => api.getIngredient(ing.ingredientId))
      );

      const ingredientsList = recipe.ingredients
        .map((ing, idx) => {
          const details = ingredientDetails[idx];
          const quantityText =
            ing.unit === "free_text"
              ? ing.quantityText
              : `${ing.quantity || ""} ${ing.unit}`;
          return (
            `- ${quantityText} ${details.name}` +
            (ing.note ? ` (${ing.note})` : "") +
            `\n  Categories: ${details.categories.join(", ") || "None"}` +
            `\n  Allergens: ${details.allergens.join(", ") || "None"}`
          );
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
              `Tags: ${recipe.tags.join(", ") || "None"}\n` +
              `Categories: ${recipe.categories.join(", ") || "None"}\n` +
              `Source URL: ${recipe.sourceUrl || "None"}\n\n` +
              `Ingredients (with details):\n${ingredientsList}\n\n` +
              `Steps:\n${stepsList}\n\n` +
              `Updated: ${recipe.updatedAt}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "search_recipes_by_allergen",
    description:
      "Find recipes that are safe for specific allergen restrictions (excludes recipes containing specified allergens)",
    schema: z.object({
      excludeAllergens: z
        .array(z.string())
        .describe("Allergens to exclude (e.g., ['nuts', 'gluten', 'dairy'])"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results (default: 20)"),
    }),
    handler: async ({ excludeAllergens, limit }) => {
      // Get all recipes and all ingredients
      const recipes = await api.listRecipes({ limit: limit || 20 });
      const allIngredients = await api.listIngredients({ limit: 1000 });

      // Create ingredient allergen map
      const ingredientAllergens = new Map(
        allIngredients.ingredients.map((ing) => [ing.id, ing.allergens])
      );

      // Filter recipes
      const normalizedExclusions = excludeAllergens.map((a) =>
        a.toLowerCase().trim()
      );
      const safeRecipes = recipes.recipes.filter((recipe) => {
        // Check if any ingredient has excluded allergens
        return !recipe.ingredients.some((recipeIng) => {
          const allergens = ingredientAllergens.get(recipeIng.ingredientId) || [];
          return allergens.some((allergen) =>
            normalizedExclusions.includes(allergen.toLowerCase())
          );
        });
      });

      const recipesList = safeRecipes
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
              `Found ${safeRecipes.length} recipes safe for allergen restrictions:\n` +
              `Excluding: ${excludeAllergens.join(", ")}\n\n${recipesList}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "search_recipes_by_available_ingredients",
    description:
      "Find recipes you can make with available ingredients. Returns recipes ranked by percentage of ingredients matched.",
    schema: z.object({
      availableIngredients: z
        .array(z.string())
        .describe("Names of ingredients you have available"),
      minimumMatch: z
        .number()
        .optional()
        .describe("Minimum percentage of ingredients to match (0-100, default: 50)"),
      limit: z.number().optional().describe("Maximum number of results (default: 10)"),
    }),
    handler: async ({ availableIngredients, minimumMatch, limit }) => {
      // Get all ingredients to resolve names
      const allIngredients = await api.listIngredients({ limit: 1000 });
      const ingredientNameToId = new Map(
        allIngredients.ingredients.map((ing) => [ing.name.toLowerCase(), ing.id])
      );

      // Also map aliases
      for (const ing of allIngredients.ingredients) {
        for (const alias of ing.aliases) {
          ingredientNameToId.set(alias.toLowerCase(), ing.id);
        }
      }

      const availableIds = new Set(
        availableIngredients
          .map((name) => ingredientNameToId.get(name.toLowerCase().trim()))
          .filter((id) => id !== undefined)
      );

      // Get all recipes
      const recipes = await api.listRecipes({ limit: 100 });

      // Calculate match percentage for each recipe
      const recipesWithMatch = recipes.recipes
        .map((recipe) => {
          const recipeIngredientIds = new Set(
            recipe.ingredients.map((ing) => ing.ingredientId)
          );
          const matchCount = [...recipeIngredientIds].filter((id) =>
            availableIds.has(id)
          ).length;
          const matchPercentage =
            (matchCount / recipeIngredientIds.size) * 100;

          return {
            recipe,
            matchPercentage,
            matchCount,
            totalIngredients: recipeIngredientIds.size,
          };
        })
        .filter((item) => item.matchPercentage >= (minimumMatch || 50))
        .sort((a, b) => b.matchPercentage - a.matchPercentage)
        .slice(0, limit || 10);

      const recipesList = recipesWithMatch
        .map(
          (item) =>
            `- ${item.recipe.name} (${item.recipe.id}) - ${Math.round(item.matchPercentage)}% match (${item.matchCount}/${item.totalIngredients} ingredients)`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${recipesWithMatch.length} recipes matching your available ingredients:\n\n${recipesList}`,
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
    name: "get_popular_suggestions",
    description:
      "List suggestions sorted by vote count (most popular first) with optional status filtering",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of suggestions to return (default: 20)"),
      status: z
        .enum(["submitted", "under-review", "accepted", "rejected", "implemented"])
        .optional()
        .describe("Filter by status"),
    }),
    handler: async ({ limit, status }) => {
      const result = await api.listSuggestions({
        limit: limit || 20,
        status,
      });

      // Sort by votes descending
      const sortedSuggestions = [...result.suggestions].sort(
        (a, b) => b.votes - a.votes
      );

      const suggestionsList = sortedSuggestions
        .map(
          (sugg) =>
            `- ${sugg.title} (${sugg.id})\n` +
            `  Votes: ${sugg.votes} | Category: ${sugg.category} | Priority: ${sugg.priority} | Status: ${sugg.status}\n` +
            `  Description: ${sugg.description.substring(0, 100)}${sugg.description.length > 100 ? "..." : ""}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${sortedSuggestions.length} suggestions (sorted by popularity):\n\n${suggestionsList}`,
          },
        ],
      };
    },
  }),

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
