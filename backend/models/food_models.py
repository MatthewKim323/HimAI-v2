from pydantic import BaseModel, Field
from typing import Dict, Optional, List, Any
from datetime import datetime

class NutrientProfile(BaseModel):
    """Individual nutrient information"""
    name: str
    amount: Optional[float] = None
    unit: str
    daily_value: Optional[float] = None
    daily_value_percentage: Optional[float] = None

class FoodItem(BaseModel):
    """Complete food item with all nutritional data"""
    fdc_id: int
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    
    # Core macronutrients
    calories: Optional[float] = None
    protein: Optional[float] = None
    fat: Optional[float] = None
    carbohydrates: Optional[float] = None
    fiber: Optional[float] = None
    
    # Complete nutrient profile
    nutrients: Dict[str, NutrientProfile] = Field(default_factory=dict)
    
    # Calculated metrics
    nutrient_density_score: Optional[float] = None
    grade: str = "NA"
    
    # Serving information
    default_serving_size: float = 100.0
    default_serving_unit: str = "g"
    available_servings: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Metadata
    data_source: str = "USDA Foundation Foods"
    last_updated: datetime = Field(default_factory=datetime.now)

class FoodSearchResponse(BaseModel):
    """Response model for food search results"""
    foods: List[FoodItem]
    total_count: int
    returned_count: int
    search_query: Optional[str] = None
    sort_by: str = "Most Recent"
    processing_time_ms: Optional[float] = None

class NutrientCalculationRequest(BaseModel):
    """Request model for nutrient calculations"""
    fdc_id: int
    serving_size: float
    serving_unit: str = "g"

class NutrientCalculationResponse(BaseModel):
    """Response model for nutrient calculations"""
    fdc_id: int
    food_name: str
    serving_size: float
    serving_unit: str
    nutrients: Dict[str, NutrientProfile]
    total_calories: Optional[float] = None

class DatabaseStats(BaseModel):
    """Statistics about the food database"""
    total_foods: int
    total_nutrients: int
    grade_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    calorie_range: Dict[str, float]
    nutrient_completeness: float
    last_updated: datetime
