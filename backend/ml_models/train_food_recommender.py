#!/usr/bin/env python3
"""
Training script for Food Recommendation System
Generates mock data and trains the NCF model
"""

import sys
from pathlib import Path
import pandas as pd
import numpy as np
import json
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_models.food_recommender import FoodRecommender
from data_processing.usda_processor import USDAProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_mock_data(foods: list, num_users: int = 200) -> tuple:
    """
    Generate mock user and interaction data for training
    
    Args:
        foods: List of food items
        num_users: Number of mock users to create
    
    Returns:
        Tuple of (users_df, interactions_df)
    """
    logger.info(f"Generating mock data for {num_users} users and {len(foods)} foods")
    
    # Generate users
    users_data = []
    for user_id in range(1, num_users + 1):
        calorie_goal = np.random.choice([1800, 2000, 2200, 2500, 2800])
        protein_goal = np.random.choice([80, 100, 120, 150, 180])
        diet_type = np.random.choice(['balanced', 'high-protein', 'low-carb', 'vegetarian'])
        
        users_data.append({
            'user_id': user_id,
            'calorie_goal': calorie_goal,
            'protein_goal': protein_goal,
            'diet_type': diet_type,
            'diet_type_encoded': {'balanced': 0, 'high-protein': 1, 'low-carb': 2, 'vegetarian': 3}[diet_type],
            'recent_calories': np.random.normal(calorie_goal * 0.8, calorie_goal * 0.1),
            'recent_protein': np.random.normal(protein_goal * 0.7, protein_goal * 0.1)
        })
    
    users_df = pd.DataFrame(users_data)
    
    # Generate interactions (users consuming foods)
    interactions_data = []
    
    for user_id in range(1, num_users + 1):
        user = users_df[users_df['user_id'] == user_id].iloc[0]
        
        # Each user interacts with 30-80 random foods (more data = better training)
        num_interactions = np.random.randint(30, 81)
        selected_foods = np.random.choice(foods, num_interactions, replace=False)
        
        for food in selected_foods:
            # Higher probability of "liking" foods that match goals
            food_calories = food.get('calories', 0) or 0
            food_protein = food.get('protein', 0) or 0
            
            # Preference based on macro alignment
            calorie_match = 1 - abs(food_calories - user['calorie_goal'] / 5) / (user['calorie_goal'] / 5)
            protein_match = 1 - abs(food_protein - user['protein_goal'] / 5) / (user['protein_goal'] / 5)
            
            # Higher protein foods preferred by high-protein diet users
            if user['diet_type'] == 'high-protein' and food_protein > 20:
                protein_match *= 1.5
            
            # Combined preference score (weighted)
            preference = (calorie_match * 0.4 + protein_match * 0.6)
            
            # Add less randomness for cleaner signal
            preference += np.random.normal(0, 0.15)
            
            # More nuanced rating (use threshold with some variance)
            threshold = 0.45 + np.random.uniform(-0.1, 0.1)
            rating = 1 if preference > threshold else 0
            
            interactions_data.append({
                'user_id': user_id,
                'food_id': food.get('fdc_id', food.get('id')),
                'rating': rating
            })
    
    interactions_df = pd.DataFrame(interactions_data)
    
    logger.info(f"Generated {len(users_df)} users and {len(interactions_df)} interactions")
    
    return users_df, interactions_df


async def load_food_data() -> tuple:
    """Load food data from processed catalog"""
    processor = USDAProcessor()
    foods = await processor.load_and_process_data()
    
    # Convert to list of dicts
    foods_list = []
    food_nutrient_data = {}
    
    for food in foods:
        food_dict = {
            'fdc_id': food.fdc_id,
            'name': food.name,
            'calories': food.calories,
            'protein': food.protein,
            'fat': food.fat,
            'carbohydrates': food.carbohydrates,
            'fiber': food.fiber,
            'nutrients': {k: {'amount': v.amount} if hasattr(v, 'amount') else v 
                         for k, v in food.nutrients.items()}
        }
        foods_list.append(food_dict)
        
        # Extract nutrient array
        nutrients = []
        nutrient_keys = [
            'calories', 'protein', 'fat', 'carbohydrates', 'fiber',
            'Calcium, Ca', 'Iron, Fe', 'Magnesium, Mg', 'Phosphorus, P', 'Potassium, K',
            'Sodium, Na', 'Zinc, Zn', 'Copper, Cu', 'Manganese, Mn', 'Selenium, Se',
            'Vitamin C, total ascorbic acid', 'Thiamin', 'Riboflavin', 'Niacin',
            'Vitamin B-6', 'Folate, total', 'Vitamin B-12', 'Vitamin A, RAE',
            'Vitamin E (alpha-tocopherol)', 'Vitamin D (D2 + D3)', 'Vitamin K (phylloquinone)'
        ]
        
        for key in nutrient_keys:
            if key in food.nutrients:
                value = food.nutrients[key].amount if hasattr(food.nutrients[key], 'amount') else food.nutrients[key]
            elif key.lower() in food_dict:
                value = food_dict[key.lower()]
            else:
                value = 0.0
            nutrients.append(float(value) if value else 0.0)
        
        # Pad to 70
        while len(nutrients) < 70:
            nutrients.append(0.0)
        
        food_nutrient_data[food.fdc_id] = np.array(nutrients[:70])
    
    return foods_list, food_nutrient_data


async def main_async():
    """Main training function (async)"""
    logger.info("Starting Food Recommender training")
    
    # Load food data
    logger.info("Loading food data...")
    foods_list, food_nutrient_data = await load_food_data()
    logger.info(f"Loaded {len(foods_list)} foods")
    
    # Create foods DataFrame
    foods_df = pd.DataFrame([
        {'food_id': f.get('fdc_id', f.get('id')), 'name': f.get('name')}
        for f in foods_list
    ])
    
    # Generate mock data
    logger.info("Generating mock training data...")
    users_df, interactions_df = generate_mock_data(foods_list, num_users=100)
    
    # Initialize recommender
    recommender = FoodRecommender()
    
    # Prepare training data
    logger.info("Preparing training data...")
    user_ids, food_ids, nutrients, contexts, ratings = recommender.prepare_training_data(
        interactions_df,
        users_df,
        foods_df,
        food_nutrient_data
    )
    
    # Build model
    logger.info("Building model...")
    recommender.build_model(
        num_users=len(np.unique(user_ids)),
        num_foods=len(np.unique(food_ids)),
        nutrient_dim=70,
        context_dim=5
    )
    
    # Train model with improved hyperparameters
    logger.info("Training model...")
    history = recommender.train(
        user_ids, food_ids, nutrients, contexts, ratings,
        validation_split=0.15,  # More validation data
        epochs=30,  # More epochs
        batch_size=128,  # Smaller batch for better gradient updates
        verbose=1
    )
    
    # Save model
    model_dir = Path("models")
    model_dir.mkdir(exist_ok=True)
    
    model_path = model_dir / "food_recommender.h5"
    scaler_path = model_dir / "food_recommender_scaler.pkl"
    encoders_path = model_dir / "food_recommender_encoders.pkl"
    
    recommender.save_model(
        str(model_path),
        str(scaler_path),
        str(encoders_path)
    )
    
    logger.info("Training completed!")
    logger.info(f"Final validation accuracy: {history.history['val_accuracy'][-1]:.4f}")
    logger.info(f"Model saved to {model_path}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main_async())

