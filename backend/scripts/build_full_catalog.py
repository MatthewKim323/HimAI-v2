#!/usr/bin/env python3
"""
Full USDA Foundation Foods Catalog Builder
Processes all CSV files to create a comprehensive food catalog with NDS scoring and grading
"""

import pandas as pd
import numpy as np
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import asyncio
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FullCatalogBuilder:
    """Builds complete food catalog from USDA Foundation Foods dataset"""
    
    def __init__(self, data_path: str = "../food_data/FoodData_Central_foundation_food_csv_2025-04-24"):
        self.data_path = Path(data_path)
        self.output_path = Path("../processed_data")
        self.output_path.mkdir(exist_ok=True)
        
        # Essential nutrients for NDS calculation with Daily Values
        self.essential_nutrients = {
            # Vitamins
            'Vitamin A, RAE': {'id': 1106, 'dv': 900, 'unit': 'µg'},
            'Vitamin C, total ascorbic acid': {'id': 1162, 'dv': 90, 'unit': 'mg'},
            'Vitamin D (D2 + D3)': {'id': 1110, 'dv': 20, 'unit': 'µg'},
            'Vitamin E (alpha-tocopherol)': {'id': 1109, 'dv': 15, 'unit': 'mg'},
            'Vitamin K (phylloquinone)': {'id': 1185, 'dv': 120, 'unit': 'µg'},
            'Thiamin': {'id': 1165, 'dv': 1.2, 'unit': 'mg'},
            'Riboflavin': {'id': 1166, 'dv': 1.3, 'unit': 'mg'},
            'Niacin': {'id': 1167, 'dv': 16, 'unit': 'mg'},
            'Vitamin B-6': {'id': 1175, 'dv': 1.7, 'unit': 'mg'},
            'Folate, total': {'id': 1176, 'dv': 400, 'unit': 'µg'},
            'Vitamin B-12': {'id': 1178, 'dv': 2.4, 'unit': 'µg'},
            
            # Minerals
            'Calcium, Ca': {'id': 1087, 'dv': 1000, 'unit': 'mg'},
            'Iron, Fe': {'id': 1089, 'dv': 18, 'unit': 'mg'},
            'Magnesium, Mg': {'id': 1090, 'dv': 400, 'unit': 'mg'},
            'Phosphorus, P': {'id': 1091, 'dv': 1000, 'unit': 'mg'},
            'Potassium, K': {'id': 1092, 'dv': 3500, 'unit': 'mg'},
            'Sodium, Na': {'id': 1093, 'dv': 2300, 'unit': 'mg'},
            'Zinc, Zn': {'id': 1095, 'dv': 11, 'unit': 'mg'},
            'Copper, Cu': {'id': 1098, 'dv': 0.9, 'unit': 'mg'},
            'Manganese, Mn': {'id': 1101, 'dv': 2.3, 'unit': 'mg'},
            'Selenium, Se': {'id': 1103, 'dv': 55, 'unit': 'µg'},
        }
        
        # NDS Tier Grading System
        self.nds_tiers = {
            'S': {'min': 1.5, 'color': '#8B5CF6', 'emoji': '🟣'},
            'A': {'min': 1.2, 'color': '#10B981', 'emoji': '🟢'},
            'B': {'min': 0.9, 'color': '#3B82F6', 'emoji': '🔵'},
            'C': {'min': 0.6, 'color': '#F59E0B', 'emoji': '🟡'},
            'D': {'min': 0.3, 'color': '#F97316', 'emoji': '🟠'},
            'F': {'min': 0.0, 'color': '#EF4444', 'emoji': '🔴'}
        }
        
        # Food category mapping
        self.category_mapping = {
            1: 'Dairy and Egg Products',
            2: 'Spices and Herbs',
            3: 'Baby Foods',
            4: 'Fats and Oils',
            5: 'Poultry Products',
            6: 'Soups, Sauces, and Gravies',
            7: 'Sausages and Luncheon Meats',
            8: 'Breakfast Cereals',
            9: 'Fruits and Fruit Juices',
            10: 'Pork Products',
            11: 'Vegetables and Vegetable Products',
            12: 'Nut and Seed Products',
            13: 'Beef Products',
            14: 'Beverages',
            15: 'Finfish and Shellfish Products',
            16: 'Legumes and Legume Products',
            17: 'Lamb, Veal, and Game Products',
            18: 'Baked Products',
            19: 'Sweets',
            20: 'Cereal Grains and Pasta',
            21: 'Fast Foods',
            22: 'Meals, Entrees, and Side Dishes',
            23: 'Snacks',
            24: 'American Indian/Alaska Native Foods',
            25: 'Restaurant Foods'
        }
    
    async def build_full_catalog(self) -> Dict[str, Any]:
        """Build the complete food catalog"""
        logger.info("🚀 Starting Full USDA Foundation Foods Catalog Build...")
        
        try:
            # Load all CSV files
            data_frames = await self._load_all_csv_files()
            
            # Process and join data
            processed_foods = await self._process_all_foods(data_frames)
            
            # Calculate statistics
            stats = await self._calculate_comprehensive_stats(processed_foods)
            
            # Save processed data
            output_file = self.output_path / "full_usda_catalog.json"
            await self._save_full_catalog(processed_foods, output_file)
            
            # Save statistics
            stats_file = self.output_path / "catalog_statistics.json"
            await self._save_statistics(stats, stats_file)
            
            logger.info(f"✅ Catalog build complete! Processed {len(processed_foods)} foods")
            logger.info(f"📁 Output saved to: {output_file}")
            
            return {
                'processed_foods': len(processed_foods),
                'output_file': str(output_file),
                'statistics': stats
            }
            
        except Exception as e:
            logger.error(f"❌ Error building catalog: {e}")
            raise
    
    async def _load_all_csv_files(self) -> Dict[str, pd.DataFrame]:
        """Load all required CSV files"""
        logger.info("📂 Loading CSV files...")
        
        csv_files = {
            'food': 'food.csv',
            'nutrient': 'nutrient.csv',
            'food_nutrient': 'food_nutrient.csv',
            'food_category': 'food_category.csv',
            'food_portion': 'food_portion.csv',
            'measure_unit': 'measure_unit.csv',
            'foundation_food': 'foundation_food.csv'
        }
        
        data_frames = {}
        
        for name, filename in csv_files.items():
            file_path = self.data_path / filename
            
            if file_path.exists():
                logger.info(f"📄 Loading {filename}...")
                data_frames[name] = pd.read_csv(file_path)
                logger.info(f"✅ Loaded {len(data_frames[name])} rows from {filename}")
            else:
                logger.warning(f"⚠️ File not found: {file_path}")
        
        return data_frames
    
    async def _process_all_foods(self, data_frames: Dict[str, pd.DataFrame]) -> List[Dict[str, Any]]:
        """Process all foods with complete nutrient profiles"""
        logger.info("🔄 Processing food data...")
        
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
        
        # Join with food portions for serving sizes
        food_portion_data = data_frames['food_portion'].merge(
            data_frames['measure_unit'],
            left_on='measure_unit_id',
            right_on='id',
            how='left'
        )
        
        # Process each food
        processed_foods = []
        
        for fdc_id, group in complete_data.groupby('fdc_id'):
            try:
                food_item = await self._create_complete_food_item(
                    fdc_id, group, food_portion_data
                )
                if food_item:
                    processed_foods.append(food_item)
            except Exception as e:
                logger.warning(f"⚠️ Failed to process food {fdc_id}: {e}")
                continue
        
        return processed_foods
    
    async def _create_complete_food_item(
        self, 
        fdc_id: int, 
        food_group: pd.DataFrame,
        food_portion_data: pd.DataFrame
    ) -> Optional[Dict[str, Any]]:
        """Create a complete food item with all nutrients and serving sizes"""
        try:
            # Get basic food info
            food_info = food_group.iloc[0]
            food_name = food_info.get('description', 'Unknown Food')
            category_id = food_info.get('food_category_id', 0)
            category_name = self.category_mapping.get(category_id, 'Unknown')
            
            # Process all nutrients
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
                if nutrient_name == 'Energy':
                    calories = amount
                elif nutrient_name == 'Protein':
                    protein = amount
                elif nutrient_name == 'Total lipid (fat)':
                    fat = amount
                elif nutrient_name == 'Carbohydrate, by difference':
                    carbs = amount
                elif nutrient_name == 'Fiber, total dietary':
                    fiber = amount
            
            # Get serving sizes for this food
            serving_sizes = await self._get_serving_sizes(fdc_id, food_portion_data)
            
            # Calculate NDS and grade
            nds_score, grade_info = await self._calculate_nds_and_grade(nutrients, calories)
            
            # Create complete food item
            food_item = {
                'fdc_id': fdc_id,
                'name': food_name,
                'category': category_name,
                'category_id': category_id,
                'description': food_info.get('data_type', 'Foundation Foods'),
                
                # Core macronutrients
                'calories': calories,
                'protein': protein,
                'fat': fat,
                'carbohydrates': carbs,
                'fiber': fiber,
                
                # Complete nutrient profile
                'nutrients': nutrients,
                
                # NDS and grading
                'nutrient_density_score': nds_score,
                'grade': grade_info['grade'],
                'grade_color': grade_info['color'],
                'grade_emoji': grade_info['emoji'],
                
                # Serving information
                'default_serving_size': 100.0,
                'default_serving_unit': 'g',
                'serving_sizes': serving_sizes,
                
                # Metadata
                'data_source': 'USDA Foundation Foods',
                'last_updated': datetime.now().isoformat()
            }
            
            return food_item
            
        except Exception as e:
            logger.error(f"❌ Error creating food item {fdc_id}: {e}")
            return None
    
    async def _get_serving_sizes(self, fdc_id: int, food_portion_data: pd.DataFrame) -> List[Dict[str, Any]]:
        """Get all available serving sizes for a food"""
        try:
            food_portions = food_portion_data[food_portion_data['fdc_id'] == fdc_id]
            
            serving_sizes = []
            for _, portion in food_portions.iterrows():
                serving_sizes.append({
                    'amount': portion['amount'],
                    'unit': portion['name'],
                    'gram_weight': portion['gram_weight'],
                    'description': f"{portion['amount']} {portion['name']}"
                })
            
            # Add default 100g serving
            serving_sizes.insert(0, {
                'amount': 100,
                'unit': 'g',
                'gram_weight': 100,
                'description': '100g'
            })
            
            return serving_sizes
            
        except Exception as e:
            logger.warning(f"⚠️ Error getting serving sizes for {fdc_id}: {e}")
            return [{'amount': 100, 'unit': 'g', 'gram_weight': 100, 'description': '100g'}]
    
    async def _calculate_nds_and_grade(self, nutrients: Dict[str, Any], calories: Optional[float]) -> Tuple[Optional[float], Dict[str, str]]:
        """Calculate Nutrient Density Score and assign grade"""
        try:
            if calories is None or calories <= 0:
                return None, {'grade': 'NA', 'color': '#666666', 'emoji': '⚪'}
            
            # Calculate sum of %DV for essential nutrients
            total_dv_percentage = 0.0
            nutrient_count = 0
            
            for nutrient_name, profile in nutrients.items():
                if nutrient_name in self.essential_nutrients and profile['daily_value_percentage'] is not None:
                    total_dv_percentage += profile['daily_value_percentage']
                    nutrient_count += 1
            
            if nutrient_count == 0:
                return None, {'grade': 'NA', 'color': '#666666', 'emoji': '⚪'}
            
            # Calculate NDS: (Sum of %DV) / Calories per 100g
            nds_score = total_dv_percentage / calories
            
            # Assign grade based on NDS
            for grade, tier_info in self.nds_tiers.items():
                if nds_score >= tier_info['min']:
                    return nds_score, {
                        'grade': grade,
                        'color': tier_info['color'],
                        'emoji': tier_info['emoji']
                    }
            
            return nds_score, {'grade': 'F', 'color': '#EF4444', 'emoji': '🔴'}
            
        except Exception as e:
            logger.error(f"❌ Error calculating NDS: {e}")
            return None, {'grade': 'NA', 'color': '#666666', 'emoji': '⚪'}
    
    async def _calculate_comprehensive_stats(self, foods: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate comprehensive statistics about the catalog"""
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
                category = food['category']
                category_dist[category] = category_dist.get(category, 0) + 1
            
            # NDS statistics
            nds_scores = [f['nutrient_density_score'] for f in foods if f['nutrient_density_score'] is not None]
            nds_stats = {
                'min': min(nds_scores) if nds_scores else 0,
                'max': max(nds_scores) if nds_scores else 0,
                'mean': np.mean(nds_scores) if nds_scores else 0,
                'median': np.median(nds_scores) if nds_scores else 0
            }
            
            # Calorie range
            calories = [f['calories'] for f in foods if f['calories'] is not None]
            calorie_range = {
                'min': min(calories) if calories else 0,
                'max': max(calories) if calories else 0,
                'mean': np.mean(calories) if calories else 0
            }
            
            # Nutrient completeness
            complete_nutrients = sum(1 for f in foods if f['calories'] is not None and f['protein'] is not None)
            nutrient_completeness = (complete_nutrients / total_foods) * 100 if total_foods > 0 else 0
            
            return {
                'total_foods': total_foods,
                'total_nutrients': len(self.essential_nutrients),
                'grade_distribution': grade_dist,
                'category_distribution': category_dist,
                'nds_statistics': nds_stats,
                'calorie_range': calorie_range,
                'nutrient_completeness': nutrient_completeness,
                'processing_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculating statistics: {e}")
            return {}
    
    async def _save_full_catalog(self, foods: List[Dict[str, Any]], output_file: Path):
        """Save the complete food catalog"""
        try:
            output_data = {
                'foods': foods,
                'metadata': {
                    'total_foods': len(foods),
                    'processing_timestamp': datetime.now().isoformat(),
                    'data_source': 'USDA Foundation Foods',
                    'version': '2.0.0',
                    'nds_tiers': self.nds_tiers,
                    'essential_nutrients': list(self.essential_nutrients.keys())
                }
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            logger.info(f"💾 Saved full catalog to {output_file}")
            
        except Exception as e:
            logger.error(f"❌ Error saving catalog: {e}")
            raise
    
    async def _save_statistics(self, stats: Dict[str, Any], stats_file: Path):
        """Save processing statistics"""
        try:
            with open(stats_file, 'w', encoding='utf-8') as f:
                json.dump(stats, f, indent=2, ensure_ascii=False)
            
            logger.info(f"📊 Saved statistics to {stats_file}")
            
        except Exception as e:
            logger.error(f"❌ Error saving statistics: {e}")
            raise

async def main():
    """Main function to build the full catalog"""
    builder = FullCatalogBuilder()
    
    try:
        result = await builder.build_full_catalog()
        
        print("\n" + "="*60)
        print("🎉 FULL USDA FOUNDATION FOODS CATALOG COMPLETE!")
        print("="*60)
        print(f"📊 Processed foods: {result['processed_foods']}")
        print(f"📁 Output file: {result['output_file']}")
        print("\n📈 Statistics:")
        stats = result['statistics']
        print(f"  Total foods: {stats['total_foods']}")
        print(f"  Grade distribution: {stats['grade_distribution']}")
        print(f"  NDS range: {stats['nds_statistics']['min']:.2f} - {stats['nds_statistics']['max']:.2f}")
        print(f"  Nutrient completeness: {stats['nutrient_completeness']:.1f}%")
        print("="*60)
        
    except Exception as e:
        logger.error(f"❌ Build failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
