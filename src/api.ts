import { AxiosInstance } from 'axios';
import { z } from 'zod';

const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  instructions: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const RecipeListResponseSchema = z.object({
  recipes: z.array(RecipeSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeListResponse = z.infer<typeof RecipeListResponseSchema>;

export class RecipesAPI {
  private client: AxiosInstance;
  private groupId: string;

  constructor(client: AxiosInstance, groupId: string) {
    this.client = client;
    this.groupId = groupId;
  }

  private getHeaders() {
    return {
      'x-group-id': this.groupId,
      'Content-Type': 'application/json',
    };
  }

  async listRecipes(page = 1, limit = 10): Promise<RecipeListResponse> {
    const response = await this.client.get('/recipes', {
      headers: this.getHeaders(),
      params: { page, limit },
    });
    
    return RecipeListResponseSchema.parse(response.data);
  }

  async getRecipe(id: string): Promise<Recipe> {
    const response = await this.client.get(`/recipes/${id}`, {
      headers: this.getHeaders(),
    });
    
    return RecipeSchema.parse(response.data);
  }

  async createRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
    const response = await this.client.post('/recipes', recipe, {
      headers: this.getHeaders(),
    });
    
    return RecipeSchema.parse(response.data);
  }

  async updateRecipe(id: string, recipe: Partial<Recipe>): Promise<Recipe> {
    const response = await this.client.put(`/recipes/${id}`, recipe, {
      headers: this.getHeaders(),
    });
    
    return RecipeSchema.parse(response.data);
  }

  async deleteRecipe(id: string): Promise<void> {
    await this.client.delete(`/recipes/${id}`, {
      headers: this.getHeaders(),
    });
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health', {
      headers: this.getHeaders(),
    });
    
    return response.data;
  }
}