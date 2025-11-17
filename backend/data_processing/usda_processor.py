import pandas as pd
import numpy as np
import json
from typing import List, Dict, Any, Optional
import logging
from pathlib import Path
import asyncio
from datetime import datetime

from models.food_models import FoodItem, NutrientProfile, DatabaseStats

logger = logging.getLogger(__name__)

class USDAProcessor:
    """High-performance USDA Foundation Foods data processor using pandas"""
    
    def __init__(self, data_path: str = "../data"):
        self.data_path = Path(data_path)
        self.food_df = None
        self.nutrient_df = None
        self.food_nutrient_df = None
        self.food_category_df = None
        self.food_portion_df = None
        self.measure_unit_df = None
        
        # Essential nutrients for NDS calculation
        self.essential_nutrients = {
            'Protein': {'id': 1003, 'dv': 50},  # g
            'Total lipid (fat)': {'id': 1004, 'dv': 65},  # g
            'Carbohydrate, by difference': {'id': 1005, 'dv': 300},  # g
            'Fiber, total dietary': {'id': 1079, 'dv': 25},  # g
            'Calcium, Ca': {'id': 1087, 'dv': 1000},  # mg
            'Iron, Fe': {'id': 1089, 'dv': 18},  # mg
            'Magnesium, Mg': {'id': 1090, 'dv': 400},  # mg
            'Phosphorus, P': {'id': 1091, 'dv': 1000},  # mg
            'Potassium, K': {'id': 1092, 'dv': 3500},  # mg
            'Sodium, Na': {'id': 1093, 'dv': 2300},  # mg
            'Zinc, Zn': {'id': 1095, 'dv': 11},  # mg
            'Copper, Cu': {'id': 1098, 'dv': 0.9},  # mg
            'Manganese, Mn': {'id': 1101, 'dv': 2.3},  # mg
            'Selenium, Se': {'id': 1103, 'dv': 55},  # µg
            'Vitamin C, total ascorbic acid': {'id': 1162, 'dv': 90},  # mg
            'Thiamin': {'id': 1165, 'dv': 1.2},  # mg
            'Riboflavin': {'id': 1166, 'dv': 1.3},  # mg
            'Niacin': {'id': 1167, 'dv': 16},  # mg
            'Pantothenic acid': {'id': 1170, 'dv': 5},  # mg
            'Vitamin B-6': {'id': 1175, 'dv': 1.7},  # mg
            'Folate, total': {'id': 1176, 'dv': 400},  # µg
            'Vitamin B-12': {'id': 1178, 'dv': 2.4},  # µg
            'Vitamin A, RAE': {'id': 1106, 'dv': 900},  # µg
            'Vitamin E (alpha-tocopherol)': {'id': 1109, 'dv': 15},  # mg
            'Vitamin D (D2 + D3)': {'id': 1110, 'dv': 20},  # µg
            'Vitamin K (phylloquinone)': {'id': 1185, 'dv': 120},  # µg
        }
        
        # Grade cutoffs for NDS
        self.grade_cutoffs = {
            'S': 0.8,  # Top tier
            'A': 0.6,  # High tier
            'B': 0.4,  # Medium tier
            'C': 0.2,  # Low tier
            'D': 0.0   # Bottom tier
        }
    
    async def load_and_process_data(self) -> List[FoodItem]:
        """Load and process all USDA CSV files into FoodItem objects"""
        logger.info("Starting USDA data processing...")
        
        # Try to load from processed Foundation Foods first
        foundation_data_path = Path("../processed_data/categorized_foundation_foods_catalog.json")
        if foundation_data_path.exists():
            logger.info(f"Loading Foundation Foods from: {foundation_data_path.absolute()}")
            return await self._load_foundation_foods(foundation_data_path)
        else:
            logger.warning(f"Foundation Foods file not found at: {foundation_data_path.absolute()}")
        
        # Fallback to CSV processing
        logger.info("Foundation Foods not found, loading from CSV files...")
        await self._load_csv_files()
        processed_foods = await self._process_food_data()
        
        logger.info(f"Successfully processed {len(processed_foods)} foods")
        return processed_foods
    
    async def _load_foundation_foods(self, data_path: Path) -> List[FoodItem]:
        """Load Foundation Foods from processed JSON data"""
        try:
            with open(data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            foods = []
            # Handle both array format (complete catalog) and object format (original catalog)
            food_list = data if isinstance(data, list) else data.get('foods', [])
            for food_data in food_list:
                # Convert nutrients dict to NutrientProfile objects
                nutrients = {}
                calories = None
                protein = None
                fat = None
                carbs = None
                fiber = None
                
                for nutrient_name, nutrient_info in food_data.get('nutrients', {}).items():
                    amount = nutrient_info.get('amount')
                    unit = nutrient_info.get('unit', 'g')
                    
                    nutrients[nutrient_name] = NutrientProfile(
                        name=nutrient_info.get('name', nutrient_name),
                        amount=amount,
                        unit=unit
                    )
                    
                    # Extract key macronutrients with proper energy conversion
                    if nutrient_name == 'Energy' and unit == 'KCAL':
                        calories = amount
                    elif nutrient_name == 'Energy' and unit == 'kJ':
                        # Convert kJ to kcal (1 kcal = 4.184 kJ)
                        calories = amount / 4.184 if amount else None
                    elif nutrient_name == 'Protein':
                        protein = amount
                    elif nutrient_name == 'Total lipid (fat)':
                        fat = amount
                    elif nutrient_name == 'Carbohydrate, by difference':
                        carbs = amount
                    elif nutrient_name == 'Fiber, total dietary':
                        fiber = amount
                
                # Use extracted values or fallback to direct values
                if calories is None:
                    calories = food_data.get('calories')
                
                # If still no calories, provide reasonable defaults based on food type
                if calories is None or calories == 0:
                    food_name = food_data.get('name', '').lower()
                    if any(word in food_name for word in ['berry', 'berries', 'blackberry', 'blueberry', 'strawberry']):
                        calories = 57  # Average for berries
                    elif any(word in food_name for word in ['rice', 'grain', 'wheat', 'oats']):
                        calories = 130  # Average for grains
                    elif any(word in food_name for word in ['bean', 'lentil', 'pea']):
                        calories = 120  # Average for legumes
                    elif any(word in food_name for word in ['vegetable', 'broccoli', 'carrot', 'spinach']):
                        calories = 25   # Average for vegetables
                    elif any(word in food_name for word in ['fruit', 'apple', 'banana', 'orange']):
                        calories = 60   # Average for fruits
                    elif any(word in food_name for word in ['meat', 'beef', 'chicken', 'pork']):
                        calories = 250  # Average for meats
                    elif any(word in food_name for word in ['fish', 'salmon', 'tuna']):
                        calories = 200  # Average for fish
                    elif any(word in food_name for word in ['dairy', 'milk', 'cheese', 'yogurt']):
                        calories = 150  # Average for dairy
                    else:
                        calories = 100  # General default
                
                if protein is None:
                    protein = food_data.get('protein')
                if fat is None:
                    fat = food_data.get('fat')
                if carbs is None:
                    carbs = food_data.get('carbohydrates')
                if fiber is None:
                    fiber = food_data.get('fiber')
                
                # Calculate NDS and grade if we have calories
                nds = food_data.get('nutrient_density_score')
                grade = food_data.get('grade', 'NA')
                
                if calories and calories > 0:
                    # If we don't have NDS, calculate a basic one based on calories
                    if nds is None:
                        # Simple NDS calculation based on calories (lower calories = higher NDS)
                        if calories < 50:
                            nds = 2.0  # High NDS for low-calorie foods
                            grade = 'S'
                        elif calories < 100:
                            nds = 1.5
                            grade = 'A'
                        elif calories < 200:
                            nds = 1.0
                            grade = 'B'
                        elif calories < 300:
                            nds = 0.7
                            grade = 'C'
                        else:
                            nds = 0.4
                            grade = 'D'
                    elif grade == 'NA':
                        # Calculate grade from NDS
                        if nds >= 1.5:
                            grade = 'S'
                        elif nds >= 1.2:
                            grade = 'A'
                        elif nds >= 0.9:
                            grade = 'B'
                        elif nds >= 0.6:
                            grade = 'C'
                        elif nds >= 0.3:
                            grade = 'D'
                        else:
                            grade = 'F'
                
                # Create FoodItem
                food_item = FoodItem(
                    fdc_id=food_data.get('fdc_id', 0),
                    name=food_data.get('name', 'Unknown Food'),
                    category=food_data.get('category', 'Unknown'),
                    calories=calories,
                    protein=protein,
                    fat=fat,
                    carbohydrates=carbs,
                    fiber=fiber,
                    nutrients=nutrients,
                    nutrient_density_score=nds,
                    grade=grade,
                    default_serving_size=food_data.get('default_serving_size', 100.0),
                    default_serving_unit=food_data.get('default_serving_unit', 'g')
                )
                foods.append(food_item)
            
            logger.info(f"Loaded {len(foods)} Foundation Foods from processed data")
            return foods
            
        except Exception as e:
            logger.error(f"Error loading Foundation Foods: {e}")
            return []
    
    async def _load_csv_files(self):
        """Load all required CSV files into pandas DataFrames"""
        try:
            # Load core data files
            self.food_df = pd.read_csv(self.data_path / "food.csv")
            self.nutrient_df = pd.read_csv(self.data_path / "nutrient.csv")
            self.food_nutrient_df = pd.read_csv(self.data_path / "food_nutrient.csv")
            self.food_category_df = pd.read_csv(self.data_path / "food_category.csv")
            self.food_portion_df = pd.read_csv(self.data_path / "food_portion.csv")
            self.measure_unit_df = pd.read_csv(self.data_path / "measure_unit.csv")
            
            logger.info("Successfully loaded all CSV files")
            
        except FileNotFoundError as e:
            logger.error(f"CSV file not found: {e}")
            # Create sample data for development
            await self._create_sample_data()
    
    async def _create_sample_data(self):
        """Create sample data for development when CSV files are not available"""
        logger.info("Creating sample data for development...")
        
        # Sample food data
        self.food_df = pd.DataFrame({
            'fdc_id': [1, 2, 3, 4, 5],
            'description': [
                'Apple, raw',
                'Banana, raw',
                'Chicken breast, skinless, boneless, raw',
                'Salmon, Atlantic, farmed, raw',
                'Broccoli, raw'
            ],
            'food_category_id': [9, 9, 5, 5, 6]
        })
        
        # Sample nutrient data
        self.nutrient_df = pd.DataFrame({
            'id': [1008, 1003, 1004, 1005, 1079],
            'name': [
                'Energy (kcal)',
                'Protein',
                'Total lipid (fat)',
                'Carbohydrate, by difference',
                'Fiber, total dietary'
            ],
            'unit_name': ['kcal', 'g', 'g', 'g', 'g']
        })
        
        # Sample food-nutrient relationships
        sample_food_nutrients = []
        for fdc_id in [1, 2, 3, 4, 5]:
            for nutrient_id in [1008, 1003, 1004, 1005, 1079]:
                sample_food_nutrients.append({
                    'fdc_id': fdc_id,
                    'nutrient_id': nutrient_id,
                    'amount': np.random.uniform(0.1, 100.0)
                })
        
        self.food_nutrient_df = pd.DataFrame(sample_food_nutrients)
        
        # Sample category data
        self.food_category_df = pd.DataFrame({
            'id': [5, 6, 9],
            'description': ['Poultry Products', 'Vegetables and Vegetable Products', 'Fruits and Fruit Juices']
        })
        
        # Sample portion data
        self.food_portion_df = pd.DataFrame({
            'fdc_id': [1, 2, 3, 4, 5],
            'amount': [100, 100, 100, 100, 100],
            'measure_unit_id': [1, 1, 1, 1, 1]
        })
        
        # Sample measure unit data
        self.measure_unit_df = pd.DataFrame({
            'id': [1, 2, 3],
            'name': ['g', 'cup', 'slice']
        })
    
    async def _process_food_data(self) -> List[FoodItem]:
        """Process and join all food data into FoodItem objects"""
        logger.info("Processing food data...")
        
        # Join food with categories
        food_with_categories = self.food_df.merge(
            self.food_category_df,
            left_on='food_category_id',
            right_on='id',
            how='left'
        )
        
        # Join with food-nutrient data
        food_nutrient_joined = food_with_categories.merge(
            self.food_nutrient_df,
            on='fdc_id',
            how='left'
        )
        
        # Join with nutrient definitions
        complete_data = food_nutrient_joined.merge(
            self.nutrient_df,
            left_on='nutrient_id',
            right_on='id',
            how='left'
        )
        
        # Group by food and process nutrients
        processed_foods = []
        
        for fdc_id, group in complete_data.groupby('fdc_id'):
            try:
                food_item = await self._create_food_item(fdc_id, group)
                if food_item:
                    processed_foods.append(food_item)
            except Exception as e:
                logger.warning(f"Failed to process food {fdc_id}: {e}")
                continue
        
        return processed_foods
    
    async def _create_food_item(self, fdc_id: int, food_group: pd.DataFrame) -> Optional[FoodItem]:
        """Create a FoodItem from grouped food data"""
        try:
            # Get basic food info
            food_info = food_group.iloc[0]
            food_name = food_info['description']
            category = food_info.get('description_y', 'Unknown')
            
            # Process nutrients
            nutrients = {}
            calories = None
            protein = None
            fat = None
            carbs = None
            fiber = None
            
            for _, row in food_group.iterrows():
                if pd.isna(row['name']):
                    continue
                
                nutrient_name = row['name']
                amount = row['amount'] if not pd.isna(row['amount']) else None
                unit = row['unit_name'] if not pd.isna(row['unit_name']) else 'g'
                
                # Create nutrient profile
                nutrient_profile = NutrientProfile(
                    name=nutrient_name,
                    amount=amount,
                    unit=unit
                )
                
                nutrients[nutrient_name] = nutrient_profile
                
                # Extract key macronutrients
                if nutrient_name == 'Energy' and unit == 'KCAL':
                    calories = amount
                elif nutrient_name == 'Energy' and unit == 'kJ':
                    # Convert kJ to kcal (1 kcal = 4.184 kJ)
                    calories = amount / 4.184 if amount else None
                elif nutrient_name == 'Protein':
                    protein = amount
                elif nutrient_name == 'Total lipid (fat)':
                    fat = amount
                elif nutrient_name == 'Carbohydrate, by difference':
                    carbs = amount
                elif nutrient_name == 'Fiber, total dietary':
                    fiber = amount
            
            # Calculate nutrient density score and grade
            nds_score = await self._calculate_nds(nutrients)
            grade = await self._calculate_grade(nds_score, calories)
            
            # Create FoodItem
            food_item = FoodItem(
                fdc_id=fdc_id,
                name=food_name,
                category=category,
                calories=calories,
                protein=protein,
                fat=fat,
                carbohydrates=carbs,
                fiber=fiber,
                nutrients=nutrients,
                nutrient_density_score=nds_score,
                grade=grade,
                default_serving_size=100.0,
                default_serving_unit="g"
            )
            
            return food_item
            
        except Exception as e:
            logger.error(f"Error creating food item {fdc_id}: {e}")
            return None
    
    async def _calculate_nds(self, nutrients: Dict[str, NutrientProfile]) -> Optional[float]:
        """Calculate Nutrient Density Score"""
        try:
            total_score = 0.0
            nutrient_count = 0
            
            for nutrient_name, profile in nutrients.items():
                if profile.amount is None:
                    continue
                
                # Check if this is an essential nutrient
                if nutrient_name in self.essential_nutrients:
                    daily_value = self.essential_nutrients[nutrient_name]['dv']
                    if daily_value > 0:
                        score = profile.amount / daily_value
                        total_score += score
                        nutrient_count += 1
            
            if nutrient_count == 0:
                return None
            
            return total_score / nutrient_count
            
        except Exception as e:
            logger.error(f"Error calculating NDS: {e}")
            return None
    
    async def _calculate_grade(self, nds_score: Optional[float], calories: Optional[float]) -> str:
        """Calculate grade based on NDS score and calorie availability"""
        if calories is None or calories <= 0:
            return "NA"
        
        if nds_score is None:
            return "D"
        
        # Determine grade based on NDS score
        for grade, cutoff in self.grade_cutoffs.items():
            if nds_score >= cutoff:
                return grade
        
        return "D"
    
    async def get_database_stats(self, foods: List[FoodItem]) -> DatabaseStats:
        """Get comprehensive statistics about the food database"""
        try:
            total_foods = len(foods)
            
            # Grade distribution
            grade_dist = {}
            for food in foods:
                grade = food.grade
                grade_dist[grade] = grade_dist.get(grade, 0) + 1
            
            # Category distribution
            category_dist = {}
            for food in foods:
                category = food.category or "Unknown"
                category_dist[category] = category_dist.get(category, 0) + 1
            
            # Calorie range
            calories = [f.calories for f in foods if f.calories is not None]
            calorie_range = {
                "min": min(calories) if calories else 0,
                "max": max(calories) if calories else 0,
                "mean": np.mean(calories) if calories else 0
            }
            
            # Nutrient completeness
            complete_nutrients = sum(1 for f in foods if f.calories is not None and f.protein is not None)
            nutrient_completeness = (complete_nutrients / total_foods) * 100 if total_foods > 0 else 0
            
            return DatabaseStats(
                total_foods=total_foods,
                total_nutrients=len(self.essential_nutrients),
                grade_distribution=grade_dist,
                category_distribution=category_dist,
                calorie_range=calorie_range,
                nutrient_completeness=nutrient_completeness,
                last_updated=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Error calculating database stats: {e}")
            return DatabaseStats(
                total_foods=0,
                total_nutrients=0,
                grade_distribution={},
                category_distribution={},
                calorie_range={"min": 0, "max": 0, "mean": 0},
                nutrient_completeness=0,
                last_updated=datetime.now()
            )
