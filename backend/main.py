from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from pydantic import BaseModel
import uvicorn
from datetime import datetime
import logging

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from data_processing.usda_processor import USDAProcessor
from data_processing.nutrient_calculator import NutrientCalculator
from data_processing.food_search import FoodSearchEngine
from models.food_models import FoodItem, FoodSearchResponse, NutrientProfile
from routes.tension_routes import router as tension_router
from routes.insights_routes import router as insights_router
from routes.tension_visualization_routes import router as tension_visualization_router

# Optional food recommendation routes (requires TensorFlow)
try:
    from routes.food_recommendation_routes import router as food_recommendation_router
    FOOD_RECOMMENDATIONS_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    logger.warning(f"Food recommendation routes not available: {e}")
    food_recommendation_router = None
    FOOD_RECOMMENDATIONS_AVAILABLE = False

app = FastAPI(
    title="HimAI Backend API",
    description="High-performance Python backend for fitness and nutrition tracking",
    version="1.0.0"
)

# CORS middleware for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(tension_router)
app.include_router(insights_router)
app.include_router(tension_visualization_router)

# Include food recommendation routes if available
if FOOD_RECOMMENDATIONS_AVAILABLE and food_recommendation_router:
    app.include_router(food_recommendation_router)
    logger.info("Food recommendation routes enabled")
else:
    logger.info("Food recommendation routes disabled (TensorFlow not available or import failed)")

# Initialize data processors
usda_processor = USDAProcessor()
nutrient_calculator = NutrientCalculator()
food_search_engine = FoodSearchEngine()

# Global data cache
food_data_cache = None
last_data_load = None

@app.on_event("startup")
async def startup_event():
    """Load and process USDA data on startup"""
    global food_data_cache, last_data_load
    
    logger.info("Loading USDA Foundation Foods data...")
    try:
        food_data_cache = await usda_processor.load_and_process_data()
        last_data_load = datetime.now()
        logger.info(f"Successfully loaded {len(food_data_cache)} foods")
    except Exception as e:
        logger.error(f"Failed to load USDA data: {e}")
        raise

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "HimAI Backend API",
        "status": "healthy",
        "foods_loaded": len(food_data_cache) if food_data_cache else 0,
        "last_updated": last_data_load.isoformat() if last_data_load else None
    }

@app.get("/foods/search", response_model=FoodSearchResponse)
async def search_foods(
    query: Optional[str] = Query(None, description="Search query for food names"),
    sort_by: str = Query("Most Recent", description="Sort option: A to Z, Z to A, Most Frequent, Most Recent"),
    limit: int = Query(200, description="Maximum number of results to return"),
    category: Optional[str] = Query(None, description="Filter by food category")
):
    """Search and filter foods with high-performance algorithms"""
    if not food_data_cache:
        raise HTTPException(status_code=503, detail="Food data not loaded")
    
    try:
        results = await food_search_engine.search(
            foods=food_data_cache,
            query=query,
            sort_by=sort_by,
            limit=limit,
            category=category
        )
        
        return FoodSearchResponse(
            foods=results,
            total_count=len(food_data_cache),
            returned_count=len(results),
            search_query=query,
            sort_by=sort_by
        )
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail="Search failed")

@app.get("/foods/{fdc_id}", response_model=FoodItem)
async def get_food_by_id(fdc_id: int):
    """Get detailed food information by FDC ID"""
    if not food_data_cache:
        raise HTTPException(status_code=503, detail="Food data not loaded")
    
    food = next((f for f in food_data_cache if f.fdc_id == fdc_id), None)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    
    return food

@app.get("/foods/categories")
async def get_food_categories():
    """Get list of available food categories"""
    if not food_data_cache:
        raise HTTPException(status_code=503, detail="Food data not loaded")
    
    categories = list(set(food.category for food in food_data_cache if food.category))
    return {"categories": sorted(categories)}

@app.get("/foods/stats")
async def get_food_stats():
    """Get statistics about the food database"""
    if not food_data_cache:
        raise HTTPException(status_code=503, detail="Food data not loaded")
    
    stats = await usda_processor.get_database_stats(food_data_cache)
    return stats

@app.post("/foods/calculate-nutrients")
async def calculate_nutrients_for_serving(
    fdc_id: int,
    serving_size: float,
    serving_unit: str = "g"
):
    """Calculate nutrients for a specific serving size"""
    if not food_data_cache:
        raise HTTPException(status_code=503, detail="Food data not loaded")
    
    food = next((f for f in food_data_cache if f.fdc_id == fdc_id), None)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    
    try:
        scaled_nutrients = await nutrient_calculator.scale_nutrients(
            food.nutrients, serving_size, serving_unit
        )
        return {
            "fdc_id": fdc_id,
            "food_name": food.name,
            "serving_size": serving_size,
            "serving_unit": serving_unit,
            "nutrients": scaled_nutrients
        }
    except Exception as e:
        logger.error(f"Nutrient calculation error: {e}")
        raise HTTPException(status_code=500, detail="Calculation failed")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
