// Food service that can work with both Python backend and local JSON data
import apiService, { FoodItem, FoodSearchResponse, FoodRecommendationResponse } from './api';
import foodData from '../complete_usda_catalog.json';

export interface FoodServiceResponse {
  foods: FoodItem[];
  total_count: number;
  returned_count: number;
  search_query?: string;
  sort_by: string;
  using_backend: boolean;
}

class FoodService {
  private useBackend: boolean = false;
  private backendAvailable: boolean = false;

  constructor() {
    this.checkBackendAvailability();
  }

  // Check if Python backend is available
  private async checkBackendAvailability(): Promise<void> {
    try {
      this.backendAvailable = await apiService.isBackendAvailable();
      this.useBackend = this.backendAvailable;
      console.log(`🍽️ Food Service: ${this.useBackend ? 'Using Python backend' : 'Using local JSON data'}`);
    } catch (error) {
      console.log('🍽️ Food Service: Backend not available, using local JSON data');
      this.useBackend = false;
      this.backendAvailable = false;
    }
  }

  // Get all foods (for initial load)
  async getAllFoods(): Promise<FoodItem[]> {
    // Always try backend first
    try {
      const response = await apiService.searchFoods('', 'Most Recent', 1000);
      console.log(`🍽️ Successfully loaded ${response.foods.length} foods from backend`);
      console.log(`🍽️ Sample backend food: ${response.foods[0]?.name} - ${response.foods[0]?.calories} cal, Grade: ${response.foods[0]?.grade}`);
      this.useBackend = true;
      this.backendAvailable = true;
      return response.foods;
    } catch (error) {
      console.warn('Backend search failed, falling back to local data:', error);
      this.useBackend = false;
      this.backendAvailable = false;
    }

    // Fallback to local JSON data
    const localFoods = (foodData as any).foods || [];
    console.log(`🍽️ Using local data: ${localFoods.length} foods`);
    return this.convertLocalFoodsToApiFormat(localFoods);
  }

  // Search foods with filtering and sorting
  async searchFoods(
    query?: string,
    sortBy: string = 'Most Recent',
    limit: number = 200,
    category?: string
  ): Promise<FoodServiceResponse> {
    // Always try backend first
    try {
      const response = await apiService.searchFoods(query, sortBy, limit, category);
      console.log(`🍽️ Backend search successful: ${response.foods.length} foods returned`);
      if (response.foods.length > 0) {
        console.log(`🍽️ Sample result: ${response.foods[0]?.name} - ${response.foods[0]?.calories} cal, Grade: ${response.foods[0]?.grade}`);
      }
      this.useBackend = true;
      this.backendAvailable = true;
      return {
        ...response,
        using_backend: true
      };
    } catch (error) {
      console.warn('Backend search failed, falling back to local data:', error);
      this.useBackend = false;
      this.backendAvailable = false;
    }

    // Fallback to local JSON data
    const localFoods = (foodData as any).foods || [];
    const filteredFoods = this.filterLocalFoods(localFoods, query, sortBy, limit, category);
    
    return {
      foods: this.convertLocalFoodsToApiFormat(filteredFoods),
      total_count: localFoods.length,
      returned_count: filteredFoods.length,
      search_query: query,
      sort_by: sortBy,
      using_backend: false
    };
  }

  // Get food by ID
  async getFoodById(fdcId: number): Promise<FoodItem | null> {
    // Always try backend first
    try {
      const food = await apiService.getFoodById(fdcId);
      this.useBackend = true;
      this.backendAvailable = true;
      return food;
    } catch (error) {
      console.warn('Backend get food failed, falling back to local data:', error);
      this.useBackend = false;
      this.backendAvailable = false;
    }

    // Fallback to local JSON data
    const localFoods = (foodData as any).foods || [];
    const localFood = localFoods.find((food: any) => food.fdc_id === fdcId);
    
    if (localFood) {
      return this.convertLocalFoodToApiFormat(localFood);
    }
    
    return null;
  }

  // Get database statistics
  async getDatabaseStats(): Promise<any> {
    // Always try backend first
    try {
      const stats = await apiService.getDatabaseStats();
      this.useBackend = true;
      this.backendAvailable = true;
      return stats;
    } catch (error) {
      console.warn('Backend stats failed, falling back to local data:', error);
      this.useBackend = false;
      this.backendAvailable = false;
    }

    // Fallback to local JSON data
    const localFoods = (foodData as any).foods || [];
    return this.calculateLocalStats(localFoods);
  }

  // Convert local food data to API format
  private convertLocalFoodsToApiFormat(localFoods: any[]): FoodItem[] {
    return localFoods.map(food => this.convertLocalFoodToApiFormat(food));
  }

