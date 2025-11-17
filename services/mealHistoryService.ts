/**
 * Meal History Service
 * Handles persistence and management of meal history over time
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MealEntry {
  date: string; // ISO date string (YYYY-MM-DD)
  foods: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbohydrates: number;
  nutrients?: Record<string, number>; // Nutrient percentages
  timestamp: string; // ISO timestamp
}

export interface FoodEntry {
  fdc_id: number;
  name: string;
  grams: number;
  calories: number;
  protein: number;
  fat?: number;
  carbohydrates?: number;
  [key: string]: any; // Additional food properties
}

const MEAL_HISTORY_KEY = 'himai_meal_history_v2';
const CURRENT_DAY_KEY = 'himai_current_day_v2';
const MAX_HISTORY_DAYS = 90; // Keep 90 days of history

class MealHistoryService {
  /**
   * Get today's date in ISO format (YYYY-MM-DD)
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get current day's meals
   */
  async getCurrentDayMeals(): Promise<FoodEntry[]> {
    try {
      const today = this.getTodayDate();
      const data = await AsyncStorage.getItem(CURRENT_DAY_KEY);
      
      if (data) {
        const parsed = JSON.parse(data);
        // Check if it's from today
        if (parsed.date === today) {
          return parsed.foods || [];
        } else {
          // Old day - save it to history and start fresh
          await this.saveDayToHistory(parsed.foods, parsed.date);
          await AsyncStorage.removeItem(CURRENT_DAY_KEY);
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('Failed to get current day meals:', error);
      return [];
    }
  }

  /**
   * Add food to current day
   */
  async addFoodToCurrentDay(food: FoodEntry): Promise<void> {
    try {
      const today = this.getTodayDate();
      const currentMeals = await this.getCurrentDayMeals();
      
      // Add new food
      const updatedMeals = [...currentMeals, food];
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(CURRENT_DAY_KEY, JSON.stringify({
        date: today,
        foods: updatedMeals,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to add food to current day:', error);
      throw error;
    }
  }

  /**
   * Remove food from current day
   */
  async removeFoodFromCurrentDay(index: number): Promise<void> {
    try {
      const currentMeals = await this.getCurrentDayMeals();
      const updatedMeals = currentMeals.filter((_, i) => i !== index);
      
      const today = this.getTodayDate();
      await AsyncStorage.setItem(CURRENT_DAY_KEY, JSON.stringify({
        date: today,
        foods: updatedMeals,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to remove food from current day:', error);
      throw error;
    }
  }

  /**
   * Save current day to meal history
   */
  async saveDayToHistory(foods?: FoodEntry[], date?: string): Promise<MealEntry> {
    try {
      const today = date || this.getTodayDate();
      const dayFoods = foods || await this.getCurrentDayMeals();
      
      if (dayFoods.length === 0) {
        throw new Error('No foods to save');
      }

      // Calculate totals
      const totals = dayFoods.reduce((acc, food) => ({
        totalCalories: acc.totalCalories + (food.calories || 0),
        totalProtein: acc.totalProtein + (food.protein || 0),
        totalFat: acc.totalFat + (food.fat || 0),
        totalCarbohydrates: acc.totalCarbohydrates + (food.carbohydrates || 0),
      }), {
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbohydrates: 0,
      });

      // Create meal entry
      const mealEntry: MealEntry = {
        date: today,
        foods: dayFoods,
        ...totals,
        timestamp: new Date().toISOString(),
      };

      // Get existing history
      const history = await this.getMealHistory();
      
      // Remove existing entry for this date if it exists
      const filteredHistory = history.filter(entry => entry.date !== today);
      
      // Add new entry at the beginning
      const updatedHistory = [mealEntry, ...filteredHistory];
      
      // Keep only last MAX_HISTORY_DAYS days
      const trimmedHistory = updatedHistory.slice(0, MAX_HISTORY_DAYS);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem(MEAL_HISTORY_KEY, JSON.stringify(trimmedHistory));
      
      // Clear current day
      await AsyncStorage.removeItem(CURRENT_DAY_KEY);
      
      return mealEntry;
    } catch (error) {
      console.error('Failed to save day to history:', error);
      throw error;
    }
  }

  /**
   * Get meal history
   */
  async getMealHistory(): Promise<MealEntry[]> {
    try {
      const data = await AsyncStorage.getItem(MEAL_HISTORY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch (error) {
      console.error('Failed to get meal history:', error);
      return [];
    }
  }

  /**
   * Get meals for a specific date range
   */
  async getMealsForDateRange(startDate: string, endDate: string): Promise<MealEntry[]> {
    try {
      const history = await this.getMealHistory();
      return history.filter(entry => {
        return entry.date >= startDate && entry.date <= endDate;
      });
    } catch (error) {
      console.error('Failed to get meals for date range:', error);
      return [];
    }
  }

  /**
   * Get meals for last N days
   */
  async getMealsForLastDays(days: number): Promise<MealEntry[]> {
    try {
      const history = await this.getMealHistory();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      return history.filter(entry => entry.date >= cutoffDateStr);
    } catch (error) {
      console.error('Failed to get meals for last days:', error);
      return [];
    }
  }

  /**
   * Clear meal history
   */
  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(MEAL_HISTORY_KEY);
      await AsyncStorage.removeItem(CURRENT_DAY_KEY);
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }

  /**
   * Auto-save current day (call this periodically or on app close)
   */
  async autoSaveCurrentDay(): Promise<void> {
    try {
      const currentMeals = await this.getCurrentDayMeals();
      if (currentMeals.length > 0) {
        // Check if we should save (e.g., if it's a new day)
        const today = this.getTodayDate();
        const data = await AsyncStorage.getItem(CURRENT_DAY_KEY);
        
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.date !== today) {
            // It's a new day, save yesterday's meals
            await this.saveDayToHistory(parsed.foods, parsed.date);
          }
        }
      }
    } catch (error) {
      console.error('Failed to auto-save current day:', error);
    }
  }

  /**
   * Get statistics for meal history
   */
  async getStatistics(): Promise<{
    totalDays: number;
    totalCalories: number;
    averageCaloriesPerDay: number;
    totalProtein: number;
    averageProteinPerDay: number;
    dateRange: { start: string; end: string } | null;
  }> {
    try {
      const history = await this.getMealHistory();
      
      if (history.length === 0) {
        return {
          totalDays: 0,
          totalCalories: 0,
          averageCaloriesPerDay: 0,
          totalProtein: 0,
          averageProteinPerDay: 0,
          dateRange: null,
        };
      }

      const totals = history.reduce((acc, entry) => ({
        totalCalories: acc.totalCalories + entry.totalCalories,
        totalProtein: acc.totalProtein + entry.totalProtein,
      }), { totalCalories: 0, totalProtein: 0 });

      const dates = history.map(entry => entry.date).sort();
      
      return {
        totalDays: history.length,
        totalCalories: totals.totalCalories,
        averageCaloriesPerDay: totals.totalCalories / history.length,
        totalProtein: totals.totalProtein,
        averageProteinPerDay: totals.totalProtein / history.length,
        dateRange: {
          start: dates[0],
          end: dates[dates.length - 1],
        },
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalDays: 0,
        totalCalories: 0,
        averageCaloriesPerDay: 0,
        totalProtein: 0,
        averageProteinPerDay: 0,
        dateRange: null,
      };
    }
  }
}

// Export singleton instance
export const mealHistoryService = new MealHistoryService();
export default mealHistoryService;

