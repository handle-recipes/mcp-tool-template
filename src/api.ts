import { AxiosInstance } from "axios";
import { GroupId } from "./types";

interface PaginationParams {
  limit?: string | number;
  offset?: string | number;
}

import {
  // Ingredient types
  CreateIngredientRequest,
  CreateIngredientResponse,
  UpdateIngredientRequest,
  UpdateIngredientResponse,
  GetIngredientResponse,
  ListIngredientsResponse,
  DeleteIngredientResponse,
  // Recipe types
  CreateRecipeRequest,
  CreateRecipeResponse,
  UpdateRecipeRequest,
  UpdateRecipeResponse,
  GetRecipeResponse,
  ListRecipesResponse,
  DeleteRecipeResponse,
  // Search types
  SearchRecipesRequest,
  SearchRecipesResponse,
  // Suggestion types
  CreateSuggestionRequest,
  CreateSuggestionResponse,
  ListSuggestionsRequest,
  ListSuggestionsResponse,
  VoteSuggestionRequest,
  VoteSuggestionResponse,
  UpdateSuggestionRequest,
  UpdateSuggestionResponse,
} from "./apiTypes";

export class FirebaseFunctionsAPI {
  private client: AxiosInstance;
  private groupId: GroupId;

  constructor(client: AxiosInstance, groupId: GroupId) {
    this.client = client;
    this.groupId = groupId;
  }

  private getHeaders() {
    return {
      "x-group-id": this.groupId,
      "Content-Type": "application/json",
    };
  }

  // ----------------------
  // Ingredient API methods
  // ----------------------

  async createIngredient(
    request: CreateIngredientRequest
  ): Promise<CreateIngredientResponse> {
    const response = await this.client.post("/ingredientsCreate", request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async updateIngredient(
    id: string,
    request: UpdateIngredientRequest
  ): Promise<UpdateIngredientResponse> {
    const requestWithId = { ...request, id };
    const response = await this.client.post(
      "/ingredientsUpdate",
      requestWithId,
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async deleteIngredient(id: string): Promise<DeleteIngredientResponse> {
    const response = await this.client.post(
      "/ingredientsDelete",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async getIngredient(id: string): Promise<GetIngredientResponse> {
    const response = await this.client.post(
      "/ingredientsGet",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async listIngredients(
    params?: PaginationParams
  ): Promise<ListIngredientsResponse> {
    const response = await this.client.post("/ingredientsList", params || {}, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async duplicateIngredient(
    id: string,
    request?: Omit<UpdateIngredientRequest, "id">
  ): Promise<CreateIngredientResponse> {
    const requestBody = { ...request, id };
    const response = await this.client.post(
      "/ingredientsDuplicate",
      requestBody,
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  // ----------------------
  // Recipe API methods
  // ----------------------

  async createRecipe(
    request: CreateRecipeRequest
  ): Promise<CreateRecipeResponse> {
    const response = await this.client.post("/recipesCreate", request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async updateRecipe(
    id: string,
    request: UpdateRecipeRequest
  ): Promise<UpdateRecipeResponse> {
    const requestWithId = { ...request, id };
    const response = await this.client.post("/recipesUpdate", requestWithId, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async deleteRecipe(id: string): Promise<DeleteRecipeResponse> {
    const response = await this.client.post(
      "/recipesDelete",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async getRecipe(id: string): Promise<GetRecipeResponse> {
    const response = await this.client.post(
      "/recipesGet",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async listRecipes(params?: PaginationParams): Promise<ListRecipesResponse> {
    const response = await this.client.post("/recipesList", params || {}, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async duplicateRecipe(
    id: string,
    request?: Omit<UpdateRecipeRequest, "id">
  ): Promise<CreateRecipeResponse> {
    const requestBody = { ...request, id };
    const response = await this.client.post(
      "/recipesDuplicate",
      requestBody,
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  // ----------------------
  // Search API methods
  // ----------------------

  async searchRecipes(
    request: SearchRecipesRequest
  ): Promise<SearchRecipesResponse> {
    const response = await this.client.post("/recipesSearch", request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  // ----------------------
  // Suggestion API methods
  // ----------------------

  async createSuggestion(
    request: CreateSuggestionRequest
  ): Promise<CreateSuggestionResponse> {
    const response = await this.client.post("/suggestionsCreate", request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async listSuggestions(
    request?: ListSuggestionsRequest
  ): Promise<ListSuggestionsResponse> {
    const response = await this.client.post(
      "/suggestionsList",
      request || {},
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async voteSuggestion(id: string): Promise<VoteSuggestionResponse> {
    const response = await this.client.post(
      "/suggestionsVote",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async updateSuggestion(
    id: string,
    request: UpdateSuggestionRequest
  ): Promise<UpdateSuggestionResponse> {
    const requestWithId = { ...request, id };
    const response = await this.client.post(
      "/suggestionsUpdate",
      requestWithId,
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async deleteSuggestion(id: string): Promise<{ message: string }> {
    const response = await this.client.post(
      "/suggestionsDelete",
      { id },
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }

  async duplicateSuggestion(
    id: string,
    request?: Omit<UpdateSuggestionRequest, "id">
  ): Promise<CreateSuggestionResponse> {
    const requestBody = { ...request, id };
    const response = await this.client.post(
      "/suggestionsDuplicate",
      requestBody,
      {
        headers: this.getHeaders(),
      }
    );
    return response.data;
  }
}
