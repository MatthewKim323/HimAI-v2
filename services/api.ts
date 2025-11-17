// API service for connecting to Python backend
// Use your machine's IP address for device/simulator connectivity
// Find your IP with: ifconfig | grep "inet " | grep -v 127.0.0.1
const API_BASE_URL = 'http://169.231.213.72:8000';

export interface FoodItem {
  fdc_id: number;
  name: string;
  category?: string;
  description?: string;
  type?: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbohydrates?: number;
  carbohydrate?: number; // Alternative naming
  fiber?: number;
  nutrients: Record<string, NutrientProfile>;
  nutrient_density_score?: number;
  nutrientDensityScore?: number; // Alternative naming
  grade: string;
  default_serving_size: number;
  default_serving_unit: string;
  data_source: string;
  last_updated: string;
  
  // Daily value percentages
  dailyValuePercentages?: {
    protein?: number;
    fat?: number;
    carbohydrates?: number;
    fiber?: number;
    [key: string]: number | undefined;
  };
  
  // Individual nutrients (for backward compatibility)
  thiamin?: number | null;
  riboflavin?: number | null;
  niacin?: number | null;
  vitaminB6?: number | null;
  folate?: number | null;
  vitaminB12?: number | null;
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  zinc?: number | null;
  copper?: number | null;
  manganese?: number | null;
  selenium?: number | null;
  water?: number | null;
  ash?: number | null;
  saturatedFat?: number | null;
  monounsaturatedFat?: number | null;
  polyunsaturatedFat?: number | null;
  cholesterol?: number | null;
  caffeine?: number | null;
  theobromine?: number | null;
  alcohol?: number | null;
}

export interface NutrientProfile {
  name: string;
  amount?: number;
  unit: string;
  daily_value?: number;
  daily_value_percentage?: number;
}

export interface FoodSearchResponse {
  foods: FoodItem[];
  total_count: number;
  returned_count: number;
  search_query?: string;
  sort_by: string;
  processing_time_ms?: number;
}

export interface DatabaseStats {
  total_foods: number;
  total_nutrients: number;
  grade_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  calorie_range: {
    min: number;
    max: number;
    mean: number;
  };
  nutrient_completeness: number;
  last_updated: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Search foods
  async searchFoods(
    query?: string,
    sortBy: string = 'Most Recent',
    limit: number = 200,
    category?: string
  ): Promise<FoodSearchResponse> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      params.append('sort_by', sortBy);
      params.append('limit', limit.toString());
      if (category) params.append('category', category);

      const response = await fetch(`${this.baseUrl}/foods/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Search foods failed:', error);
      throw error;
    }
  }

  // Get food by ID
  async getFoodById(fdcId: number): Promise<FoodItem> {
    try {
      const response = await fetch(`${this.baseUrl}/foods/${fdcId}`);
      
      if (!response.ok) {
        throw new Error(`Get food failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get food by ID failed:', error);
      throw error;
    }
  }

  // Get food categories
  async getFoodCategories(): Promise<{ categories: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/foods/categories`);
      
      if (!response.ok) {
        throw new Error(`Get categories failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get food categories failed:', error);
      throw error;
    }
  }

  // Get database statistics
  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      const response = await fetch(`${this.baseUrl}/foods/stats`);
      
      if (!response.ok) {
        throw new Error(`Get stats failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get database stats failed:', error);
      throw error;
    }
  }

  // Calculate nutrients for serving size
  async calculateNutrientsForServing(
    fdcId: number,
    servingSize: number,
    servingUnit: string = 'g'
  ): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/foods/calculate-nutrients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fdc_id: fdcId,
          serving_size: servingSize,
          serving_unit: servingUnit,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Calculate nutrients failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Calculate nutrients failed:', error);
      throw error;
    }
  }

  // Check if backend is available
  async isBackendAvailable(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get food recommendations
  async getFoodRecommendations(
    userId: number,
    calorieGoal: number = 2000,
    proteinGoal: number = 100,
    recentCalories: number = 0,
    recentProtein: number = 0,
    dietType: string = 'balanced',
    limit: number = 10,
    category?: string
  ): Promise<FoodRecommendationResponse> {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId.toString());
      params.append('calorie_goal', calorieGoal.toString());
      params.append('protein_goal', proteinGoal.toString());
      params.append('recent_calories', recentCalories.toString());
      params.append('recent_protein', recentProtein.toString());
      params.append('diet_type', dietType);
      params.append('limit', limit.toString());
      if (category) params.append('category', category);

      const response = await fetch(`${this.baseUrl}/foods/recommend?${params}`);
      
      if (!response.ok) {
        throw new Error(`Get recommendations failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get food recommendations failed:', error);
      throw error;
    }
  }

  // Check recommendation system health
  async checkRecommendationHealth(): Promise<{ available: boolean; model_loaded: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/foods/recommend/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Recommendation health check failed:', error);
      return { available: false, model_loaded: false };
    }
  }
}

export interface FoodRecommendation {
  food: FoodItem;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface FoodRecommendationResponse {
  user_id: number;
  recommendations: FoodRecommendation[];
  total_candidates: number;
  returned: number;
}

// Create singleton instance
export const apiService = new ApiService();

// Export default
export default apiService;
