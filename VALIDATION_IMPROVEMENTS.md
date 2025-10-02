# Recipe Format Validation Improvements

## Overview
Enhanced the `create_recipe` and `update_recipe` MCP tools with comprehensive validation and explicit error messages to help LLMs understand the correct format.

## Key Improvements

### 1. Detailed Tool Descriptions
Both tools now include step-by-step format guides directly in their descriptions:

```
INGREDIENT FORMAT:
- ingredientId: (required) string - Must be a valid ingredient ID from the system
- unit: (required) Must be one of: "g", "kg", "ml", "l", "oz", "lb", "tsp", "tbsp", "fl oz", "cup", "pint", "quart", "gallon", "piece", or "free_text"
- quantity: (optional) number - Required for all units EXCEPT "free_text". Example: 200 for "200g"
- quantityText: (optional) string - ONLY used when unit is "free_text". Example: "a pinch" or "to taste"
- note: (optional) string - Additional notes like "finely chopped"

VALID EXAMPLES:
1. Standard unit: {"ingredientId": "123", "quantity": 200, "unit": "g"}
2. Free text: {"ingredientId": "456", "unit": "free_text", "quantityText": "a pinch"}
3. With note: {"ingredientId": "789", "quantity": 2, "unit": "cup", "note": "finely chopped"}
```

### 2. Enhanced Schema Descriptions
Every field in the Zod schema now has clear, descriptive help text:
- Specifies whether fields are required or optional
- Explains valid values and constraints
- Provides examples inline

### 3. Custom Validation Logic
The handler now validates ingredient format **before** sending to the API:

#### Validation Rules:
- **For `free_text` unit:**
  - ❌ Must NOT include `quantity`
  - ✅ Must include `quantityText`
  - Explicit error if violated with corrected example

- **For standard units (g, kg, ml, etc.):**
  - ✅ Must include `quantity` as a number
  - ❌ Must NOT include `quantityText`
  - Explicit error if violated with corrected example

### 4. Clear Error Messages
When validation fails, the LLM receives:

```
❌ VALIDATION ERRORS - Recipe creation failed:

Ingredient #1: quantity is required when unit is "g". Example: {"ingredientId": "abc123", "quantity": 200, "unit": "g"}

Ingredient #2: When unit is "free_text", quantityText is required. Example: {"ingredientId": "xyz789", "unit": "free_text", "quantityText": "to taste"}

📋 FORMATTING GUIDE:
Standard units: {"ingredientId": "abc123", "quantity": 200, "unit": "g"}
Free text: {"ingredientId": "abc123", "unit": "free_text", "quantityText": "a pinch"}
With note: {"ingredientId": "abc123", "quantity": 2, "unit": "cup", "note": "diced"}

Valid units: g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text
```

### 5. Try-Catch Error Handling
API errors are caught and returned with helpful context:
```
❌ Failed to create recipe: [error message]

Check that all ingredient IDs are valid and exist in the system.
```

### 6. Success Indicators
Success messages use clear visual indicators:
```
✅ Created recipe: Chocolate Cake (ID: abc123)
```

## Benefits for LLMs

1. **Self-correcting**: LLMs receive exact examples of what format to use
2. **Specific errors**: Each ingredient is validated individually with its index
3. **Contextual help**: Formatting guide included with every error
4. **Pattern learning**: Consistent error format helps LLMs learn the correct pattern faster
5. **No guessing**: All valid units are listed explicitly

## Example Error Flow

**LLM sends:**
```json
{
  "ingredientId": "flour-123",
  "quantity": 200,
  "unit": "grams"
}
```

**LLM receives:**
```
❌ VALIDATION ERRORS - Recipe creation failed:

Ingredient #1: Invalid unit "grams". Must be one of: g, kg, ml, l, oz, lb, tsp, tbsp, fl oz, cup, pint, quart, gallon, piece, free_text

📋 FORMATTING GUIDE:
Standard units: {"ingredientId": "abc123", "quantity": 200, "unit": "g"}
...
```

**LLM corrects to:**
```json
{
  "ingredientId": "flour-123",
  "quantity": 200,
  "unit": "g"
}
```

## Files Modified
- `src/mcp-tools.ts` - Enhanced `create_recipe` and `update_recipe` tools with validation
