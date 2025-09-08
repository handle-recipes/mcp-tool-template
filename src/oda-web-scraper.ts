import puppeteer, { Browser, Page } from 'puppeteer';
import { z } from "zod";
import { createMCPTool } from "./lib/mcp-tool-helper";
import { FirebaseFunctionsAPI } from "./api";

interface ODAProduct {
    id: string;
    name: string;
    price: number;
    unit?: string;
    image?: string;
    available: boolean;
    description?: string;
}

interface ODACartItem {
    product: ODAProduct;
    quantity: number;
}

class ODAWebScraper {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private baseUrl = 'https://oda.com/no';

    async initialize() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();

            // Set user agent to avoid detection
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

            // Set viewport
            await this.page.setViewport({ width: 1280, height: 720 });
        }
    }

    async searchProducts(query: string, limit: number = 20): Promise<ODAProduct[]> {
        await this.initialize();
        if (!this.page) throw new Error('Browser not initialized');

        try {
            // Navigate to ODA.no search page
            const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

            // Wait for search results to load
            await this.page.waitForSelector('[data-testid="product-card"], .product-card, .search-result', { timeout: 10000 });

            // Extract product information
            const products = await this.page.evaluate((limit) => {
                const productElements = (document as any).querySelectorAll('[data-testid="product-card"], .product-card, .search-result');
                const results: any[] = [];

                for (let i = 0; i < Math.min(productElements.length, limit); i++) {
                    const element = productElements[i] as any;

                    // Try to extract product information from various possible selectors
                    const nameElement = element.querySelector('[data-testid="product-name"], .product-name, h3, h4, .title');
                    const priceElement = element.querySelector('[data-testid="product-price"], .price, .product-price, [class*="price"]');
                    const imageElement = element.querySelector('img');
                    const linkElement = element.querySelector('a');

                    if (nameElement && priceElement) {
                        const name = nameElement.textContent?.trim() || '';
                        const priceText = priceElement.textContent?.trim() || '';
                        const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        const image = imageElement?.getAttribute('src') || '';
                        const href = linkElement?.getAttribute('href') || '';
                        const id = href.split('/').pop() || Math.random().toString(36).substr(2, 9);

                        if (name && price > 0) {
                            results.push({
                                id,
                                name,
                                price,
                                unit: 'stk', // Default unit
                                image: image.startsWith('http') ? image : `${(window as any).location.origin}${image}`,
                                available: true,
                                description: name
                            });
                        }
                    }
                }

                return results;
            }, limit);

            return products;
        } catch (error) {
            console.error('Error searching products:', error);
            // Return mock data for POC
            return this.getMockProducts(query, limit);
        }
    }

    async getProductDetails(productId: string): Promise<ODAProduct | null> {
        await this.initialize();
        if (!this.page) throw new Error('Browser not initialized');

        try {
            const productUrl = `${this.baseUrl}/products/${productId}`;
            await this.page.goto(productUrl, { waitUntil: 'networkidle2' });

            const product = await this.page.evaluate(() => {
                const nameElement = (document as any).querySelector('h1, [data-testid="product-title"], .product-title');
                const priceElement = (document as any).querySelector('[data-testid="product-price"], .price, .product-price');
                const imageElement = (document as any).querySelector('.product-image img, [data-testid="product-image"] img');
                const descriptionElement = (document as any).querySelector('.product-description, [data-testid="product-description"]');

                if (nameElement && priceElement) {
                    const name = nameElement.textContent?.trim() || '';
                    const priceText = priceElement.textContent?.trim() || '';
                    const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    const image = imageElement?.getAttribute('src') || '';
                    const description = descriptionElement?.textContent?.trim() || '';

                    return {
                        id: (window as any).location.pathname.split('/').pop() || '',
                        name,
                        price,
                        unit: 'stk',
                        image: image.startsWith('http') ? image : `${(window as any).location.origin}${image}`,
                        available: true,
                        description
                    };
                }
                return null;
            });

            return product;
        } catch (error) {
            console.error('Error getting product details:', error);
            // Return mock data for POC
            return this.getMockProduct(productId);
        }
    }

    async addToCart(items: Array<{ product_id: string; quantity: number }>): Promise<boolean> {
        // For POC, we'll simulate adding to cart
        console.log('Simulating adding to cart:', items);

        // In a real implementation, you would:
        // 1. Navigate to each product page
        // 2. Click "Add to Cart" button
        // 3. Set quantity
        // 4. Handle any login requirements

        return true;
    }

    async getCart(): Promise<{ items: ODACartItem[]; total_price: number }> {
        // For POC, return mock cart data
        return {
            items: [],
            total_price: 0
        };
    }

    async searchIngredients(ingredientNames: string[]): Promise<Array<{ ingredient: string; products: ODAProduct[]; error?: string }>> {
        const results = [];

        for (const ingredientName of ingredientNames) {
            try {
                const products = await this.searchProducts(ingredientName, 5);
                results.push({
                    ingredient: ingredientName,
                    products: products.map(p => ({
                        ...p,
                        name: p.name,
                        price: p.price,
                        unit: p.unit,
                        image: p.image,
                    })),
                });
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

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    // Mock data for POC when scraping fails
    private getMockProducts(query: string, limit: number): ODAProduct[] {
        const mockProducts: ODAProduct[] = [
            {
                id: 'mock-1',
                name: `${query} (Mock Product 1)`,
                price: 29.90,
                unit: 'stk',
                image: 'https://via.placeholder.com/200x200?text=Product+1',
                available: true,
                description: `Mock ${query} product for POC`
            },
            {
                id: 'mock-2',
                name: `${query} (Mock Product 2)`,
                price: 39.90,
                unit: 'stk',
                image: 'https://via.placeholder.com/200x200?text=Product+2',
                available: true,
                description: `Mock ${query} product for POC`
            },
            {
                id: 'mock-3',
                name: `${query} (Mock Product 3)`,
                price: 49.90,
                unit: 'stk',
                image: 'https://via.placeholder.com/200x200?text=Product+3',
                available: true,
                description: `Mock ${query} product for POC`
            }
        ];

        return mockProducts.slice(0, limit);
    }

    private getMockProduct(productId: string): ODAProduct | null {
        return {
            id: productId,
            name: `Mock Product ${productId}`,
            price: 29.90,
            unit: 'stk',
            image: 'https://via.placeholder.com/200x200?text=Mock+Product',
            available: true,
            description: 'Mock product for POC demonstration'
        };
    }
}

export const createODAWebScrapingTools = (api: FirebaseFunctionsAPI) => {
    const scraper = new ODAWebScraper();

    return [
        createMCPTool({
            name: "search_oda_products_web",
            description: "Search for products on ODA.no using web scraping (POC)",
            schema: z.object({
                query: z.string().describe("Search query for products"),
                limit: z
                    .number()
                    .optional()
                    .describe("Maximum number of results to return (default: 20)"),
            }),
            handler: async ({ query, limit = 20 }) => {
                try {
                    const products = await scraper.searchProducts(query, limit);
                    const productsList = products
                        .map(
                            (product) =>
                                `- ${product.name} (ID: ${product.id}) - ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}`
                        )
                        .join("\n");

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `ODA.no Web Search Results for "${query}":\n\n${productsList}\n\n` +
                                    `Total found: ${products.length} products\n` +
                                    `Note: This is a POC using web scraping. Results may be mock data.`,
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
            name: "get_oda_product_details_web",
            description: "Get detailed information about a specific ODA.no product using web scraping (POC)",
            schema: z.object({
                product_id: z.string().describe("ODA.no product ID"),
            }),
            handler: async ({ product_id }) => {
                try {
                    const product = await scraper.getProductDetails(product_id);
                    if (!product) {
                        return {
                            content: [
                                {
                                    type: "text" as const,
                                    text: `Product with ID ${product_id} not found`,
                                },
                            ],
                        };
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Product: ${product.name}\n` +
                                    `ID: ${product.id}\n` +
                                    `Price: ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}\n` +
                                    `Description: ${product.description || "No description"}\n` +
                                    `Available: ${product.available ? "Yes" : "No"}\n` +
                                    `Image: ${product.image || "No image available"}\n\n` +
                                    `Note: This is a POC using web scraping. Data may be mock data.`,
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
            name: "add_recipe_ingredients_to_oda_cart_web",
            description: "Add all ingredients from a recipe to ODA.no shopping cart using web scraping (POC)",
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
                    const ingredientNames = recipe.ingredients.map(ing => `ingredient ${ing.ingredientId}`);
                    const searchResults = await scraper.searchIngredients(ingredientNames);

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
                        await scraper.addToCart(cartItems);
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Added ingredients from "${recipe.name}" to ODA.no cart (POC):\n\n${results.join("\n")}\n\n` +
                                    `Total items added: ${cartItems.length}\n` +
                                    `Items not found: ${results.filter(r => r.startsWith("❌")).length}\n\n` +
                                    `Note: This is a POC using web scraping. Cart operations are simulated.`,
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
            name: "add_ingredients_to_oda_cart_web",
            description: "Add specific ingredients to ODA.no shopping cart using web scraping (POC)",
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
                    const searchResults = await scraper.searchIngredients(
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
                        await scraper.addToCart(cartItems);
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `Added ingredients to ODA.no cart (POC):\n\n${results.join("\n")}\n\n` +
                                    `Total items added: ${cartItems.length}\n` +
                                    `Items not found: ${results.filter(r => r.startsWith("❌")).length}\n\n` +
                                    `Note: This is a POC using web scraping. Cart operations are simulated.`,
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
            name: "get_oda_cart_web",
            description: "Get current contents of ODA.no shopping cart using web scraping (POC)",
            schema: z.object({}),
            handler: async () => {
                try {
                    const cart = await scraper.getCart();
                    const itemsList = cart.items
                        .map(
                            (item) =>
                                `- ${item.product.name} - ${item.quantity} ${item.product.unit || "piece"} - ${item.product.price} kr`
                        )
                        .join("\n") || "Cart is empty";

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text:
                                    `ODA.no Shopping Cart (POC):\n\n${itemsList}\n\n` +
                                    `Total items: ${cart.items.length}\n` +
                                    `Total price: ${cart.total_price} kr\n\n` +
                                    `Note: This is a POC using web scraping. Cart data is simulated.`,
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
            name: "find_oda_products_for_recipe_web",
            description: "Find ODA.no products that match recipe ingredients using web scraping (POC)",
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

                    const searchResults = await scraper.searchIngredients(
                        recipe.ingredients.map(ing => `ingredient ${ing.ingredientId}`)
                    );

                    let results = `Product suggestions for "${recipe.name}" ingredients (POC):\n\n`;

                    for (let i = 0; i < recipe.ingredients.length; i++) {
                        const recipeIngredient = recipe.ingredients[i];
                        const searchResult = searchResults[i];

                        results += `\n${recipeIngredient.ingredientId}:\n`;

                        if (searchResult.products.length > 0) {
                            const products = searchResult.products.slice(0, max_products_per_ingredient);
                            products.forEach((product, index) => {
                                results += `  ${index + 1}. ${product.name} - ${product.price} kr${product.unit ? ` per ${product.unit}` : ""}\n`;
                            });
                        } else {
                            results += `  No products found on ODA.no\n`;
                        }
                    }

                    results += `\nNote: This is a POC using web scraping. Results may be mock data.`;

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

        createMCPTool({
            name: "simulate_oda_shopping_experience",
            description: "Simulate a complete ODA.no shopping experience for a recipe (POC)",
            schema: z.object({
                recipe_id: z.string().describe("ID of the recipe to shop for"),
                servings: z.number().optional().describe("Number of servings (default: 4)"),
            }),
            handler: async ({ recipe_id, servings = 4 }) => {
                try {
                    const recipe = await api.getRecipe(recipe_id);

                    // Step 1: Find products for all ingredients
                    const searchResults = await scraper.searchIngredients(
                        recipe.ingredients.map(ing => `ingredient ${ing.ingredientId}`)
                    );

                    // Step 2: Calculate total cost
                    let totalCost = 0;
                    let foundItems = 0;
                    let missingItems = 0;

                    const shoppingList = recipe.ingredients.map((ingredient, index) => {
                        const searchResult = searchResults[index];
                        const quantity = Math.ceil((ingredient.quantity || 1) * (servings / recipe.servings));

                        if (searchResult.products.length > 0) {
                            const product = searchResult.products[0];
                            const itemCost = product.price * quantity;
                            totalCost += itemCost;
                            foundItems++;

                            return `✅ ${product.name} - ${quantity} ${ingredient.unit || "piece"} - ${itemCost.toFixed(2)} kr`;
                        } else {
                            missingItems++;
                            return `❌ ${ingredient.ingredientId} - Not available on ODA.no`;
                        }
                    });

                    // Step 3: Generate shopping summary
                    const summary = `
🛒 ODA.no Shopping Experience for "${recipe.name}" (${servings} servings)

Shopping List:
${shoppingList.join('\n')}

📊 Summary:
- Total items: ${recipe.ingredients.length}
- Found on ODA.no: ${foundItems}
- Not available: ${missingItems}
- Estimated total cost: ${totalCost.toFixed(2)} kr
- Cost per serving: ${(totalCost / servings).toFixed(2)} kr

🚚 Delivery:
- Estimated delivery time: 1-2 hours
- Delivery fee: 39 kr (free over 500 kr)
- Total with delivery: ${(totalCost + (totalCost < 500 ? 39 : 0)).toFixed(2)} kr

Note: This is a POC simulation using web scraping. Prices and availability are estimated.
          `;

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: summary,
                            },
                        ],
                    };
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Error simulating ODA.no shopping experience: ${error instanceof Error ? error.message : String(error)}`,
                            },
                        ],
                    };
                }
            },
        }),
    ];
};