  private convertLocalFoodToApiFormat(localFood: any): FoodItem {
    // Log if we're using local data with missing calories
    if (!localFood.calories || localFood.calories === 0) {
      console.warn(`🍽️ Local food missing calories: ${localFood.name}`);
    }
    
    return {
      fdc_id: localFood.fdc_id || 0,
      name: localFood.name || 'Unknown Food',
      category: localFood.category || 'Unknown',
      description: localFood.description,
      type: localFood.type,
      calories: localFood.calories,
      protein: localFood.protein,
      fat: localFood.fat,
      carbohydrates: localFood.carbohydrates,
      carbohydrate: localFood.carbohydrate || localFood.carbohydrates,
      fiber: localFood.fiber,
      nutrients: localFood.nutrients || {},
      nutrient_density_score: localFood.nutrientDensityScore || localFood.nutrient_density_score,
      nutrientDensityScore: localFood.nutrientDensityScore || localFood.nutrient_density_score,
      grade: localFood.grade || 'NA',
      default_serving_size: 100.0,
      default_serving_unit: 'g',
      data_source: 'Local JSON Data',
      last_updated: new Date().toISOString(),
      
      // Daily value percentages
      dailyValuePercentages: localFood.dailyValuePercentages || {},
      
      // Individual nutrients
      thiamin: localFood.thiamin,
      riboflavin: localFood.riboflavin,
      niacin: localFood.niacin,
      vitaminB6: localFood.vitaminB6,
      folate: localFood.folate,
      vitaminB12: localFood.vitaminB12,
      calcium: localFood.calcium,
      iron: localFood.iron,
      magnesium: localFood.magnesium,
      phosphorus: localFood.phosphorus,
      potassium: localFood.potassium,
      zinc: localFood.zinc,
      copper: localFood.copper,
      manganese: localFood.manganese,
      selenium: localFood.selenium,
      water: localFood.water,
      ash: localFood.ash,
      saturatedFat: localFood.saturatedFat,
      monounsaturatedFat: localFood.monounsaturatedFat,
      polyunsaturatedFat: localFood.polyunsaturatedFat,
      cholesterol: localFood.cholesterol,
      caffeine: localFood.caffeine,
      theobromine: localFood.theobromine,
      alcohol: localFood.alcohol
    };
  }

  // Filter local foods (fallback implementation)
  private filterLocalFoods(
    foods: any[],
    query?: string,
    sortBy: string = 'Most Recent',
    limit: number = 200,
    category?: string
  ): any[] {
    let filtered = [...foods];

    // Apply search filter
    if (query && query.trim()) {
      const searchQuery = query.toLowerCase();
      filtered = filtered.filter((food: any) => 
        food.name.toLowerCase().includes(searchQuery)
      );
    }

    // Apply category filter
    if (category && category.trim()) {
      const categoryQuery = category.toLowerCase();
      filtered = filtered.filter((food: any) => 
        food.category && food.category.toLowerCase().includes(categoryQuery)
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'A to Z':
        filtered = filtered.sort((a: any, b: any) => a.name.localeCompare(b.name));
        break;
      case 'Z to A':
        filtered = filtered.sort((a: any, b: any) => b.name.localeCompare(a.name));
        break;
      case 'Most Frequent':
      case 'Most Recent':
      default:
        filtered = filtered.sort((a: any, b: any) => 
          (b.nutrientDensityScore || b.nutrient_density_score || 0) - 
          (a.nutrientDensityScore || a.nutrient_density_score || 0)
        );
        break;
    }

    return filtered.slice(0, limit);
  }

  // Calculate local stats
  private calculateLocalStats(foods: any[]): any {
    const totalFoods = foods.length;
    
    // Grade distribution
    const gradeDist: Record<string, number> = {};
    foods.forEach(food => {
      const grade = food.grade || 'NA';
      gradeDist[grade] = (gradeDist[grade] || 0) + 1;
    });

    // Category distribution
    const categoryDist: Record<string, number> = {};
    foods.forEach(food => {
      const category = food.category || 'Unknown';
      categoryDist[category] = (categoryDist[category] || 0) + 1;
    });

    // Calorie range
    const calories = foods.map(f => f.calories).filter(c => c != null);
    const calorieRange = {
      min: calories.length > 0 ? Math.min(...calories) : 0,
      max: calories.length > 0 ? Math.max(...calories) : 0,
      mean: calories.length > 0 ? calories.reduce((a, b) => a + b, 0) / calories.length : 0
    };

    // Nutrient completeness
    const completeNutrients = foods.filter(f => f.calories != null && f.protein != null).length;
    const nutrientCompleteness = totalFoods > 0 ? (completeNutrients / totalFoods) * 100 : 0;

    return {
      total_foods: totalFoods,
      total_nutrients: 70, // Approximate
      grade_distribution: gradeDist,
      category_distribution: categoryDist,
      calorie_range: calorieRange,
      nutrient_completeness: nutrientCompleteness,
      last_updated: new Date().toISOString()
    };
  }

  // Get service status
  getServiceStatus(): { using_backend: boolean; backend_available: boolean } {
    return {
      using_backend: this.useBackend,
      backend_available: this.backendAvailable
    };
  }

  // Force refresh backend availability
  async refreshBackendStatus(): Promise<void> {
    await this.checkBackendAvailability();
  }

  // Get personalized food recommendations
  async getRecommendations(
    userId: number,
    calorieGoal: number = 2000,
    proteinGoal: number = 100,
    recentCalories: number = 0,
    recentProtein: number = 0,
    dietType: string = 'balanced',
    limit: number = 10,
    category?: string
  ): Promise<FoodRecommendationResponse | null> {
    // Only available via backend
    if (!this.backendAvailable) {
      console.warn('Recommendations require backend connection');
      return null;
    }

    try {
      const response = await apiService.getFoodRecommendations(
        userId,
        calorieGoal,
        proteinGoal,
        recentCalories,
        recentProtein,
        dietType,
        limit,
        category
      );
      
      this.useBackend = true;
      this.backendAvailable = true;
      
      console.log(`🍽️ Got ${response.recommendations.length} recommendations for user ${userId}`);
      
      return response;
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      this.backendAvailable = false;
      return null;
    }
  }

  // Check if recommendation system is available
  async checkRecommendationAvailability(): Promise<boolean> {
    try {
      const health = await apiService.checkRecommendationHealth();
      return health.available && health.model_loaded;
    } catch (error) {
      return false;
    }
  }
}

// Create singleton instance
export const foodService = new FoodService();

// Export default
export default foodService;
