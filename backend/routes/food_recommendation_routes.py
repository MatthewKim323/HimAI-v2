"""
Food Recommendation API Routes
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
import numpy as np
import logging
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logger = logging.getLogger(__name__)

# Optional import - backend can run without TensorFlow
try:
    from ml_models.food_recommender import FoodRecommender
    TENSORFLOW_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    FoodRecommender = None
    TENSORFLOW_AVAILABLE = False
    logger.warning(f"TensorFlow not available. Food recommendations will be disabled: {e}")

from models.food_models import FoodItem

router = APIRouter(prefix="/foods", tags=["food-recommendations"])

# Global recommender instance (lazy loaded)
_recommender = None


def get_recommender() -> Optional[FoodRecommender]:
    """Get or initialize recommender model"""
    global _recommender
    
    if not TENSORFLOW_AVAILABLE:
        return None
    
    if _recommender is None:
        model_path = Path("models/food_recommender.h5")
        scaler_path = Path("models/food_recommender_scaler.pkl")
        encoders_path = Path("models/food_recommender_encoders.pkl")
        
        if model_path.exists():
            try:
                _recommender = FoodRecommender()
                _recommender.load_model(
                    str(model_path),
                    str(scaler_path) if scaler_path.exists() else None,
                    str(encoders_path) if encoders_path.exists() else None
                )
                logger.info("Food recommender model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load recommender model: {e}")
                return None
        else:
            logger.warning("Food recommender model not found. Train the model first.")
            return None
    
    return _recommender


@router.get("/recommend")
async def recommend_foods(
    user_id: int = Query(..., description="User ID"),
    calorie_goal: float = Query(2000, description="Daily calorie goal"),
    protein_goal: float = Query(100, description="Daily protein goal"),
    recent_calories: float = Query(0, description="Recent average calories (last 7 days)"),
    recent_protein: float = Query(0, description="Recent average protein (last 7 days)"),
    diet_type: str = Query("balanced", description="Diet type: balanced, high-protein, low-carb, vegetarian"),
    limit: int = Query(10, description="Number of recommendations"),
    category: Optional[str] = Query(None, description="Filter by category")
):
    """
    Get personalized food recommendations
    
    Args:
        user_id: User identifier
        calorie_goal: User's daily calorie goal
        protein_goal: User's daily protein goal
        recent_calories: Average calories consumed in last 7 days
        recent_protein: Average protein consumed in last 7 days
        diet_type: User's diet type
        limit: Number of recommendations to return
        category: Optional category filter
    
    Returns:
        List of recommended foods with scores
    """
    recommender = get_recommender()
    
    if recommender is None:
        raise HTTPException(
            status_code=503,
            detail="Recommendation model not available. Please train the model first."
        )
    
    # Get food data from global cache (set in main.py)
    from main import food_data_cache
    
    if not food_data_cache:
        raise HTTPException(
            status_code=503,
            detail="Food data not loaded"
        )
    
    # Filter by category if specified
    candidate_foods = food_data_cache
    if category:
        candidate_foods = [f for f in food_data_cache if f.category == category]
    
    if not candidate_foods:
        raise HTTPException(
            status_code=404,
            detail=f"No foods found in category: {category}"
        )
    
    # Build user context
    diet_type_encoded = {
        'balanced': 0,
        'high-protein': 1,
        'low-carb': 2,
        'vegetarian': 3
    }.get(diet_type.lower(), 0)
    
    user_context = np.array([
        calorie_goal,
        protein_goal,
        recent_calories,
        recent_protein,
        diet_type_encoded
    ])
    
    # Convert FoodItem objects to dicts
    candidate_foods_dicts = []
    for food in candidate_foods:
        food_dict = {
            'fdc_id': food.fdc_id,
            'name': food.name,
            'category': food.category,
            'calories': food.calories,
            'protein': food.protein,
            'fat': food.fat,
            'carbohydrates': food.carbohydrates,
            'fiber': food.fiber,
            'grade': food.grade,
            'nutrient_density_score': food.nutrient_density_score,
            'nutrients': {
                k: {'amount': v.amount} if hasattr(v, 'amount') else v
                for k, v in food.nutrients.items()
            }
        }
        candidate_foods_dicts.append(food_dict)
    
    # Get recommendations
    try:
        recommendations = recommender.recommend(
            user_id=user_id,
            candidate_foods=candidate_foods_dicts,
            user_context=user_context,
            top_k=limit * 2  # Get more candidates for diversity
        )
        
        # Add diversity: introduce random variation to scores for variety on refresh
        import random
        import time
        
        # Use current time in milliseconds for better randomization
        random.seed(int(time.time() * 1000) % 1000000)
        
        # Add random variation (±10% of score) to introduce variety
        # This ensures different foods appear on refresh while maintaining quality
        for rec in recommendations:
            variation = random.uniform(0.90, 1.10)  # ±10% variation
            rec['score'] = rec['score'] * variation
        
        # Re-sort by modified scores
        recommendations.sort(key=lambda x: x['score'], reverse=True)
        
        # Take top-k after diversity adjustment
        recommendations = recommendations[:limit]
        
        # Format response
        result = {
            'user_id': user_id,
            'recommendations': [
                {
                    'food': {
                        'fdc_id': rec['food']['fdc_id'],
                        'name': rec['food']['name'],
                        'category': rec['food']['category'],
                        'calories': rec['food']['calories'],
                        'protein': rec['food']['protein'],
                        'fat': rec['food']['fat'],
                        'carbohydrates': rec['food']['carbohydrates'],
                        'fiber': rec['food']['fiber'],
                        'grade': rec['food']['grade'],
                        'nutrient_density_score': rec['food']['nutrient_density_score']
                    },
                    'score': rec['score'],
                    'confidence': rec['confidence'],
                    'reason': _generate_recommendation_reason(rec, calorie_goal, protein_goal)
                }
                for rec in recommendations
            ],
            'total_candidates': len(candidate_foods),
            'returned': len(recommendations)
        }
        
        return JSONResponse(content=result)
    
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


def _generate_recommendation_reason(rec: Dict, calorie_goal: float, protein_goal: float) -> str:
    """Generate human-readable reason for recommendation"""
    food = rec['food']
    score = rec['score']
    
    reasons = []
    
    if score > 0.7:
        reasons.append("Highly recommended")
    
    # Check macro alignment
    if food.get('protein', 0) and food['protein'] >= protein_goal * 0.1:
        reasons.append("High protein content")
    
    if food.get('calories', 0) and abs(food['calories'] - calorie_goal / 5) < calorie_goal / 10:
        reasons.append("Fits your calorie goals")
    
    if food.get('grade') in ['S', 'A']:
        reasons.append("Excellent nutrient density")
    
    if not reasons:
        reasons.append("Personalized match")
    
    return ", ".join(reasons)


@router.get("/recommend/health")
async def recommendation_health():
    """Check if recommendation system is available"""
    recommender = get_recommender()
    
    return {
        "available": recommender is not None,
        "model_loaded": recommender is not None and recommender.model is not None
    }

