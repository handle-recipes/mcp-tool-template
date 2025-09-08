# ODA.no Integration

This MCP server includes integration with ODA.no (Norwegian grocery delivery service) to allow users to add recipe ingredients directly to their shopping cart.

## Features

### 🛒 **Shopping Cart Integration**
- Add recipe ingredients to ODA.no cart
- Add specific ingredients to cart
- View current cart contents
- Search for products on ODA.no

### 🔍 **Product Search**
- Search ODA.no product catalog
- Get detailed product information
- Find products that match recipe ingredients

### 📋 **Recipe Integration**
- Add all ingredients from a recipe to cart
- Scale recipe quantities for different serving sizes
- Find ODA.no products for recipe ingredients

## Setup

### 1. Get ODA.no API Access

ODA.no's API requires pre-approval. Contact ODA.no to request API access:

1. **Contact ODA.no**: Reach out to ODA.no with details about your application
2. **Receive Credentials**: You'll get a unique `User-Agent` and `Client-Token`
3. **Keep Credentials Secure**: Store them as environment variables

### 2. Environment Variables

Add these environment variables to your `.env` file:

```bash
# ODA.no API Configuration
ODA_USER_AGENT=YourAppName/1.0
ODA_CLIENT_TOKEN=your-client-token-here
ODA_BASE_URL=https://oda.com/no
```

### 3. Install Dependencies

The integration uses the existing axios instance from the authentication client.

## Available Tools

### **search_oda_products**
Search for products on ODA.no by name or description.

```typescript
{
  "query": "tomato",
  "limit": 20
}
```

### **get_oda_product_details**
Get detailed information about a specific ODA.no product.

```typescript
{
  "product_id": "12345"
}
```

### **add_recipe_ingredients_to_oda_cart**
Add all ingredients from a recipe to ODA.no shopping cart.

```typescript
{
  "recipe_id": "recipe-123",
  "servings_multiplier": 2
}
```

### **add_ingredients_to_oda_cart**
Add specific ingredients to ODA.no shopping cart.

```typescript
{
  "ingredients": [
    {
      "name": "tomato",
      "quantity": 3,
      "unit": "piece"
    },
    {
      "name": "onion",
      "quantity": 1,
      "unit": "piece"
    }
  ]
}
```

### **get_oda_cart**
Get current contents of ODA.no shopping cart.

```typescript
{}
```

### **find_oda_products_for_recipe**
Find ODA.no products that match recipe ingredients.

```typescript
{
  "recipe_id": "recipe-123",
  "max_products_per_ingredient": 3
}
```

## Usage Examples

### Add Recipe to Shopping Cart
```bash
# Add all ingredients from a recipe to ODA.no cart
add_recipe_ingredients_to_oda_cart "recipe-123" 2
```

### Search for Products
```bash
# Search for tomatoes on ODA.no
search_oda_products "tomato" 10
```

### Add Specific Ingredients
```bash
# Add specific ingredients to cart
add_ingredients_to_oda_cart [
  {"name": "tomato", "quantity": 3, "unit": "piece"},
  {"name": "onion", "quantity": 1, "unit": "piece"}
]
```

## Error Handling

The integration includes comprehensive error handling:

- **API Errors**: Network and authentication errors are caught and reported
- **Product Not Found**: Ingredients without matching products are clearly marked
- **Invalid Credentials**: Clear error messages for authentication issues

## Limitations

1. **API Access Required**: ODA.no API requires pre-approval
2. **Product Matching**: Ingredient matching relies on search algorithms
3. **Availability**: Product availability may change
4. **Rate Limits**: ODA.no may have rate limits on API calls

## Security

- **Credentials**: Store API credentials securely as environment variables
- **HTTPS**: All API calls use HTTPS
- **Authentication**: Proper authentication headers are included in all requests

## Troubleshooting

### Common Issues

1. **"Failed to search products"**
   - Check ODA_USER_AGENT and ODA_CLIENT_TOKEN
   - Verify ODA_BASE_URL is correct
   - Ensure API access is approved

2. **"No matching product found"**
   - Try different search terms
   - Check if product is available on ODA.no
   - Verify ingredient names are correct

3. **"Failed to add items to cart"**
   - Check if user is logged in to ODA.no
   - Verify product IDs are valid
   - Check cart permissions

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=oda-integration
```

## Future Enhancements

- **User Authentication**: Direct ODA.no user login
- **Cart Management**: Remove items, update quantities
- **Price Comparison**: Compare prices across products
- **Shopping Lists**: Save and manage shopping lists
- **Delivery Scheduling**: Schedule delivery times
