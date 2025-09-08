# ODA.no Web Scraping POC

This is a **Proof of Concept** implementation that demonstrates how to integrate with ODA.no using web scraping instead of their official API. This approach is perfect for POCs and demos when you don't have API access.

## 🚀 **What This POC Demonstrates**

### **Web Scraping with Puppeteer**
- Automated browser interaction with ODA.no
- Product search and extraction
- Shopping cart simulation
- Real website interaction (when possible)

### **Fallback to Mock Data**
- When scraping fails, falls back to realistic mock data
- Ensures the POC always works
- Demonstrates the complete user experience

### **Complete Shopping Experience**
- Find products for recipe ingredients
- Calculate total costs
- Simulate adding to cart
- Generate shopping summaries

## 🛠️ **Technical Implementation**

### **Puppeteer Integration**
```typescript
// Automated browser control
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

// Navigate to ODA.no and extract data
await page.goto(`${baseUrl}/search?q=${query}`);
const products = await page.evaluate(() => {
  // Extract product information from DOM
});
```

### **Smart Selector Detection**
The scraper tries multiple CSS selectors to find product information:
- `[data-testid="product-card"]` - Modern React components
- `.product-card` - Common class names
- `.search-result` - Generic search results
- `h3, h4, .title` - Product names
- `[class*="price"]` - Price elements

### **Mock Data Fallback**
When scraping fails, the system provides realistic mock data:
```typescript
private getMockProducts(query: string, limit: number): ODAProduct[] {
  return [
    {
      id: 'mock-1',
      name: `${query} (Mock Product 1)`,
      price: 29.90,
      unit: 'stk',
      image: 'https://via.placeholder.com/200x200?text=Product+1',
      available: true,
      description: `Mock ${query} product for POC`
    }
    // ... more mock products
  ];
}
```

## 🎯 **Available Tools**

### **1. Product Search**
```typescript
search_oda_products_web
```
- Searches ODA.no website for products
- Extracts product information from search results
- Falls back to mock data if scraping fails

### **2. Product Details**
```typescript
get_oda_product_details_web
```
- Gets detailed information about specific products
- Navigates to product pages
- Extracts comprehensive product data

### **3. Recipe Shopping**
```typescript
add_recipe_ingredients_to_oda_cart_web
```
- Finds ODA.no products for all recipe ingredients
- Calculates quantities based on servings
- Simulates adding to shopping cart

### **4. Ingredient Shopping**
```typescript
add_ingredients_to_oda_cart_web
```
- Adds specific ingredients to cart
- Searches for each ingredient individually
- Provides detailed feedback

### **5. Cart Management**
```typescript
get_oda_cart_web
```
- Views current cart contents
- Shows total price and item count
- Simulates cart state

### **6. Product Discovery**
```typescript
find_oda_products_for_recipe_web
```
- Finds products for recipe ingredients
- Shows multiple options per ingredient
- Helps with product selection

### **7. Complete Shopping Experience**
```typescript
simulate_oda_shopping_experience
```
- **This is the star feature!** 🌟
- Complete shopping simulation for a recipe
- Calculates total costs
- Shows delivery estimates
- Provides shopping summary

## 🎨 **Example Usage**

### **Complete Shopping Experience**
```bash
# Simulate shopping for a chocolate cake recipe
simulate_oda_shopping_experience "recipe-123" 8

# Output:
🛒 ODA.no Shopping Experience for "Chocolate Cake" (8 servings)

Shopping List:
✅ Chocolate (Mock Product 1) - 200g - 59.80 kr
✅ Flour (Mock Product 2) - 300g - 19.90 kr
✅ Eggs (Mock Product 3) - 6 piece - 35.40 kr
✅ Sugar (Mock Product 4) - 150g - 14.90 kr

📊 Summary:
- Total items: 4
- Found on ODA.no: 4
- Not available: 0
- Estimated total cost: 130.00 kr
- Cost per serving: 16.25 kr

🚚 Delivery:
- Estimated delivery time: 1-2 hours
- Delivery fee: 39 kr (free over 500 kr)
- Total with delivery: 130.00 kr
```

### **Product Search**
```bash
# Search for tomatoes
search_oda_products_web "tomato" 5

# Output:
ODA.no Web Search Results for "tomato":

- tomato (Mock Product 1) (ID: mock-1) - 29.90 kr per stk
- tomato (Mock Product 2) (ID: mock-2) - 39.90 kr per stk
- tomato (Mock Product 3) (ID: mock-3) - 49.90 kr per stk

Total found: 3 products
Note: This is a POC using web scraping. Results may be mock data.
```

## 🔧 **Setup & Installation**

### **1. Install Dependencies**
```bash
npm install puppeteer @types/puppeteer
```

### **2. Environment Variables**
No special configuration needed! The POC works out of the box.

### **3. Run the MCP Server**
```bash
npm run mcp:build
```

## 🎯 **POC Benefits**

### **1. No API Access Required**
- Works without ODA.no API credentials
- Perfect for demos and POCs
- Shows complete integration concept

### **2. Realistic User Experience**
- Actual website interaction (when possible)
- Realistic mock data when scraping fails
- Complete shopping flow simulation

### **3. Educational Value**
- Demonstrates web scraping techniques
- Shows fallback strategies
- Illustrates MCP tool integration

### **4. Production-Ready Concepts**
- Error handling and fallbacks
- Scalable architecture
- Clean separation of concerns

## 🚀 **Future Enhancements**

### **1. Enhanced Scraping**
- More robust selector detection
- Better error handling
- Rate limiting and retry logic

### **2. Real Cart Integration**
- Actual cart manipulation
- User authentication
- Order placement simulation

### **3. Price Comparison**
- Compare prices across products
- Find best deals
- Cost optimization suggestions

### **4. Advanced Features**
- Shopping list management
- Delivery scheduling
- Recipe cost analysis
- Nutritional cost breakdown

## ⚠️ **Important Notes**

### **Legal Considerations**
- This is for POC/demo purposes only
- Respect ODA.no's terms of service
- Consider rate limiting for production use

### **Technical Limitations**
- Website changes can break scraping
- May be slower than API calls
- Requires more resources (browser automation)

### **Mock Data**
- Mock data is used when scraping fails
- Prices and products are simulated
- Always clearly marked as POC data

## 🎉 **Conclusion**

This POC demonstrates a complete ODA.no integration using web scraping, providing a realistic shopping experience without requiring API access. It's perfect for demos, prototypes, and learning how to build such integrations!

The combination of real web scraping and intelligent mock data fallbacks ensures the POC always works while showing the complete user experience. 🛒✨
