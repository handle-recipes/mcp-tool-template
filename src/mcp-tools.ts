import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import { createODATools } from "./oda-integration";
import { createODAWebScrapingTools } from "./oda-web-scraper";

export const createRecipeTools = (api: FirebaseFunctionsAPI, axiosInstance?: any) => [
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
              `Image: ${result.imageUrl || "No image available"}\n` +
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
            `- ${ing.name} (${ing.id}) - Categories: ${ing.categories.join(", ") || "None"
            }${ing.imageUrl ? ` - 📷 Image available` : ""}`
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
          return `- ${quantityText} (Ingredient ID: ${ing.ingredientId})${ing.note ? ` - ${ing.note}` : ""
            }`;
        })
        .join("\n");
      const stepsList = result.steps
        .map(
          (step, i) =>
            `${i + 1}. ${step.text}${step.equipment ? ` (Equipment: ${step.equipment.join(", ")})` : ""
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
              `Image: ${result.imageUrl || "No image available"}\n\n` +
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
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings${recipe.imageUrl ? ` - 📷 Image available` : ""}`
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
            )}...${recipe.imageUrl ? ` - 📷 Image available` : ""}`
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
      name: z.string().describe("The name of the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("Optional array of alternate names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional array of categories for the ingredient"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("Optional array of allergen tags for the ingredient"),
      imageUrl: z
        .string()
        .optional()
        .describe("Optional image URL for the ingredient"),
    }),
    handler: async ({ name, aliases, categories, allergens, imageUrl }) => {
      const result = await api.createIngredient({
        name,
        aliases: aliases || [],
        categories: categories || [],
        allergens: allergens || [],
        imageUrl,
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
              `Allergens: ${result.allergens.join(", ") || "None"}\n` +
              `Image: ${result.imageUrl || "No image provided"}`,
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
        .describe("New name for the ingredient"),
      aliases: z
        .array(z.string())
        .optional()
        .describe("New array of alternate names for the ingredient"),
      categories: z
        .array(z.string())
        .optional()
        .describe("New array of categories for the ingredient"),
      allergens: z
        .array(z.string())
        .optional()
        .describe("New array of allergen tags for the ingredient"),
      imageUrl: z
        .string()
        .optional()
        .describe("New image URL for the ingredient"),
    }),
    handler: async ({ id, name, aliases, categories, allergens, imageUrl }) => {
      const result = await api.updateIngredient(id, {
        name,
        aliases,
        categories,
        allergens,
        imageUrl,
      } as any);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated ingredient: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Aliases: ${result.aliases.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Allergens: ${result.allergens.join(", ") || "None"}\n` +
              `Image: ${result.imageUrl || "No image provided"}`,
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

  // ----------------------
  // Recipe Write Operations
  // ----------------------

  createMCPTool({
    name: "create_recipe",
    description: "Create a new recipe",
    schema: z.object({
      name: z.string().describe("The name of the recipe"),
      description: z.string().describe("Description of the recipe"),
      servings: z.number().describe("Number of servings the recipe makes"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity (required unless unit is 'free_text')"),
            unit: z
              .enum(["g", "kg", "ml", "l", "piece", "free_text"])
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Text description of quantity (required when unit is 'free_text')"),
            note: z
              .string()
              .optional()
              .describe("Optional note about the ingredient"),
          })
        )
        .describe("Array of ingredients for the recipe"),
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
        .describe("Array of cooking steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional array of tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Optional array of categories for the recipe"),
      sourceUrl: z
        .string()
        .optional()
        .describe("Optional source URL for the recipe"),
      imageUrl: z
        .string()
        .optional()
        .describe("Optional image URL for the recipe"),
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
      imageUrl,
    }) => {
      const result = await api.createRecipe({
        name,
        description,
        servings,
        ingredients,
        steps,
        tags: tags || [],
        categories: categories || [],
        sourceUrl,
        imageUrl,
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Created recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length} items\n` +
              `Steps: ${result.steps.length} steps\n` +
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Source URL: ${result.sourceUrl || "None"}\n` +
              `Image: ${result.imageUrl || "No image provided"}`,
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
      name: z.string().optional().describe("New name for the recipe"),
      description: z
        .string()
        .optional()
        .describe("New description for the recipe"),
      servings: z
        .number()
        .optional()
        .describe("New number of servings"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string().describe("ID of the ingredient"),
            quantity: z
              .number()
              .optional()
              .describe("Quantity (required unless unit is 'free_text')"),
            unit: z
              .enum(["g", "kg", "ml", "l", "piece", "free_text"])
              .describe("Unit of measurement"),
            quantityText: z
              .string()
              .optional()
              .describe("Text description of quantity (required when unit is 'free_text')"),
            note: z
              .string()
              .optional()
              .describe("Optional note about the ingredient"),
          })
        )
        .optional()
        .describe("New array of ingredients for the recipe"),
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
        .describe("New array of cooking steps"),
      tags: z
        .array(z.string())
        .optional()
        .describe("New array of tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("New array of categories for the recipe"),
      sourceUrl: z
        .string()
        .optional()
        .describe("New source URL for the recipe"),
      imageUrl: z
        .string()
        .optional()
        .describe("New image URL for the recipe"),
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
      imageUrl,
    }) => {
      const result = await api.updateRecipe(id, {
        name,
        description,
        servings,
        ingredients,
        steps,
        tags,
        categories,
        sourceUrl,
        imageUrl,
      } as any);
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Updated recipe: ${result.name}\n` +
              `ID: ${result.id}\n` +
              `Slug: ${result.slug}\n` +
              `Description: ${result.description}\n` +
              `Servings: ${result.servings}\n` +
              `Ingredients: ${result.ingredients.length} items\n` +
              `Steps: ${result.steps.length} steps\n` +
              `Tags: ${result.tags.join(", ") || "None"}\n` +
              `Categories: ${result.categories.join(", ") || "None"}\n` +
              `Source URL: ${result.sourceUrl || "None"}\n` +
              `Image: ${result.imageUrl || "No image provided"}`,
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

  // ----------------------
  // Image Management Tools
  // ----------------------

  createMCPTool({
    name: "find_recipes_with_images",
    description: "Find all recipes that have images",
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
      const recipesWithImages = result.recipes.filter(recipe => recipe.imageUrl);

      const recipesList = recipesWithImages
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings - 📷 ${recipe.imageUrl}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${recipesWithImages.length} recipes with images:\n\n${recipesList}\n\n` +
              `Total recipes checked: ${result.recipes.length}\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "find_ingredients_with_images",
    description: "Find all ingredients that have images",
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
      const ingredientsWithImages = result.ingredients.filter(ingredient => ingredient.imageUrl);

      const ingredientsList = ingredientsWithImages
        .map(
          (ingredient) =>
            `- ${ingredient.name} (${ingredient.id}) - Categories: ${ingredient.categories.join(", ") || "None"
            } - 📷 ${ingredient.imageUrl}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Found ${ingredientsWithImages.length} ingredients with images:\n\n${ingredientsList}\n\n` +
              `Total ingredients checked: ${result.ingredients.length}\n` +
              `Has more results: ${result.hasMore}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "search_recipes_by_image_presence",
    description: "Search recipes and filter by whether they have images or not",
    schema: z.object({
      query: z
        .string()
        .describe("Search terms to look for in recipe names and descriptions"),
      has_image: z
        .boolean()
        .describe("Whether to return only recipes with images (true) or without images (false)"),
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
    handler: async ({ query, has_image, ingredients, tags, categories, limit }) => {
      const result = await api.searchRecipes({
        query,
        ingredients,
        tags,
        categories,
        limit,
      });

      const filteredRecipes = result.recipes.filter(recipe =>
        has_image ? recipe.imageUrl : !recipe.imageUrl
      );

      const recipesList = filteredRecipes
        .map(
          (recipe) =>
            `- ${recipe.name} (${recipe.id}) - ${recipe.description.substring(
              0,
              100
            )}...${recipe.imageUrl ? ` - 📷 Image available` : " - No image"}`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Search results for "${result.query}" ${has_image ? "with images" : "without images"}:\n` +
              `Found: ${filteredRecipes.length} recipes\n` +
              `Total search results: ${result.totalFound}\n\n${recipesList}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "get_recipe_image_gallery",
    description: "Get all images from a recipe including the main image and step images",
    schema: z.object({
      id: z.string().describe("The ID of the recipe to get images for"),
    }),
    handler: async ({ id }) => {
      const result = await api.getRecipe(id);
      const images = [];

      // Add main recipe image
      if (result.imageUrl) {
        images.push({
          type: "main",
          url: result.imageUrl,
          description: `Main image for ${result.name}`
        });
      }

      // Add step images
      result.steps.forEach((step, index) => {
        if (step.imageUrl) {
          images.push({
            type: "step",
            url: step.imageUrl,
            description: `Step ${index + 1}: ${step.text.substring(0, 50)}...`,
            stepNumber: index + 1
          });
        }
      });

      const imageList = images
        .map(img =>
          `- ${img.type === "main" ? "📸 Main Image" : `📸 Step ${(img as any).stepNumber} Image`}: ${img.url}\n  ${img.description}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Image Gallery for "${result.name}":\n\n` +
              `${images.length > 0 ? imageList : "No images available for this recipe"}\n\n` +
              `Total images: ${images.length}`,
          },
        ],
      };
    },
  }),

  // ----------------------
  // ODA.no Integration Tools (API-based)
  // ----------------------
  ...(axiosInstance ? createODATools(api, axiosInstance) : []),

  // ----------------------
  // ODA.no Web Scraping Tools (POC)
  // ----------------------
  ...createODAWebScrapingTools(api),
];
