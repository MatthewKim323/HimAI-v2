import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
import logging
import time
from datetime import datetime
from models.food_models import FoodItem

logger = logging.getLogger(__name__)

class FoodSearchEngine:
    """High-performance food search engine with advanced filtering and sorting"""
    
    def __init__(self):
        # Search configuration
        self.max_results = 1000
        self.default_limit = 200
        
        # Performance tracking
        self.search_times = []
        self.cache_hits = 0
        self.cache_misses = 0
        
        # Search index for fast lookups
        self._search_index = None
        self._last_index_update = None
    
    async def search(
        self,
        foods: List[FoodItem],
        query: Optional[str] = None,
        sort_by: str = "Most Recent",
        limit: int = 200,
        category: Optional[str] = None
    ) -> List[FoodItem]:
        """
        Perform high-performance food search with filtering and sorting
        """
        start_time = time.time()
        
        try:
            # Update search index if needed
            await self._update_search_index(foods)
            
            # Start with all foods
            results = foods.copy()
            
            # Apply text search filter
            if query and query.strip():
                results = await self._apply_text_filter(results, query.strip())
            
            # Apply category filter
            if category and category.strip():
                results = await self._apply_category_filter(results, category.strip())
            
            # Apply sorting
            results = await self._apply_sorting(results, sort_by)
            
            # Limit results
            results = results[:limit]
            
            # Track performance
            search_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            self.search_times.append(search_time)
            
            logger.info(f"Search completed in {search_time:.2f}ms, returned {len(results)} results")
            
            return results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    async def _update_search_index(self, foods: List[FoodItem]):
        """Update the search index for fast lookups"""
        try:
            # Only update if foods list has changed
            if (self._search_index is None or 
                self._last_index_update is None or 
                len(foods) != len(self._search_index)):
                
                logger.info("Updating search index...")
                
                # Create pandas DataFrame for vectorized operations
                food_data = []
                for food in foods:
                    food_data.append({
                        'fdc_id': food.fdc_id,
                        'name': food.name.lower(),
                        'category': food.category.lower() if food.category else '',
                        'calories': food.calories or 0,
                        'protein': food.protein or 0,
                        'fat': food.fat or 0,
                        'carbohydrates': food.carbohydrates or 0,
                        'fiber': food.fiber or 0,
                        'nutrient_density_score': food.nutrient_density_score or 0,
                        'grade': food.grade,
                        'food_object': food
                    })
                
                self._search_index = pd.DataFrame(food_data)
                self._last_index_update = datetime.now()
                
                logger.info(f"Search index updated with {len(foods)} foods")
                
        except Exception as e:
            logger.error(f"Error updating search index: {e}")
            self._search_index = None
    
    async def _apply_text_filter(self, foods: List[FoodItem], query: str) -> List[FoodItem]:
        """Apply text search filter using vectorized string operations"""
        try:
            if not self._search_index is not None:
                # Use pandas for vectorized string operations
                query_lower = query.lower()
                
                # Create boolean mask for matching foods
                mask = self._search_index['name'].str.contains(query_lower, case=False, na=False)
                
                # Get matching food objects
                matching_foods = self._search_index[mask]['food_object'].tolist()
                
                return matching_foods
            else:
                # Fallback to list comprehension
                query_lower = query.lower()
                return [food for food in foods if query_lower in food.name.lower()]
                
        except Exception as e:
            logger.error(f"Error applying text filter: {e}")
            return foods
    
    async def _apply_category_filter(self, foods: List[FoodItem], category: str) -> List[FoodItem]:
        """Apply category filter"""
        try:
            if not self._search_index is not None:
                # Use pandas for vectorized filtering
                category_lower = category.lower()
                mask = self._search_index['category'].str.contains(category_lower, case=False, na=False)
                matching_foods = self._search_index[mask]['food_object'].tolist()
                return matching_foods
            else:
                # Fallback to list comprehension
                category_lower = category.lower()
                return [food for food in foods 
                       if food.category and category_lower in food.category.lower()]
                
        except Exception as e:
            logger.error(f"Error applying category filter: {e}")
            return foods
    
    async def _apply_sorting(self, foods: List[FoodItem], sort_by: str) -> List[FoodItem]:
        """Apply sorting using vectorized operations"""
        try:
            if not foods:
                return foods
            
            if not self._search_index is not None:
                # Get current food IDs
                current_fdc_ids = [food.fdc_id for food in foods]
                
                # Filter index to current results
                current_mask = self._search_index['fdc_id'].isin(current_fdc_ids)
                current_index = self._search_index[current_mask].copy()
                
                # Apply sorting
                if sort_by == "A to Z":
                    current_index = current_index.sort_values('name')
                elif sort_by == "Z to A":
                    current_index = current_index.sort_values('name', ascending=False)
                elif sort_by == "Most Frequent":
                    # Sort by nutrient density score (proxy for frequency)
                    current_index = current_index.sort_values('nutrient_density_score', ascending=False)
                elif sort_by == "Most Recent":
                    # Sort by nutrient density score (proxy for recency)
                    current_index = current_index.sort_values('nutrient_density_score', ascending=False)
                else:
                    # Default to Most Recent
                    current_index = current_index.sort_values('nutrient_density_score', ascending=False)
                
                # Return sorted food objects
                return current_index['food_object'].tolist()
            else:
                # Fallback to Python sorting
                if sort_by == "A to Z":
                    return sorted(foods, key=lambda x: x.name)
                elif sort_by == "Z to A":
                    return sorted(foods, key=lambda x: x.name, reverse=True)
                elif sort_by == "Most Frequent":
                    return sorted(foods, key=lambda x: x.nutrient_density_score or 0, reverse=True)
                elif sort_by == "Most Recent":
                    return sorted(foods, key=lambda x: x.nutrient_density_score or 0, reverse=True)
                else:
                    return sorted(foods, key=lambda x: x.nutrient_density_score or 0, reverse=True)
                
        except Exception as e:
            logger.error(f"Error applying sorting: {e}")
            return foods
    
    async def get_search_suggestions(
        self, 
        foods: List[FoodItem], 
        partial_query: str, 
        limit: int = 10
    ) -> List[str]:
        """Get search suggestions based on partial query"""
        try:
            if len(partial_query) < 2:
                return []
            
            partial_lower = partial_query.lower()
            suggestions = set()
            
            for food in foods:
                food_name_lower = food.name.lower()
                if partial_lower in food_name_lower:
                    # Extract relevant part of the name
                    words = food_name_lower.split()
                    for word in words:
                        if word.startswith(partial_lower) and len(word) > len(partial_lower):
                            suggestions.add(word.capitalize())
            
            return sorted(list(suggestions))[:limit]
            
        except Exception as e:
            logger.error(f"Error getting search suggestions: {e}")
            return []
    
    async def get_popular_foods(
        self, 
        foods: List[FoodItem], 
        limit: int = 20
    ) -> List[FoodItem]:
        """Get most popular foods based on nutrient density score"""
        try:
            # Sort by nutrient density score and grade
            popular_foods = sorted(
                foods, 
                key=lambda x: (x.nutrient_density_score or 0, x.grade), 
                reverse=True
            )
            
            return popular_foods[:limit]
            
        except Exception as e:
            logger.error(f"Error getting popular foods: {e}")
            return []
    
    async def get_foods_by_grade(
        self, 
        foods: List[FoodItem], 
        grade: str
    ) -> List[FoodItem]:
        """Get all foods with a specific grade"""
        try:
            return [food for food in foods if food.grade == grade]
            
        except Exception as e:
            logger.error(f"Error getting foods by grade: {e}")
            return []
    
    async def get_performance_stats(self) -> Dict[str, Any]:
        """Get search performance statistics"""
        try:
            if not self.search_times:
                return {
                    'average_search_time_ms': 0,
                    'total_searches': 0,
                    'cache_hit_rate': 0,
                    'fastest_search_ms': 0,
                    'slowest_search_ms': 0
                }
            
            return {
                'average_search_time_ms': np.mean(self.search_times),
                'total_searches': len(self.search_times),
                'cache_hit_rate': self.cache_hits / (self.cache_hits + self.cache_misses) if (self.cache_hits + self.cache_misses) > 0 else 0,
                'fastest_search_ms': min(self.search_times),
                'slowest_search_ms': max(self.search_times),
                'recent_searches': self.search_times[-10:]  # Last 10 searches
            }
            
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {}
    
    async def clear_cache(self):
        """Clear search cache and reset performance tracking"""
        try:
            self._search_index = None
            self._last_index_update = None
            self.search_times = []
            self.cache_hits = 0
            self.cache_misses = 0
            
            logger.info("Search cache cleared")
            
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
