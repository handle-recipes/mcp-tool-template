import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import {
  areUnitsCompatible,
  convertPricePerUnit,
  roundToPrecision,
} from "./lib/unit-converter";
import { Unit } from "./types";

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
    name: "list_recipes_by_cost",
    description:
      "List recipes sorted by cost per serving (lowest to highest). Only includes recipes where all ingredients have price information.",
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
      // Get all recipes
      const result = await api.listRecipes({ limit: 1000 }); // Get a large batch to sort

      // Calculate cost for each recipe
      const recipesWithCost: Array<{
        id: string;
        name: string;
        servings: number;
        totalCost: number;
        costPerServing: number;
        hasAllPrices: boolean;
      }> = [];

      for (const recipe of result.recipes) {
        let totalCost = 0;
        let hasAllPrices = true;

        // Get full recipe details
        const fullRecipe = await api.getRecipe(recipe.id);

        // Calculate cost for each ingredient
        for (const recipeIngredient of fullRecipe.ingredients) {
          try {
            const ingredient = await api.getIngredient(
              recipeIngredient.ingredientId
            );

            // Check if we can calculate cost
            if (
              ingredient.price &&
              ingredient.priceUnit &&
              recipeIngredient.quantity &&
              recipeIngredient.unit !== "free_text"
            ) {
              if (
                areUnitsCompatible(
                  ingredient.priceUnit as Unit,
                  recipeIngredient.unit
                )
              ) {
                const pricePerRecipeUnit = convertPricePerUnit(
                  ingredient.price,
                  ingredient.priceUnit as Unit,
                  recipeIngredient.unit
                );
                totalCost += pricePerRecipeUnit * recipeIngredient.quantity;
              } else {
                hasAllPrices = false;
                break;
              }
            } else {
              hasAllPrices = false;
              break;
            }
          } catch {
            hasAllPrices = false;
            break;
          }
        }

        // Only include recipes with complete pricing
        if (hasAllPrices && fullRecipe.ingredients.length > 0) {
          const costPerServing =
            fullRecipe.servings > 0 ? totalCost / fullRecipe.servings : 0;
          recipesWithCost.push({
            id: fullRecipe.id,
            name: fullRecipe.name,
            servings: fullRecipe.servings,
            totalCost: roundToPrecision(totalCost, 2),
            costPerServing: roundToPrecision(costPerServing, 2),
            hasAllPrices,
          });
        }
      }

      // Sort by cost per serving
      recipesWithCost.sort((a, b) => a.costPerServing - b.costPerServing);

      // Apply pagination
      const startIndex = offset || 0;
      const endIndex = startIndex + (limit || 20);
      const paginatedRecipes = recipesWithCost.slice(startIndex, endIndex);

      // Format output
      const recipesList = paginatedRecipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id})\n` +
            `  Cost per serving: ${recipe.costPerServing} | Total cost: ${recipe.totalCost} | Servings: ${recipe.servings}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${recipesWithCost.length} recipes with complete pricing:\n\n${recipesList}\n\n` +
              `Showing ${paginatedRecipes.length} of ${recipesWithCost.length} recipes`,
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
  // Ingredient Write Operations
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("Name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names or spellings"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., 'dairy', 'protein', 'herb')"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Allergen tags (e.g., 'nuts', 'gluten', 'milk')"),
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
      name: z.string().optional().describe("Updated name"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Updated alternate names or spellings"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Updated categories"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Updated allergen tags"),
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
    name: "update_ingredient_price",
    description:
      "Update the price information for an ingredient. The price should be per the specified unit (e.g., price per kg, per lb, per piece).",
    schema: z.object({
      id: z.string().describe("ID of the ingredient to update"),
      price: z.number().describe("Price per unit"),
      priceUnit: z
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
        ])
        .describe("Unit for the price (e.g., kg, lb, piece)"),
      priceSource: z
        .string()
        .optional()
        .describe("Optional source of the price (e.g., store name, website)"),
    }),
    handler: async ({ id, price, priceUnit, priceSource }) => {
      const priceUpdatedAt = new Date().toISOString();
      const result = await api.updateIngredient(id, {
        id,
        price,
        priceUnit,
        priceSource,
        priceUpdatedAt,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated price for: ${result.name}\n` +
              `Price: ${result.price} per ${result.priceUnit}\n` +
              `Source: ${result.priceSource || "Not specified"}\n` +
              `Updated at: ${result.priceUpdatedAt}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Recipe Write Operations
  // ----------------------

  createMCPTool({
    name: "create_recipe_basic",
    description:
      "Create a new recipe with basic information (no ingredients or steps yet). Use add_recipe_ingredient and add_recipe_step to populate the recipe.",
    schema: z.object({
      name: z.string().describe("Name of the recipe"),
      description: z.string().describe("Recipe description"),
      servings: z.number().describe("Number of servings"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Tags (e.g., 'vegan', 'spicy')"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., 'dessert', 'norwegian')"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional source attribution URL"),
    }),
    handler: async ({
      name,
      description,
      servings,
      tags,
      categories,
      sourceUrl,
    }) => {
      const result = await api.createRecipe({
        name,
        description,
        servings,
        ingredients: [],
        steps: [],
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
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n\n` +
              `Next: Use add_recipe_ingredient and add_recipe_step to populate this recipe.`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "add_recipe_ingredient",
    description: "Add a single ingredient to an existing recipe",
    schema: z.object({
      recipeId: z.string().describe("ID of the recipe to add ingredient to"),
      ingredientId: z.string().describe("ID of the ingredient"),
      quantity: z.number().optional().describe("Quantity amount"),
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
        .describe("Unit of measurement"),
      quantityText: z
        .string()
        .optional()
        .describe("Free-form quantity text (for unit='free_text')"),
      note: z.string().optional().describe("Additional notes (e.g., 'chopped')"),
    }),
    handler: async ({
      recipeId,
      ingredientId,
      quantity,
      unit,
      quantityText,
      note,
    }) => {
      // First get the current recipe
      const recipe = await api.getRecipe(recipeId);

      // Add the new ingredient
      const updatedIngredients = [
        ...recipe.ingredients,
        { ingredientId, quantity, unit, quantityText, note },
      ];

      // Update the recipe
      const result = await api.updateRecipe(recipeId, {
        id: recipeId,
        ingredients: updatedIngredients,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Added ingredient to recipe: ${result.name}\n` +
              `Total ingredients: ${result.ingredients.length}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "add_recipe_step",
    description: "Add a single step to an existing recipe",
    schema: z.object({
      recipeId: z.string().describe("ID of the recipe to add step to"),
      text: z.string().describe("Step instruction text"),
      imageUrl: z.string().optional().describe("Optional image URL"),
      equipment: z
        .array(z.string())
        .optional()
        .describe("Optional equipment list (e.g., ['oven', 'mixing bowl'])"),
    }),
    handler: async ({ recipeId, text, imageUrl, equipment }) => {
      // First get the current recipe
      const recipe = await api.getRecipe(recipeId);

      // Add the new step
      const updatedSteps = [...recipe.steps, { text, imageUrl, equipment }];

      // Update the recipe
      const result = await api.updateRecipe(recipeId, {
        id: recipeId,
        steps: updatedSteps,
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Added step to recipe: ${result.name}\n` +
              `Total steps: ${result.steps.length}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description:
      "Update an existing recipe (advanced). For adding individual ingredients/steps, use add_recipe_ingredient and add_recipe_step instead.",
    schema: z.object({
      id: z.string().describe("ID of the recipe to update"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      servings: z.number().optional().describe("Updated servings count"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z.number().optional().describe("Quantity amount"),
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
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Free-form quantity text (for unit='free_text')"),
            note: z.string().optional().describe("Additional notes"),
          })
        )
        .optional()
        .describe("Updated list of ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Step instruction text"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment list"),
          })
        )
        .optional()
        .describe("Updated list of recipe steps"),
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
    name: "calculate_recipe_cost",
    description:
      "Calculate the total cost and cost per serving for a recipe based on ingredient prices. Handles unit conversions automatically.",
    schema: z.object({
      recipeId: z.string().describe("ID of the recipe to calculate cost for"),
    }),
    handler: async ({ recipeId }) => {
      // Get the recipe
      const recipe = await api.getRecipe(recipeId);

      // Track results
      let totalCost = 0;
      const ingredientCosts: Array<{
        name: string;
        quantity: number | string;
        unit: Unit;
        cost: number | null;
        note: string;
      }> = [];
      const missingPrices: string[] = [];

      // Calculate cost for each ingredient
      for (const recipeIngredient of recipe.ingredients) {
        const ingredient = await api.getIngredient(
          recipeIngredient.ingredientId
        );

        // Determine display quantity
        const displayQuantity =
          recipeIngredient.unit === "free_text"
            ? recipeIngredient.quantityText || "N/A"
            : recipeIngredient.quantity || 0;

        let cost: number | null = null;
        let note = "";

        // Check if ingredient has price information
        if (
          ingredient.price &&
          ingredient.priceUnit &&
          recipeIngredient.quantity &&
          recipeIngredient.unit !== "free_text"
        ) {
          try {
            // Check if units are compatible
            if (
              areUnitsCompatible(
                ingredient.priceUnit as Unit,
                recipeIngredient.unit
              )
            ) {
              // Convert price to recipe unit
              const pricePerRecipeUnit = convertPricePerUnit(
                ingredient.price,
                ingredient.priceUnit as Unit,
                recipeIngredient.unit
              );

              // Calculate cost for this ingredient
              cost = pricePerRecipeUnit * recipeIngredient.quantity;
              totalCost += cost;
              note = `${ingredient.price} per ${ingredient.priceUnit}`;
            } else {
              note = `Cannot convert ${ingredient.priceUnit} to ${recipeIngredient.unit}`;
              missingPrices.push(
                `${ingredient.name} (incompatible units: ${ingredient.priceUnit} vs ${recipeIngredient.unit})`
              );
            }
          } catch (error) {
            note = `Conversion error: ${error instanceof Error ? error.message : "Unknown error"}`;
            missingPrices.push(`${ingredient.name} (${note})`);
          }
        } else if (recipeIngredient.unit === "free_text") {
          note = "Free text quantity - cannot calculate";
          missingPrices.push(`${ingredient.name} (free text quantity)`);
        } else {
          note = "No price information available";
          missingPrices.push(ingredient.name);
        }

        ingredientCosts.push({
          name: ingredient.name,
          quantity: displayQuantity,
          unit: recipeIngredient.unit,
          cost: cost ? roundToPrecision(cost, 2) : null,
          note,
        });
      }

      // Calculate cost per serving
      const costPerServing =
        recipe.servings > 0 ? totalCost / recipe.servings : 0;

      // Format the breakdown
      const breakdownText = ingredientCosts
        .map((item) => {
          const costText = item.cost !== null ? `${item.cost}` : "N/A";
          return `- ${item.name}: ${item.quantity} ${item.unit} = ${costText} (${item.note})`;
        })
        .join("\n");

      const missingText =
        missingPrices.length > 0
          ? `\n\nMissing or incompatible prices:\n${missingPrices.map((name) => `- ${name}`).join("\n")}`
          : "";

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recipe: ${recipe.name}\n` +
              `Servings: ${recipe.servings}\n\n` +
              `Total Cost: ${roundToPrecision(totalCost, 2)}\n` +
              `Cost per Serving: ${roundToPrecision(costPerServing, 2)}\n\n` +
              `Ingredient Breakdown:\n${breakdownText}${missingText}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // Suggestion Operations
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for features, bugs, or improvements",
    schema: z.object({
      title: z.string().describe("Brief title of the suggestion"),
      description: z.string().describe("Detailed description"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of suggestion"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level"),
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
    description:
      "List suggestions with optional pagination and status filtering",
    schema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of suggestions to return"),
      offset: z
        .number()
        .optional()
        .describe("Number of suggestions to skip for pagination"),
      status: z
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .optional()
        .describe("Filter by status"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (sug) =>
            `- ${sug.title} (${sug.id})\n` +
            `  Status: ${sug.status} | Priority: ${sug.priority} | Votes: ${sug.votes}\n` +
            `  ${sug.description.substring(0, 80)}...`
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
    description: "Vote for a suggestion (toggles vote on/off)",
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
              `${result.voted ? "Voted for" : "Removed vote from"} suggestion: ${result.title}\n` +
              `ID: ${result.id}\n` +
              `Total votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description: "Update the status of a suggestion",
    schema: z.object({
      id: z.string().describe("ID of the suggestion to update"),
      status: z
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .describe("New status"),
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
