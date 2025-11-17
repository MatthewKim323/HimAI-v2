#!/usr/bin/env python3
"""
USDA Foundation Foods Data Processing Script
High-performance data processing using pandas and numpy
"""

import pandas as pd
import numpy as np
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
import asyncio
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class USDADataProcessor:
    """High-performance USDA data processor"""
    
    def __init__(self, data_path: str = "../data"):
        self.data_path = Path(data_path)
        self.output_path = Path("../processed_data")
        self.output_path.mkdir(exist_ok=True)
        
        # Essential nutrients for NDS calculation
        self.essential_nutrients = {
            'Protein': {'id': 1003, 'dv': 50},
            'Total lipid (fat)': {'id': 1004, 'dv': 65},
            'Carbohydrate, by difference': {'id': 1005, 'dv': 300},
            'Fiber, total dietary': {'id': 1079, 'dv': 25},
            'Calcium, Ca': {'id': 1087, 'dv': 1000},
            'Iron, Fe': {'id': 1089, 'dv': 18},
            'Magnesium, Mg': {'id': 1090, 'dv': 400},
            'Phosphorus, P': {'id': 1091, 'dv': 1000},
            'Potassium, K': {'id': 1092, 'dv': 3500},
            'Sodium, Na': {'id': 1093, 'dv': 2300},
            'Zinc, Zn': {'id': 1095, 'dv': 11},
            'Copper, Cu': {'id': 1098, 'dv': 0.9},
            'Manganese, Mn': {'id': 1101, 'dv': 2.3},
            'Selenium, Se': {'id': 1103, 'dv': 55},
            'Vitamin C, total ascorbic acid': {'id': 1162, 'dv': 90},
            'Thiamin': {'id': 1165, 'dv': 1.2},
            'Riboflavin': {'id': 1166, 'dv': 1.3},
            'Niacin': {'id': 1167, 'dv': 16},
            'Pantothenic acid': {'id': 1170, 'dv': 5},
            'Vitamin B-6': {'id': 1175, 'dv': 1.7},
            'Folate, total': {'id': 1176, 'dv': 400},
            'Vitamin B-12': {'id': 1178, 'dv': 2.4},
            'Vitamin A, RAE': {'id': 1106, 'dv': 900},
            'Vitamin E (alpha-tocopherol)': {'id': 1109, 'dv': 15},
            'Vitamin D (D2 + D3)': {'id': 1110, 'dv': 20},
            'Vitamin K (phylloquinone)': {'id': 1185, 'dv': 120},
        }
        
        # Grade cutoffs
        self.grade_cutoffs = {
            'S': 0.8,
            'A': 0.6,
            'B': 0.4,
            'C': 0.2,
            'D': 0.0
        }
    
    async def process_all_data(self) -> Dict[str, Any]:
        """Process all USDA data and create optimized JSON output"""
        logger.info("Starting USDA data processing...")
        
        try:
            # Load CSV files
            data_frames = await self._load_csv_files()
            
            # Process and join data
            processed_foods = await self._process_food_data(data_frames)
            
            # Calculate statistics
            stats = await self._calculate_statistics(processed_foods)
            
            # Save processed data
            output_file = self.output_path / "processed_usda_foods.json"
            await self._save_processed_data(processed_foods, output_file)
            
            # Save statistics
            stats_file = self.output_path / "processing_statistics.json"
            await self._save_statistics(stats, stats_file)
            
            logger.info(f"Processing complete! Processed {len(processed_foods)} foods")
            logger.info(f"Output saved to: {output_file}")
            
            return {
                'processed_foods': len(processed_foods),
                'output_file': str(output_file),
                'statistics': stats
            }
            
        except Exception as e:
            logger.error(f"Error processing USDA data: {e}")
            raise
    
    async def _load_csv_files(self) -> Dict[str, pd.DataFrame]:
        """Load all CSV files into pandas DataFrames"""
        logger.info("Loading CSV files...")
        
        csv_files = {
            'food': 'food.csv',
            'nutrient': 'nutrient.csv',
            'food_nutrient': 'food_nutrient.csv',
            'food_category': 'food_category.csv',
            'food_portion': 'food_portion.csv',
            'measure_unit': 'measure_unit.csv'
        }
        
        data_frames = {}
        
        for name, filename in csv_files.items():
            file_path = self.data_path / filename
            
            if file_path.exists():
                logger.info(f"Loading {filename}...")
                data_frames[name] = pd.read_csv(file_path)
                logger.info(f"Loaded {len(data_frames[name])} rows from {filename}")
            else:
                logger.warning(f"File not found: {file_path}")
                # Create sample data for development
                data_frames[name] = await self._create_sample_dataframe(name)
        
        return data_frames
    
    async def _create_sample_dataframe(self, name: str) -> pd.DataFrame:
        """Create sample DataFrame for development"""
        logger.info(f"Creating sample data for {name}")
        
        if name == 'food':
            return pd.DataFrame({
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
        elif name == 'nutrient':
            return pd.DataFrame({
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
        elif name == 'food_nutrient':
            sample_data = []
            for fdc_id in [1, 2, 3, 4, 5]:
                for nutrient_id in [1008, 1003, 1004, 1005, 1079]:
                    sample_data.append({
                        'fdc_id': fdc_id,
                        'nutrient_id': nutrient_id,
                        'amount': np.random.uniform(0.1, 100.0)
                    })
            return pd.DataFrame(sample_data)
        elif name == 'food_category':
            return pd.DataFrame({
                'id': [5, 6, 9],
                'description': ['Poultry Products', 'Vegetables and Vegetable Products', 'Fruits and Fruit Juices']
            })
        elif name == 'food_portion':
            return pd.DataFrame({
                'fdc_id': [1, 2, 3, 4, 5],
                'amount': [100, 100, 100, 100, 100],
                'measure_unit_id': [1, 1, 1, 1, 1]
            })
        elif name == 'measure_unit':
            return pd.DataFrame({
                'id': [1, 2, 3],
                'name': ['g', 'cup', 'slice']
            })
        else:
            return pd.DataFrame()
    
    async def _process_food_data(self, data_frames: Dict[str, pd.DataFrame]) -> List[Dict[str, Any]]:
        """Process and join all food data"""
        logger.info("Processing food data...")
        
        # Join food with categories
        food_with_categories = data_frames['food'].merge(
            data_frames['food_category'],
            left_on='food_category_id',
            right_on='id',
            how='left'
        )
        
        # Join with food-nutrient data
        food_nutrient_joined = food_with_categories.merge(
            data_frames['food_nutrient'],
            on='fdc_id',
            how='left'
        )
        
        # Join with nutrient definitions
        complete_data = food_nutrient_joined.merge(
            data_frames['nutrient'],
            left_on='nutrient_id',
            right_on='id',
            how='left'
        )
        
        # Process each food
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
    
    async def _create_food_item(self, fdc_id: int, food_group: pd.DataFrame) -> Optional[Dict[str, Any]]:
        """Create a food item from grouped data"""
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
                nutrient_profile = {
                    'name': nutrient_name,
                    'amount': amount,
                    'unit': unit,
                    'daily_value': self.essential_nutrients.get(nutrient_name, {}).get('dv'),
                    'daily_value_percentage': None
                }
                
                # Calculate %DV if daily value is available
                if amount is not None and nutrient_profile['daily_value']:
                    nutrient_profile['daily_value_percentage'] = (amount / nutrient_profile['daily_value']) * 100
                
                nutrients[nutrient_name] = nutrient_profile
                
                # Extract key macronutrients
                if nutrient_name == 'Energy (kcal)':
                    calories = amount
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
            
            # Create food item
            food_item = {
                'fdc_id': fdc_id,
                'name': food_name,
                'category': category,
                'calories': calories,
                'protein': protein,
                'fat': fat,
                'carbohydrates': carbs,
                'fiber': fiber,
                'nutrients': nutrients,
                'nutrient_density_score': nds_score,
                'grade': grade,
                'default_serving_size': 100.0,
                'default_serving_unit': 'g',
                'data_source': 'USDA Foundation Foods',
                'last_updated': datetime.now().isoformat()
            }
            
            return food_item
            
        except Exception as e:
            logger.error(f"Error creating food item {fdc_id}: {e}")
            return None
    
    async def _calculate_nds(self, nutrients: Dict[str, Any]) -> Optional[float]:
        """Calculate Nutrient Density Score"""
        try:
            total_score = 0.0
            nutrient_count = 0
            
            for nutrient_name, profile in nutrients.items():
                if profile['amount'] is None:
                    continue
                
                # Check if this is an essential nutrient
                if nutrient_name in self.essential_nutrients:
                    daily_value = self.essential_nutrients[nutrient_name]['dv']
                    if daily_value > 0:
                        score = profile['amount'] / daily_value
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
    
    async def _calculate_statistics(self, foods: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate comprehensive statistics about the processed data"""
        try:
            total_foods = len(foods)
            
            # Grade distribution
            grade_dist = {}
            for food in foods:
                grade = food['grade']
                grade_dist[grade] = grade_dist.get(grade, 0) + 1
            
            # Category distribution
            category_dist = {}
            for food in foods:
                category = food['category'] or "Unknown"
                category_dist[category] = category_dist.get(category, 0) + 1
            
            # Calorie range
            calories = [f['calories'] for f in foods if f['calories'] is not None]
            calorie_range = {
                "min": min(calories) if calories else 0,
                "max": max(calories) if calories else 0,
                "mean": np.mean(calories) if calories else 0
            }
            
            # Nutrient completeness
            complete_nutrients = sum(1 for f in foods if f['calories'] is not None and f['protein'] is not None)
            nutrient_completeness = (complete_nutrients / total_foods) * 100 if total_foods > 0 else 0
            
            return {
                'total_foods': total_foods,
                'total_nutrients': len(self.essential_nutrients),
                'grade_distribution': grade_dist,
                'category_distribution': category_dist,
                'calorie_range': calorie_range,
                'nutrient_completeness': nutrient_completeness,
                'processing_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error calculating statistics: {e}")
            return {}
    
    async def _save_processed_data(self, foods: List[Dict[str, Any]], output_file: Path):
        """Save processed food data to JSON file"""
        try:
            output_data = {
                'foods': foods,
                'metadata': {
                    'total_foods': len(foods),
                    'processing_timestamp': datetime.now().isoformat(),
                    'data_source': 'USDA Foundation Foods',
                    'version': '1.0.0'
                }
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved processed data to {output_file}")
            
        except Exception as e:
            logger.error(f"Error saving processed data: {e}")
            raise
    
    async def _save_statistics(self, stats: Dict[str, Any], stats_file: Path):
        """Save processing statistics to JSON file"""
        try:
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Saved statistics to {stats_file}")
            
        except Exception as e:
            logger.error(f"Error saving statistics: {e}")
            raise

async def main():
    """Main function to run the data processing"""
    processor = USDADataProcessor()
    
    try:
        result = await processor.process_all_data()
        
        print("\n" + "="*50)
        print("USDA DATA PROCESSING COMPLETE")
        print("="*50)
        print(f"Processed foods: {result['processed_foods']}")
        print(f"Output file: {result['output_file']}")
        print("\nStatistics:")
        stats = result['statistics']
        print(f"  Total foods: {stats['total_foods']}")
        print(f"  Grade distribution: {stats['grade_distribution']}")
        print(f"  Nutrient completeness: {stats['nutrient_completeness']:.1f}%")
        print(f"  Calorie range: {stats['calorie_range']['min']:.1f} - {stats['calorie_range']['max']:.1f} kcal")
        print("="*50)
        
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
