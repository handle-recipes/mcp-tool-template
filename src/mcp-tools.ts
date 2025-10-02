import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import { UNITS, Unit, RecipeIngredient, RecipeStep } from "./types";

// ----------------------
// Validation helpers
// ----------------------

interface ValidationError {
  field: string;
  message: string;
  example?: string;
}

function validateRecipeIngredients(ingredients: any[]): {
  valid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (!Array.isArray(ingredients)) {
    return {
      valid: false,
      errors: [
        {
          field: "ingredients",
          message:
            "ingredients must be an array. Received: " + typeof ingredients,
          example: '[{"ingredientId": "egg", "quantity": 2, "unit": "piece"}]',
        },
      ],
    };
  }

  if (ingredients.length === 0) {
    errors.push({
      field: "ingredients",
      message: "Recipe must have at least one ingredient",
      example: '[{"ingredientId": "egg", "quantity": 2, "unit": "piece"}]',
    });
  }

  ingredients.forEach((ing, idx) => {
    if (!ing.ingredientId || typeof ing.ingredientId !== "string") {
      errors.push({
        field: `ingredients[${idx}].ingredientId`,
        message: `Missing or invalid ingredientId at index ${idx}. Must be a string ID.`,
        example: '"ingredientId": "tomato"',
      });
    }

    if (!ing.unit) {
      errors.push({
        field: `ingredients[${idx}].unit`,
        message: `Missing unit at index ${idx}. Must be one of: ${UNITS.join(
          ", "
        )}`,
        example: '"unit": "g" or "unit": "piece" or "unit": "free_text"',
      });
    } else if (!UNITS.includes(ing.unit as Unit)) {
      errors.push({
        field: `ingredients[${idx}].unit`,
        message: `Invalid unit "${
          ing.unit
        }" at index ${idx}. Must be one of: ${UNITS.join(", ")}`,
        example: '"unit": "g"',
      });
    }

    if (ing.unit === "free_text") {
      if (!ing.quantityText || typeof ing.quantityText !== "string") {
        errors.push({
          field: `ingredients[${idx}].quantityText`,
          message: `When unit is "free_text", quantityText is required at index ${idx}`,
          example: '"quantityText": "a pinch" or "to taste"',
        });
      }
    } else {
      if (
        ing.quantity === undefined ||
        ing.quantity === null ||
        typeof ing.quantity !== "number"
      ) {
        errors.push({
          field: `ingredients[${idx}].quantity`,
          message: `quantity is required and must be a number when unit is not "free_text" at index ${idx}`,
          example: '"quantity": 200',
        });
      } else if (ing.quantity <= 0) {
        errors.push({
          field: `ingredients[${idx}].quantity`,
          message: `quantity must be greater than 0 at index ${idx}. Received: ${ing.quantity}`,
          example: '"quantity": 200',
        });
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateRecipeSteps(steps: any[]): {
  valid: boolean;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (!Array.isArray(steps)) {
    return {
      valid: false,
      errors: [
        {
          field: "steps",
          message: "steps must be an array. Received: " + typeof steps,
          example: '[{"text": "Preheat oven to 180°C"}]',
        },
      ],
    };
  }

  if (steps.length === 0) {
    errors.push({
      field: "steps",
      message: "Recipe must have at least one step",
      example: '[{"text": "Mix ingredients together"}]',
    });
  }

  steps.forEach((step, idx) => {
    if (!step.text || typeof step.text !== "string") {
      errors.push({
        field: `steps[${idx}].text`,
        message: `Missing or invalid text at step ${idx}. Must be a non-empty string.`,
        example: '"text": "Preheat oven to 180°C"',
      });
    } else if (step.text.trim().length === 0) {
      errors.push({
        field: `steps[${idx}].text`,
        message: `Step text cannot be empty at index ${idx}`,
        example: '"text": "Mix all ingredients"',
      });
    }

    if (step.equipment !== undefined && !Array.isArray(step.equipment)) {
      errors.push({
        field: `steps[${idx}].equipment`,
        message: `equipment must be an array at step ${idx}. Received: ${typeof step.equipment}`,
        example: '"equipment": ["oven", "mixing bowl"]',
      });
    }

    if (step.imageUrl !== undefined && typeof step.imageUrl !== "string") {
      errors.push({
        field: `steps[${idx}].imageUrl`,
        message: `imageUrl must be a string at step ${idx}`,
        example: '"imageUrl": "https://example.com/image.jpg"',
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function formatValidationErrors(errors: ValidationError[]): string {
  let message = "Validation failed. Please fix the following errors:\n\n";
  errors.forEach((err, idx) => {
    message += `${idx + 1}. Field: ${err.field}\n`;
    message += `   Error: ${err.message}\n`;
    if (err.example) {
      message += `   Example: ${err.example}\n`;
    }
    message += "\n";
  });
  return message;
}

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
    name: "list_suggestions",
    description:
      "List all suggestions for the group with optional pagination and status filtering",
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
        .describe("Optional status to filter suggestions by"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (suggestion) =>
            `- ${suggestion.title} (${suggestion.id})\n` +
            `  Status: ${suggestion.status} | Category: ${suggestion.category} | Priority: ${suggestion.priority}\n` +
            `  Votes: ${
              suggestion.votes
            } | Description: ${suggestion.description.substring(0, 80)}...`
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

  // ----------------------
  // Write operations - Ingredients
  // ----------------------

  createMCPTool({
    name: "create_ingredient",
    description: "Create a new ingredient",
    schema: z.object({
      name: z.string().describe("The name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Alternate names or spellings for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories for the ingredient (e.g., dairy, protein, herb)"),
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
              `Successfully created ingredient!\n` +
              `ID: ${result.id}\n` +
              `Name: ${result.name}\n` +
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
      id: z.string().describe("The ID of the ingredient to update"),
      name: z
        .string()
        .optional()
        .describe("The updated name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Updated alternate names or spellings"),
      categories: z.array(z.string()).optional().describe("Updated categories"),
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
              `Successfully updated ingredient!\n` +
              `ID: ${result.id}\n` +
              `Name: ${result.name}\n` +
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

  // ----------------------
  // Write operations - Recipes
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("A description of the recipe"),
      servings: z.number().describe("Number of servings the recipe makes"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity (omit if using free_text unit)"),
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
              .describe("Unit of measurement for the ingredient"),
            quantityText: z
              .string()
              .optional()
              .describe('Free-form text when unit is "free_text"'),
            note: z
              .string()
              .optional()
              .describe("Additional note (e.g., chopped)"),
          })
        )
        .describe("List of ingredients for the recipe"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text for the step"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment for this step"),
          })
        )
        .describe("Ordered list of recipe steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Free-text tags (e.g., vegan, spicy)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories (e.g., dessert, norwegian)"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional source attribution URL"),
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
      // Step 1: Validate basic fields
      const basicErrors: ValidationError[] = [];

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        basicErrors.push({
          field: "name",
          message: "Recipe name is required and must be a non-empty string",
          example: '"name": "Chocolate Cake"',
        });
      }

      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length === 0
      ) {
        basicErrors.push({
          field: "description",
          message:
            "Recipe description is required and must be a non-empty string",
          example: '"description": "A delicious chocolate cake recipe"',
        });
      }

      if (
        servings === undefined ||
        servings === null ||
        typeof servings !== "number"
      ) {
        basicErrors.push({
          field: "servings",
          message: "servings is required and must be a number",
          example: '"servings": 4',
        });
      } else if (servings <= 0 || !Number.isInteger(servings)) {
        basicErrors.push({
          field: "servings",
          message: "servings must be a positive integer",
          example: '"servings": 4',
        });
      }

      if (basicErrors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(basicErrors),
            },
          ],
        };
      }

      // Step 2: Validate ingredients
      const ingredientsValidation = validateRecipeIngredients(ingredients);
      if (!ingredientsValidation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(ingredientsValidation.errors),
            },
          ],
        };
      }

      // Step 3: Validate steps
      const stepsValidation = validateRecipeSteps(steps);
      if (!stepsValidation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(stepsValidation.errors),
            },
          ],
        };
      }

      // Step 4: Validate optional fields
      const optionalErrors: ValidationError[] = [];

      if (tags !== undefined && !Array.isArray(tags)) {
        optionalErrors.push({
          field: "tags",
          message: "tags must be an array of strings",
          example: '"tags": ["vegan", "dessert"]',
        });
      }

      if (categories !== undefined && !Array.isArray(categories)) {
        optionalErrors.push({
          field: "categories",
          message: "categories must be an array of strings",
          example: '"categories": ["dessert", "norwegian"]',
        });
      }

      if (
        sourceUrl !== undefined &&
        sourceUrl !== null &&
        typeof sourceUrl !== "string"
      ) {
        optionalErrors.push({
          field: "sourceUrl",
          message: "sourceUrl must be a string",
          example: '"sourceUrl": "https://example.com/recipe"',
        });
      }

      if (optionalErrors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(optionalErrors),
            },
          ],
        };
      }

      // All validation passed, create the recipe
      try {
        const result = await api.createRecipe({
          name,
          description,
          servings,
          ingredients: ingredients as RecipeIngredient[],
          steps: steps as RecipeStep[],
          tags,
          categories,
          sourceUrl,
        });
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully created recipe!\n` +
                `ID: ${result.id}\n` +
                `Name: ${result.name}\n` +
                `Slug: ${result.slug}\n` +
                `Servings: ${result.servings}\n` +
                `Ingredients: ${result.ingredients.length}\n` +
                `Steps: ${result.steps.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to create recipe. API error:\n\n` +
                `${error.message || JSON.stringify(error)}\n\n` +
                `Please ensure all ingredient IDs exist in the system.`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "update_recipe",
    description: "Update an existing recipe",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("Updated name"),
      description: z.string().optional().describe("Updated description"),
      servings: z.number().optional().describe("Updated number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity (omit if using free_text unit)"),
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
              .describe("Unit of measurement for the ingredient"),
            quantityText: z
              .string()
              .optional()
              .describe('Free-form text when unit is "free_text"'),
            note: z
              .string()
              .optional()
              .describe("Additional note (e.g., chopped)"),
          })
        )
        .optional()
        .describe("Updated list of ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text for the step"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment for this step"),
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
              `Successfully updated recipe!\n` +
              `ID: ${result.id}\n` +
              `Name: ${result.name}\n` +
              `Slug: ${result.slug}\n` +
              `Servings: ${result.servings}`,
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

  // ----------------------
  // Partial update tools for recipes
  // ----------------------

  createMCPTool({
    name: "update_recipe_metadata",
    description:
      "Update only the metadata (name, description, servings, tags, categories, sourceUrl) of a recipe without changing ingredients or steps",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      name: z.string().optional().describe("Updated recipe name"),
      description: z.string().optional().describe("Updated description"),
      servings: z.number().optional().describe("Updated number of servings"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Updated tags (replaces existing tags)"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Updated categories (replaces existing categories)"),
      sourceUrl: z.string().optional().describe("Updated source URL"),
    }),
    handler: async ({
      id,
      name,
      description,
      servings,
      tags,
      categories,
      sourceUrl,
    }) => {
      const errors: ValidationError[] = [];

      if (
        servings !== undefined &&
        (servings <= 0 || !Number.isInteger(servings))
      ) {
        errors.push({
          field: "servings",
          message: "servings must be a positive integer",
          example: '"servings": 4',
        });
      }

      if (errors.length > 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(errors),
            },
          ],
        };
      }

      try {
        const result = await api.updateRecipe(id, {
          id,
          name,
          description,
          servings,
          tags,
          categories,
          sourceUrl,
        });
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully updated recipe metadata!\n` +
                `ID: ${result.id}\n` +
                `Name: ${result.name}\n` +
                `Description: ${result.description}\n` +
                `Servings: ${result.servings}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update recipe metadata. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "update_recipe_ingredients",
    description:
      "Update only the ingredients list of a recipe. This replaces all existing ingredients.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity (omit if using free_text unit)"),
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
              .describe("Unit of measurement for the ingredient"),
            quantityText: z
              .string()
              .optional()
              .describe('Free-form text when unit is "free_text"'),
            note: z
              .string()
              .optional()
              .describe("Additional note (e.g., chopped)"),
          })
        )
        .describe("Complete list of ingredients (replaces existing)"),
    }),
    handler: async ({ id, ingredients }) => {
      const ingredientsValidation = validateRecipeIngredients(ingredients);
      if (!ingredientsValidation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(ingredientsValidation.errors),
            },
          ],
        };
      }

      try {
        const result = await api.updateRecipe(id, {
          id,
          ingredients: ingredients as RecipeIngredient[],
        });
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully updated recipe ingredients!\n` +
                `Recipe: ${result.name}\n` +
                `Ingredients count: ${result.ingredients.length}\n\n` +
                `Ingredients:\n${result.ingredients
                  .map(
                    (ing, idx) =>
                      `${idx + 1}. ${ing.quantity || ""} ${
                        ing.unit === "free_text" ? ing.quantityText : ing.unit
                      } - Ingredient ID: ${ing.ingredientId}`
                  )
                  .join("\n")}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to update recipe ingredients. API error:\n\n${
                  error.message || JSON.stringify(error)
                }\n\n` +
                `Please ensure all ingredient IDs exist in the system.`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "update_recipe_steps",
    description:
      "Update only the steps/instructions of a recipe. This replaces all existing steps.",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to update"),
      steps: z
        .array(
          z.object({
            text: z.string().describe("Instruction text for the step"),
            imageUrl: z.string().optional().describe("Optional image URL"),
            equipment: z
              .array(z.string())
              .optional()
              .describe("Optional equipment for this step"),
          })
        )
        .describe("Complete ordered list of recipe steps (replaces existing)"),
    }),
    handler: async ({ id, steps }) => {
      const stepsValidation = validateRecipeSteps(steps);
      if (!stepsValidation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(stepsValidation.errors),
            },
          ],
        };
      }

      try {
        const result = await api.updateRecipe(id, {
          id,
          steps: steps as RecipeStep[],
        });
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully updated recipe steps!\n` +
                `Recipe: ${result.name}\n` +
                `Steps count: ${result.steps.length}\n\n` +
                `Steps:\n${result.steps
                  .map(
                    (step, idx) =>
                      `${idx + 1}. ${step.text.substring(0, 60)}...`
                  )
                  .join("\n")}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to update recipe steps. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  // ----------------------
  // Granular ingredient operations
  // ----------------------

  createMCPTool({
    name: "add_ingredient_to_recipe",
    description:
      "Add a single ingredient to an existing recipe. The ingredient is appended to the end of the ingredients list.",
    schema: z.object({
      recipeId: z
        .string()
        .describe("The ID of the recipe to add the ingredient to"),
      ingredientId: z.string().describe("ID of the ingredient to add"),
      quantity: z
        .number()
        .optional()
        .describe("Quantity (omit if using free_text unit)"),
      unit: z.enum(UNITS).describe("Unit of measurement"),
      quantityText: z
        .string()
        .optional()
        .describe('Free-form text when unit is "free_text"'),
      note: z.string().optional().describe("Additional note (e.g., chopped)"),
    }),
    handler: async ({
      recipeId,
      ingredientId,
      quantity,
      unit,
      quantityText,
      note,
    }) => {
      // Validate the new ingredient
      const validation = validateRecipeIngredients([
        { ingredientId, quantity, unit, quantityText, note },
      ]);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(validation.errors),
            },
          ],
        };
      }

      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        // Add new ingredient to the list
        const updatedIngredients = [
          ...currentRecipe.ingredients,
          {
            ingredientId,
            quantity,
            unit,
            quantityText,
            note,
          } as RecipeIngredient,
        ];

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          ingredients: updatedIngredients,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully added ingredient to recipe!\n` +
                `Recipe: ${result.name}\n` +
                `Added ingredient ID: ${ingredientId}\n` +
                `Total ingredients: ${result.ingredients.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to add ingredient. API error:\n\n${
                  error.message || JSON.stringify(error)
                }\n\n` +
                `Please ensure the recipe ID and ingredient ID exist in the system.`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "replace_ingredient_in_recipe",
    description:
      "Replace a specific ingredient in a recipe by its position/index (0-based). Use this to update the quantity, unit, or switch to a different ingredient.",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe"),
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the ingredient to replace"),
      ingredientId: z.string().describe("New ingredient ID"),
      quantity: z
        .number()
        .optional()
        .describe("New quantity (omit if using free_text unit)"),
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
        .describe("New unit of measurement"),
      quantityText: z
        .string()
        .optional()
        .describe('Free-form text when unit is "free_text"'),
      note: z.string().optional().describe("New additional note"),
    }),
    handler: async ({
      recipeId,
      index,
      ingredientId,
      quantity,
      unit,
      quantityText,
      note,
    }) => {
      // Validate the new ingredient
      const validation = validateRecipeIngredients([
        { ingredientId, quantity, unit, quantityText, note },
      ]);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(validation.errors),
            },
          ],
        };
      }

      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        if (index < 0 || index >= currentRecipe.ingredients.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Invalid index. Recipe has ${
                    currentRecipe.ingredients.length
                  } ingredients (indices 0-${
                    currentRecipe.ingredients.length - 1
                  }).\n` + `You provided index: ${index}`,
              },
            ],
          };
        }

        // Replace ingredient at index
        const updatedIngredients = [...currentRecipe.ingredients];
        updatedIngredients[index] = {
          ingredientId,
          quantity,
          unit,
          quantityText,
          note,
        } as RecipeIngredient;

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          ingredients: updatedIngredients,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully replaced ingredient at index ${index}!\n` +
                `Recipe: ${result.name}\n` +
                `New ingredient ID: ${ingredientId}\n` +
                `Total ingredients: ${result.ingredients.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to replace ingredient. API error:\n\n${
                  error.message || JSON.stringify(error)
                }\n\n` +
                `Please ensure the recipe ID and ingredient ID exist in the system.`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "remove_ingredient_from_recipe",
    description:
      "Remove a specific ingredient from a recipe by its position/index (0-based).",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe"),
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the ingredient to remove"),
    }),
    handler: async ({ recipeId, index }) => {
      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        if (index < 0 || index >= currentRecipe.ingredients.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Invalid index. Recipe has ${
                    currentRecipe.ingredients.length
                  } ingredients (indices 0-${
                    currentRecipe.ingredients.length - 1
                  }).\n` + `You provided index: ${index}`,
              },
            ],
          };
        }

        if (currentRecipe.ingredients.length === 1) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Cannot remove the last ingredient. A recipe must have at least one ingredient.`,
              },
            ],
          };
        }

        // Remove ingredient at index
        const removedIngredient = currentRecipe.ingredients[index];
        const updatedIngredients = currentRecipe.ingredients.filter(
          (_, i) => i !== index
        );

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          ingredients: updatedIngredients,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully removed ingredient at index ${index}!\n` +
                `Recipe: ${result.name}\n` +
                `Removed ingredient ID: ${removedIngredient.ingredientId}\n` +
                `Remaining ingredients: ${result.ingredients.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to remove ingredient. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  // ----------------------
  // Granular step operations
  // ----------------------

  createMCPTool({
    name: "add_step_to_recipe",
    description:
      "Add a single step to an existing recipe. The step is appended to the end of the steps list.",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe to add the step to"),
      text: z.string().describe("The instruction text for the new step"),
      imageUrl: z
        .string()
        .optional()
        .describe("Optional image URL for the step"),
      equipment: z
        .array(z.string())
        .optional()
        .describe("Optional equipment needed for this step"),
    }),
    handler: async ({ recipeId, text, imageUrl, equipment }) => {
      // Validate the new step
      const validation = validateRecipeSteps([{ text, imageUrl, equipment }]);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(validation.errors),
            },
          ],
        };
      }

      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        // Add new step to the list
        const updatedSteps = [
          ...currentRecipe.steps,
          { text, imageUrl, equipment } as RecipeStep,
        ];

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          steps: updatedSteps,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully added step to recipe!\n` +
                `Recipe: ${result.name}\n` +
                `New step: ${text.substring(0, 60)}...\n` +
                `Total steps: ${result.steps.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to add step. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "replace_step_in_recipe",
    description:
      "Replace a specific step in a recipe by its position/index (0-based). Use this to update the instruction text, image, or equipment.",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe"),
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the step to replace"),
      text: z.string().describe("New instruction text for the step"),
      imageUrl: z.string().optional().describe("New optional image URL"),
      equipment: z
        .array(z.string())
        .optional()
        .describe("New optional equipment list"),
    }),
    handler: async ({ recipeId, index, text, imageUrl, equipment }) => {
      // Validate the new step
      const validation = validateRecipeSteps([{ text, imageUrl, equipment }]);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(validation.errors),
            },
          ],
        };
      }

      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        if (index < 0 || index >= currentRecipe.steps.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Invalid index. Recipe has ${
                    currentRecipe.steps.length
                  } steps (indices 0-${currentRecipe.steps.length - 1}).\n` +
                  `You provided index: ${index}`,
              },
            ],
          };
        }

        // Replace step at index
        const updatedSteps = [...currentRecipe.steps];
        updatedSteps[index] = { text, imageUrl, equipment } as RecipeStep;

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          steps: updatedSteps,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully replaced step at index ${index}!\n` +
                `Recipe: ${result.name}\n` +
                `New step text: ${text.substring(0, 60)}...\n` +
                `Total steps: ${result.steps.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to replace step. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "remove_step_from_recipe",
    description:
      "Remove a specific step from a recipe by its position/index (0-based).",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe"),
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index of the step to remove"),
    }),
    handler: async ({ recipeId, index }) => {
      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        if (index < 0 || index >= currentRecipe.steps.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Invalid index. Recipe has ${
                    currentRecipe.steps.length
                  } steps (indices 0-${currentRecipe.steps.length - 1}).\n` +
                  `You provided index: ${index}`,
              },
            ],
          };
        }

        if (currentRecipe.steps.length === 1) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Cannot remove the last step. A recipe must have at least one step.`,
              },
            ],
          };
        }

        // Remove step at index
        const removedStep = currentRecipe.steps[index];
        const updatedSteps = currentRecipe.steps.filter((_, i) => i !== index);

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          steps: updatedSteps,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully removed step at index ${index}!\n` +
                `Recipe: ${result.name}\n` +
                `Removed step: ${removedStep.text.substring(0, 60)}...\n` +
                `Remaining steps: ${result.steps.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to remove step. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  createMCPTool({
    name: "insert_step_in_recipe",
    description:
      "Insert a step at a specific position in a recipe. Existing steps at or after this position will be shifted down.",
    schema: z.object({
      recipeId: z.string().describe("The ID of the recipe"),
      index: z
        .number()
        .int()
        .min(0)
        .describe("The 0-based index where the step should be inserted"),
      text: z.string().describe("The instruction text for the new step"),
      imageUrl: z
        .string()
        .optional()
        .describe("Optional image URL for the step"),
      equipment: z
        .array(z.string())
        .optional()
        .describe("Optional equipment needed for this step"),
    }),
    handler: async ({ recipeId, index, text, imageUrl, equipment }) => {
      // Validate the new step
      const validation = validateRecipeSteps([{ text, imageUrl, equipment }]);
      if (!validation.valid) {
        return {
          content: [
            {
              type: "text" as const,
              text: formatValidationErrors(validation.errors),
            },
          ],
        };
      }

      try {
        // Get current recipe
        const currentRecipe = await api.getRecipe(recipeId);

        if (index < 0 || index > currentRecipe.steps.length) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Invalid index. Recipe has ${currentRecipe.steps.length} steps. You can insert at indices 0-${currentRecipe.steps.length} (inclusive).\n` +
                  `You provided index: ${index}`,
              },
            ],
          };
        }

        // Insert step at index
        const updatedSteps = [...currentRecipe.steps];
        updatedSteps.splice(index, 0, {
          text,
          imageUrl,
          equipment,
        } as RecipeStep);

        // Update recipe
        const result = await api.updateRecipe(recipeId, {
          id: recipeId,
          steps: updatedSteps,
        });

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Successfully inserted step at index ${index}!\n` +
                `Recipe: ${result.name}\n` +
                `New step: ${text.substring(0, 60)}...\n` +
                `Total steps: ${result.steps.length}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to insert step. API error:\n\n${
                error.message || JSON.stringify(error)
              }`,
            },
          ],
        };
      }
    },
  }),

  // ----------------------
  // Write operations - Suggestions
  // ----------------------

  createMCPTool({
    name: "create_suggestion",
    description: "Create a new suggestion for a feature, bug, or improvement",
    schema: z.object({
      title: z.string().describe("Brief title of the suggestion"),
      description: z
        .string()
        .describe("Detailed description of the suggestion"),
      category: z
        .enum(["feature", "bug", "improvement", "other"])
        .optional()
        .describe("Category of the suggestion (default: other)"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Priority level (default: medium)"),
      relatedRecipeId: z
        .string()
        .optional()
        .describe("Optional ID of a related recipe"),
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
              `Successfully created suggestion!\n` +
              `ID: ${result.id}\n` +
              `Title: ${result.title}\n` +
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
    name: "vote_suggestion",
    description:
      "Vote on a suggestion (toggles vote - adds if not voted, removes if already voted)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to vote on"),
    }),
    handler: async ({ id }) => {
      const result = await api.voteSuggestion(id);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Vote ${result.voted ? "added" : "removed"}!\n` +
              `Suggestion: ${result.title}\n` +
              `Total votes: ${result.votes}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "update_suggestion",
    description:
      "Update the status of a suggestion (requires appropriate permissions)",
    schema: z.object({
      id: z.string().describe("The ID of the suggestion to update"),
      status: z
        .enum([
          "submitted",
          "under-review",
          "accepted",
          "rejected",
          "implemented",
        ])
        .describe("New status for the suggestion"),
    }),
    handler: async ({ id, status }) => {
      const result = await api.updateSuggestion(id, { id, status });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Successfully updated suggestion status!\n` +
              `ID: ${result.id}\n` +
              `Title: ${result.title}\n` +
              `Status: ${result.status}\n` +
              `Votes: ${result.votes}`,
          },
        ],
      };
    },
  }),
];
