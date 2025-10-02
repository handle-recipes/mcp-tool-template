import { AxiosError } from "axios";
import { ZodError } from "zod";

export interface ErrorResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError: true;
}

/**
 * Formats API errors into user-friendly messages
 */
export function formatAPIError(error: unknown): string {
  // Axios error with response from server
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response) {
      const status = axiosError.response.status;
      const data = axiosError.response.data;

      // Extract error message from response
      let errorMessage = "API request failed";
      if (data?.error) {
        errorMessage = typeof data.error === "string" ? data.error : data.error.message || errorMessage;
      } else if (data?.message) {
        errorMessage = data.message;
      }

      // Add status code context
      switch (status) {
        case 400:
          return `Bad Request: ${errorMessage}`;
        case 401:
          return `Authentication failed: ${errorMessage}`;
        case 403:
          return `Permission denied: ${errorMessage}`;
        case 404:
          return `Not found: ${errorMessage}`;
        case 409:
          return `Conflict: ${errorMessage}`;
        case 422:
          return `Validation error: ${errorMessage}`;
        case 500:
          return `Server error: ${errorMessage}`;
        default:
          return `Error (${status}): ${errorMessage}`;
      }
    }

    // Network error
    if (axiosError.request) {
      return `Network error: Unable to reach the API server. ${axiosError.message}`;
    }
  }

  // Zod validation error
  if (error instanceof ZodError) {
    const issues = error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    return `Validation error:\n${issues}`;
  }

  // Standard Error
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  // Unknown error type
  return `Unknown error: ${String(error)}`;
}

/**
 * Wraps a tool handler with error handling
 */
export function withErrorHandling<T>(
  handler: (params: T) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>
): (params: T) => Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  return async (params: T) => {
    try {
      return await handler(params);
    } catch (error) {
      const errorMessage = formatAPIError(error);
      console.error(`Tool execution error:`, errorMessage);
      console.error(`Original error:`, error);

      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Error: ${errorMessage}`,
          },
        ],
      };
    }
  };
}

/**
 * Validates recipe creation parameters and provides helpful error messages
 */
export function validateRecipeCreation(params: {
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: Array<any>;
  steps?: Array<any>;
}): string | null {
  if (!params.name || params.name.trim().length === 0) {
    return "Recipe name is required and cannot be empty";
  }

  if (params.name.length > 200) {
    return "Recipe name is too long (max 200 characters)";
  }

  if (!params.description || params.description.trim().length === 0) {
    return "Recipe description is required and cannot be empty";
  }

  if (params.servings !== undefined && (params.servings < 1 || params.servings > 100)) {
    return "Servings must be between 1 and 100";
  }

  if (!params.ingredients || params.ingredients.length === 0) {
    return "Recipe must have at least one ingredient";
  }

  // Validate each ingredient
  for (let i = 0; i < params.ingredients.length; i++) {
    const ing = params.ingredients[i];
    if (!ing.ingredientId) {
      return `Ingredient #${i + 1}: ingredientId is required`;
    }
    if (!ing.unit) {
      return `Ingredient #${i + 1}: unit is required`;
    }
    if (ing.unit === "free_text" && !ing.quantityText) {
      return `Ingredient #${i + 1}: quantityText is required when unit is "free_text"`;
    }
    if (ing.unit !== "free_text" && ing.quantity === undefined) {
      return `Ingredient #${i + 1}: quantity is required when unit is not "free_text"`;
    }
  }

  if (!params.steps || params.steps.length === 0) {
    return "Recipe must have at least one step";
  }

  // Validate each step
  for (let i = 0; i < params.steps.length; i++) {
    const step = params.steps[i];
    if (!step.text || step.text.trim().length === 0) {
      return `Step #${i + 1}: text is required and cannot be empty`;
    }
  }

  return null;
}

/**
 * Validates ingredient creation parameters
 */
export function validateIngredientCreation(params: {
  name?: string;
  aliases?: string[];
  categories?: string[];
  allergens?: string[];
}): string | null {
  if (!params.name || params.name.trim().length === 0) {
    return "Ingredient name is required and cannot be empty";
  }

  if (params.name.length > 100) {
    return "Ingredient name is too long (max 100 characters)";
  }

  return null;
}

/**
 * Validates suggestion creation parameters
 */
export function validateSuggestionCreation(params: {
  title?: string;
  description?: string;
}): string | null {
  if (!params.title || params.title.trim().length === 0) {
    return "Suggestion title is required and cannot be empty";
  }

  if (params.title.length > 200) {
    return "Suggestion title is too long (max 200 characters)";
  }

  if (!params.description || params.description.trim().length === 0) {
    return "Suggestion description is required and cannot be empty";
  }

  return null;
}
