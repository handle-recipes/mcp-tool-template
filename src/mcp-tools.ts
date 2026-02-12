import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

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
            }`,
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
            }`,
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
            `- ${recipe.name} (${recipe.id}) - ${recipe.servings} servings`,
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
              100,
            )}...`,
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
      "List suggestions with optional pagination and status filtering",
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
        .describe("Filter by suggestion status"),
    }),
    handler: async ({ limit, offset, status }) => {
      const result = await api.listSuggestions({ limit, offset, status });
      const suggestionsList = result.suggestions
        .map(
          (suggestion) =>
            `- [${suggestion.status.toUpperCase()}] ${suggestion.title} (${suggestion.id})\n` +
            `  Category: ${suggestion.category} | Priority: ${suggestion.priority} | Votes: ${suggestion.votes}\n` +
            `  ${suggestion.description.substring(0, 100)}${suggestion.description.length > 100 ? "..." : ""}`,
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
    name: "add_recipe",
    description: "Create a new recipe for the group",
    schema: z.object({
      name: z.string().describe("Recipe name"),
      description: z.string().optional().describe("Short description"),
      servings: z.number().optional().describe("Number of servings"),
      tags: z.array(z.string()).optional().describe("Tags for the recipe"),
      categories: z
        .array(z.string())
        .optional()
        .describe("Categories for the recipe"),
      slug: z.string().optional().describe("Optional slug"),
      sourceUrl: z.string().optional().describe("Source URL"),
      ingredients: z
        .array(
          z.object({
            ingredientId: z.string(),
            quantity: z.number().optional(),
            unit: z.string().optional(),
            quantityText: z.string().optional(),
            note: z.string().optional(),
          }),
        )
        .optional()
        .describe("Array of ingredients"),
      steps: z
        .array(
          z.object({
            text: z.string(),
            equipment: z.array(z.string()).optional(),
          }),
        )
        .optional()
        .describe("Array of step objects"),
    }),
    handler: async (params) => {
      const requestBody = {
        name: params.name,
        description: params.description,
        servings: params.servings,
        tags: params.tags,
        categories: params.categories,
        slug: params.slug,
        sourceUrl: params.sourceUrl,
        ingredients: params.ingredients,
        steps: params.steps,
      } as any;

      const created = await api.createRecipe(requestBody);
      return {
        content: [
          {
            type: "text" as const,
            text: `Created recipe ${created.id} - ${created.name || params.name}`,
          },
        ],
      };
    },
  }),

  createMCPTool({
    name: "export_hackathon",
    description: "Export selected recipes as JSON bundle for hackathon/backup",
    schema: z.object({
      ids: z
        .array(z.string())
        .optional()
        .describe("Optional list of recipe IDs to export"),
      limit: z
        .number()
        .optional()
        .describe("Optional limit for listing recipes"),
      offset: z
        .number()
        .optional()
        .describe("Optional offset for listing recipes"),
    }),
    handler: async ({ ids, limit, offset }) => {
      let recipes: any[] = [];
      if (ids && ids.length > 0) {
        for (const id of ids) {
          try {
            const r = await api.getRecipe(id);
            recipes.push(r);
          } catch (err) {
            // skip missing
          }
        }
      } else {
        const res = await api.listRecipes({ limit, offset } as any);
        recipes = res.recipes || [];
      }

      // Generate a PDF bundle from recipes and return as base64 data URL
      const pdfBase64 = await (async function generatePdf(recipesArr: any[]) {
        return new Promise<string>((resolve, reject) => {
          try {
            const doc = new PDFDocument({ autoFirstPage: false });
            const pass = new PassThrough();
            const chunks: Buffer[] = [];
            doc.pipe(pass);
            pass.on("data", (chunk: Buffer) => chunks.push(chunk));
            pass.on("end", () => {
              const buf = Buffer.concat(chunks);
              resolve(buf.toString("base64"));
            });
            pass.on("error", (err) => reject(err));

            if (recipesArr.length === 0) {
              doc.addPage();
              doc
                .fontSize(14)
                .text("No recipes to export", { align: "center" });
            }

            for (const r of recipesArr) {
              doc.addPage({ margin: 40 });
              doc
                .fontSize(16)
                .text(r.name || "Unnamed recipe", { underline: true });
              doc.moveDown(0.5);
              doc.fontSize(10).text(`ID: ${r.id || "N/A"}`);
              if (r.servings) doc.text(`Servings: ${r.servings}`);
              if (r.tags && r.tags.length)
                doc.text(`Tags: ${r.tags.join(", ")}`);
              doc.moveDown(0.5);

              if (r.description) {
                doc.fontSize(12).text("Description:");
                doc.fontSize(10).text(r.description);
                doc.moveDown(0.5);
              }

              doc.fontSize(12).text("Ingredients:");
              doc.fontSize(10);
              if (r.ingredients && r.ingredients.length) {
                for (const ing of r.ingredients) {
                  const quantityText =
                    ing.unit === "free_text"
                      ? ing.quantityText || ""
                      : `${ing.quantity ?? ""} ${ing.unit ?? ""}`;
                  doc.text(
                    `- ${quantityText} (Ingredient ID: ${ing.ingredientId || ing.id || ""})${ing.note ? ` — ${ing.note}` : ""}`,
                  );
                }
              } else {
                doc.text("- None");
              }

              doc.moveDown(0.5);
              doc.fontSize(12).text("Steps:");
              doc.fontSize(10);
              if (r.steps && r.steps.length) {
                for (let i = 0; i < r.steps.length; i++) {
                  const step = r.steps[i];
                  doc.text(`${i + 1}. ${step.text}`);
                }
              } else {
                doc.text("- None");
              }
            }

            doc.end();
          } catch (err) {
            reject(err);
          }
        });
      })(recipes);

      const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

      return {
        content: [
          {
            type: "text" as const,
            text: dataUrl,
          },
        ],
      };
    },
  }),
];
