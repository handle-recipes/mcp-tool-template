import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

interface ODAConfig {
    userAgent: string;
    clientToken: string;
    baseUrl: string;
}

// ODA.no API integration class
class ODAIntegration {
    private config: ODAConfig;
    private axios: any;

    constructor(config: ODAConfig, axiosInstance: any) {
        this.config = config;
        this.axios = axiosInstance;
    }

    private getHeaders() {
        return {
            "User-Agent": `${this.config.userAgent}/1.0`,
            "X-Client-Token": this.config.clientToken,
            "Accept": "application/json",
            "Content-Type": "application/json",
        };
    }

    async searchProducts(query: string, limit: number = 20) {
        try {
            const response = await this.axios.get(`${this.config.baseUrl}/api/v1/search/`, {
                params: { q: query, limit },
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to search products: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getProductDetails(productId: string) {
        try {
            const response = await this.axios.get(`${this.config.baseUrl}/api/v1/products/${productId}/`, {
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get product details: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async addToCart(items: Array<{ product_id: string; quantity: number }>) {
        try {
            const response = await this.axios.post(`${this.config.baseUrl}/api/v1/cart/items/`, {
                items,
            }, {
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to add items to cart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getCart() {
        try {
            const response = await this.axios.get(`${this.config.baseUrl}/api/v1/cart/`, {
                headers: this.getHeaders(),
            });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get cart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async searchIngredients(ingredientNames: string[]) {
        const results = [];
        for (const ingredientName of ingredientNames) {
            try {
                const searchResults = await this.searchProducts(ingredientName, 5);
                if (searchResults.results && searchResults.results.length > 0) {
                    results.push({
                        ingredient: ingredientName,
                        products: searchResults.results.map((product: any) => ({
                            id: product.id,
                            name: product.name,
                            price: product.price,
                            unit: product.unit,
                            image: product.images?.[0]?.url,
                        })),
                    });
                }
            } catch (error) {
                results.push({
                    ingredient: ingredientName,
                    error: `Failed to search: ${error instanceof Error ? error.message : String(error)}`,
                    products: [],
                });
            }
        }
        return results;
    }
}

export const createODATools = (api: FirebaseFunctionsAPI, axiosInstance: any) => {
    // ODA configuration - these would typically come from environment variables
    const odaConfig: ODAConfig = {
        userAgent: process.env.ODA_USER_AGENT || "RecipeMCP/1.0",
        clientToken: process.env.ODA_CLIENT_TOKEN || "",
        baseUrl: process.env.ODA_BASE_URL || "https://oda.com/no",
    };

    const oda = new ODAIntegration(odaConfig, axiosInstance);

    return [
        createMCPTool({
            name: "search_oda_products",
            description: "Search for products on ODA.no by name or description",
            schema: z.object({
                query: z.string().describe("Search query for products"),
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of results to return (default: 20)"),
            }),
            handler: async ({ query, limit = 20 }) => {
                try {
                    const results = await oda.searchProducts(query, limit);
                    const productsList = results.results
                        ?.map(
                            (product: any) =>
                                `- ${product.name} (ID: ${product.id}) - ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}`
                        )
                        .join("\n") || "No products found";

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `ODA.no Search Results for "${query}":\n\n${productsList}\n\n` +
                                    `Total found: ${results.count || 0} products`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error searching ODA.no: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),

        createMCPTool({
            name: "get_oda_product_details",
            description: "Get detailed information about a specific ODA.no product",
            schema: z.object({
                product_id: z.string().describe("ODA.no product ID"),
            }),
            handler: async ({ product_id }) => {
                try {
                    const product = await oda.getProductDetails(product_id);
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Product: ${product.name}\n` +
                                    `ID: ${product.id}\n` +
                                    `Price: ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}\n` +
                                    `Description: ${product.description || "No description"}\n` +
                                    `Category: ${product.category?.name || "No category"}\n` +
                                    `Available: ${product.available ? "Yes" : "No"}\n` +
                                    `Image: ${product.images?.[0]?.url || "No image available"}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting product details: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),

        createMCPTool({
            name: "add_recipe_ingredients_to_oda_cart",
            description: "Add all ingredients from a recipe to ODA.no shopping cart",
            schema: z.object({
                recipe_id: z.string().describe("ID of the recipe to add ingredients for"),
                servings_multiplier: z
                    .number()
                    .optional()
                    .describe("Multiply ingredient quantities by this factor (default: 1)"),
            }),
            handler: async ({ recipe_id, servings_multiplier = 1 }) => {
                try {
                    // Get the recipe details
                    const recipe = await api.getRecipe(recipe_id);

                    // Search for each ingredient on ODA.no
                    const ingredientNames = recipe.ingredients.map(ing => {
                        // Try to get the ingredient name from our database
                        return ing.ingredientId; // We'll need to fetch the actual ingredient name
                    });

                    // For now, we'll use a simplified approach
                    const searchResults = await oda.searchIngredients(
                        recipe.ingredients.map(ing => `ingredient ${ing.ingredientId}`)
                    );

                    const cartItems = [];
                    const results = [];

                    for (let i = 0; i < recipe.ingredients.length; i++) {
                        const recipeIngredient = recipe.ingredients[i];
                        const searchResult = searchResults[i];

                        if (searchResult.products.length > 0) {
                            // Use the first matching product
                            const product = searchResult.products[0];
                            const quantity = Math.ceil((recipeIngredient.quantity || 1) * servings_multiplier);

                            cartItems.push({
                                product_id: product.id,
                                quantity: quantity,
                            });

                            results.push(
                                `✅ ${product.name} - ${quantity} ${recipeIngredient.unit || "piece"} - ${product.price} kr`
                            );
                        } else {
                            results.push(
                                `❌ ${searchResult.ingredient} - No matching product found on ODA.no`
                            );
                        }
                    }

                    if (cartItems.length > 0) {
                        await oda.addToCart(cartItems);
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Added ingredients from "${recipe.name}" to ODA.no cart:\n\n${results.join("\n")}\n\n` +
                                    `Total items added: ${cartItems.length}\n` +
                                    `Items not found: ${results.filter(r => r.startsWith("❌")).length}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error adding recipe ingredients to ODA.no cart: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),

        createMCPTool({
            name: "add_ingredients_to_oda_cart",
            description: "Add specific ingredients to ODA.no shopping cart by searching and selecting products",
            schema: z.object({
                ingredients: z
                    .array(
                        z.object({
                            name: z.string().describe("Name of the ingredient"),
                            quantity: z.number().describe("Quantity needed"),
                            unit: z.string().optional().describe("Unit of measurement"),
                        })
                    )
                    .describe("Array of ingredients to add to cart"),
            }),
            handler: async ({ ingredients }) => {
                try {
                    const searchResults = await oda.searchIngredients(
                        ingredients.map(ing => ing.name)
                    );

                    const cartItems = [];
                    const results = [];

                    for (let i = 0; i < ingredients.length; i++) {
                        const ingredient = ingredients[i];
                        const searchResult = searchResults[i];

                        if (searchResult.products.length > 0) {
                            // Use the first matching product
                            const product = searchResult.products[0];

                            cartItems.push({
                                product_id: product.id,
                                quantity: ingredient.quantity,
                            });

                            results.push(
                                `✅ ${product.name} - ${ingredient.quantity} ${ingredient.unit || "piece"} - ${product.price} kr`
                            );
                        } else {
                            results.push(
                                `❌ ${ingredient.name} - No matching product found on ODA.no`
                            );
                        }
                    }

                    if (cartItems.length > 0) {
                        await oda.addToCart(cartItems);
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Added ingredients to ODA.no cart:\n\n${results.join("\n")}\n\n` +
                                    `Total items added: ${cartItems.length}\n` +
                                    `Items not found: ${results.filter(r => r.startsWith("❌")).length}`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error adding ingredients to ODA.no cart: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),

        createMCPTool({
            name: "get_oda_cart",
            description: "Get current contents of ODA.no shopping cart",
            schema: z.object({}),
            handler: async () => {
                try {
                    const cart = await oda.getCart();
                    const itemsList = cart.items
                        ?.map(
                            (item: any) =>
                                `- ${item.product.name} - ${item.quantity} ${item.product.unit || "piece"} - ${item.product.price} kr`
                        )
                        .join("\n") || "Cart is empty";

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `ODA.no Shopping Cart:\n\n${itemsList}\n\n` +
                                    `Total items: ${cart.items?.length || 0}\n` +
                                    `Total price: ${cart.total_price || 0} kr`,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error getting ODA.no cart: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),

        createMCPTool({
            name: "find_oda_products_for_recipe",
            description: "Find ODA.no products that match recipe ingredients",
            schema: z.object({
                recipe_id: z.string().describe("ID of the recipe to find products for"),
                max_products_per_ingredient: z
                    .number()
                    .optional()
                    .describe("Maximum number of product suggestions per ingredient (default: 3)"),
            }),
            handler: async ({ recipe_id, max_products_per_ingredient = 3 }) => {
                try {
                    const recipe = await api.getRecipe(recipe_id);

                    const searchResults = await oda.searchIngredients(
                        recipe.ingredients.map(ing => `ingredient ${ing.ingredientId}`)
                    );

                    let results = `Product suggestions for "${recipe.name}" ingredients:\n\n`;

                    for (let i = 0; i < recipe.ingredients.length; i++) {
                        const recipeIngredient = recipe.ingredients[i];
                        const searchResult = searchResults[i];

                        results += `\n${recipeIngredient.ingredientId}:\n`;

                        if (searchResult.products.length > 0) {
                            const products = searchResult.products.slice(0, max_products_per_ingredient);
                            products.forEach((product: any, index: number) => {
                                results += `  ${index + 1}. ${product.name} - ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}\n`;
                            });
                        } else {
                            results += `  No products found on ODA.no\n`;
                        }
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: results,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error finding ODA.no products for recipe: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),
    ];
};
