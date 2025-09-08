import { AxiosInstance } from 'axios';
import { GroupId } from './types';
import {
  // Ingredient types
  CreateIngredientRequest,
  CreateIngredientResponse,
  UpdateIngredientRequest,
  UpdateIngredientResponse,
  GetIngredientResponse,
  ListIngredientsResponse,
  DeleteIngredientResponse,
  PaginationParams,
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
  SemanticSearchRequest,
  SemanticSearchResponse,
} from './apiTypes';

export class FirebaseFunctionsAPI {
  private client: AxiosInstance;
  private groupId: GroupId;

  constructor(client: AxiosInstance, groupId: GroupId) {
    this.client = client;
    this.groupId = groupId;
  }

  private getHeaders() {
    return {
      'x-group-id': this.groupId,
      'Content-Type': 'application/json',
    };
  }

  // ----------------------
  // Ingredient API methods
  // ----------------------

  async createIngredient(request: CreateIngredientRequest): Promise<CreateIngredientResponse> {
    const response = await this.client.post('/ingredientsCreate', request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async updateIngredient(id: string, request: UpdateIngredientRequest): Promise<UpdateIngredientResponse> {
    const response = await this.client.put(`/ingredientsUpdate/${id}`, request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async deleteIngredient(id: string): Promise<DeleteIngredientResponse> {
    const response = await this.client.delete(`/ingredientsDelete/${id}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getIngredient(id: string): Promise<GetIngredientResponse> {
    const response = await this.client.get(`/ingredientsGet/${id}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async listIngredients(params?: PaginationParams): Promise<ListIngredientsResponse> {
    const response = await this.client.get('/ingredientsList', {
      headers: this.getHeaders(),
      params,
    });
    return response.data;
  }

  // ----------------------
  // Recipe API methods
  // ----------------------

  async createRecipe(request: CreateRecipeRequest): Promise<CreateRecipeResponse> {
    const response = await this.client.post('/recipesCreate', request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async updateRecipe(id: string, request: UpdateRecipeRequest): Promise<UpdateRecipeResponse> {
    const response = await this.client.put(`/recipesUpdate/${id}`, request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async deleteRecipe(id: string): Promise<DeleteRecipeResponse> {
    const response = await this.client.delete(`/recipesDelete/${id}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getRecipe(id: string): Promise<GetRecipeResponse> {
    const response = await this.client.get(`/recipesGet/${id}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async listRecipes(params?: PaginationParams): Promise<ListRecipesResponse> {
    const response = await this.client.get('/recipesList', {
      headers: this.getHeaders(),
      params,
    });
    return response.data;
  }

  // ----------------------
  // Search API methods
  // ----------------------

  async searchRecipes(request: SearchRecipesRequest): Promise<SearchRecipesResponse> {
    const response = await this.client.post('/recipesSearch', request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async semanticSearchRecipes(request: SemanticSearchRequest): Promise<SemanticSearchResponse> {
    const response = await this.client.post('/recipesSemanticSearch', request, {
      headers: this.getHeaders(),
    });
    return response.data;
  }
}