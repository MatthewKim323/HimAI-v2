#!/usr/bin/env python3
"""
Extract Complete Nutrient Profiles from USDA Foundation Foods Data
This script processes all available nutrients from the raw USDA CSV files
and creates a comprehensive food catalog with complete nutrient profiles.
"""

import pandas as pd
import json
import os
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_food_data():
    """Load all necessary CSV files from the food_data directory"""
    data_path = Path("../../food_data/FoodData_Central_foundation_food_csv_2025-04-24")
    
    logger.info("Loading USDA Foundation Foods data...")
    
    # Load core files
    food_df = pd.read_csv(data_path / "food.csv", low_memory=False)
    nutrient_df = pd.read_csv(data_path / "nutrient.csv", low_memory=False)
    food_nutrient_df = pd.read_csv(data_path / "food_nutrient.csv", low_memory=False)
    food_category_df = pd.read_csv(data_path / "food_category.csv", low_memory=False)
    food_portion_df = pd.read_csv(data_path / "food_portion.csv", low_memory=False)
    measure_unit_df = pd.read_csv(data_path / "measure_unit.csv", low_memory=False)
    
    logger.info(f"Loaded {len(food_df)} foods, {len(nutrient_df)} nutrients, {len(food_nutrient_df)} nutrient entries")
    
    return {
        'food': food_df,
        'nutrient': nutrient_df,
        'food_nutrient': food_nutrient_df,
        'food_category': food_category_df,
        'food_portion': food_portion_df,
        'measure_unit': measure_unit_df
    }

def get_foundation_foods(food_df):
    """Get only Foundation Foods (data_type = 'foundation_food')"""
    foundation_foods = food_df[food_df['data_type'] == 'foundation_food'].copy()
    logger.info(f"Found {len(foundation_foods)} Foundation Foods")
    return foundation_foods

def create_complete_nutrient_profiles(food_data, foundation_foods):
    """Create complete nutrient profiles for all Foundation Foods"""
    
    # Merge nutrient data with nutrient names
    nutrient_lookup = food_data['nutrient'].set_index('id')
    
    # Get all nutrient entries for Foundation Foods
    foundation_fdc_ids = set(foundation_foods['fdc_id'].astype(str))
    food_nutrient_subset = food_data['food_nutrient'][
        food_data['food_nutrient']['fdc_id'].astype(str).isin(foundation_fdc_ids)
    ].copy()
    
    logger.info(f"Processing {len(food_nutrient_subset)} nutrient entries for Foundation Foods")
    
    # Create complete food catalog
    complete_catalog = []
    
    for _, food in foundation_foods.iterrows():
        fdc_id = str(food['fdc_id'])
        food_name = food['description']
        
        # Get all nutrients for this food
        food_nutrients = food_nutrient_subset[
            food_nutrient_subset['fdc_id'].astype(str) == fdc_id
        ]
        
        # Create comprehensive nutrient profile
        nutrients = {}
        calories = None
        protein = None
        fat = None
        carbs = None
        fiber = None
        
        for _, nutrient_entry in food_nutrients.iterrows():
            nutrient_id = int(nutrient_entry['nutrient_id'])
            amount = nutrient_entry['amount']
            
            if nutrient_id in nutrient_lookup.index:
                nutrient_info = nutrient_lookup.loc[nutrient_id]
                nutrient_name = nutrient_info['name']
                unit = nutrient_info['unit_name']
                
                # Store in nutrients dictionary
                nutrients[nutrient_name] = {
                    'amount': amount,
                    'unit': unit
                }
                
                # Extract key macronutrients
                if nutrient_name == 'Energy' and unit == 'KCAL':
                    calories = amount
                elif nutrient_name == 'Protein':
                    protein = amount
                elif nutrient_name == 'Total lipid (fat)':
                    fat = amount
                elif nutrient_name == 'Carbohydrate, by difference':
                    carbs = amount
                elif nutrient_name == 'Fiber, total dietary':
                    fiber = amount
        
        # Calculate NDS (Nutrient Density Score)
        nds = calculate_nds(nutrients, calories)
        grade = calculate_grade(nds)
        
        # Create food item
        food_item = {
            'fdc_id': fdc_id,
            'name': food_name,
            'calories': calories,
            'protein': protein,
            'fat': fat,
            'carbohydrates': carbs,
            'fiber': fiber,
            'nutrients': nutrients,
            'nutrient_density_score': nds,
            'grade': grade,
            'category': 'Foundation Food'
        }
        
        complete_catalog.append(food_item)
    
    logger.info(f"Created complete nutrient profiles for {len(complete_catalog)} foods")
    return complete_catalog

def calculate_nds(nutrients, calories):
    """Calculate Nutrient Density Score"""
    if not calories or calories <= 0:
        return None
    
    # Essential nutrients for NDS calculation
    essential_nutrients = {
        'Vitamin A, RAE': 900,
        'Vitamin C, total ascorbic acid': 90,
        'Vitamin D (D2 + D3)': 20,
        'Vitamin E (alpha-tocopherol)': 15,
        'Vitamin K (phylloquinone)': 120,
        'Thiamin': 1.2,
        'Riboflavin': 1.3,
        'Niacin': 16,
        'Vitamin B-6': 1.7,
        'Folate, total': 400,
        'Vitamin B-12': 2.4,
        'Calcium, Ca': 1000,
        'Iron, Fe': 18,
        'Magnesium, Mg': 400,
        'Phosphorus, P': 700,
        'Potassium, K': 3500,
        'Zinc, Zn': 11,
        'Copper, Cu': 0.9,
        'Manganese, Mn': 2.3,
        'Selenium, Se': 55
    }
    
    total_dv_percentage = 0
    nutrients_count = 0
    
    for nutrient_name, daily_value in essential_nutrients.items():
        if nutrient_name in nutrients:
            amount = nutrients[nutrient_name]['amount']
            if amount and amount > 0:
                dv_percentage = (amount / daily_value) * 100
                total_dv_percentage += dv_percentage
                nutrients_count += 1
    
    if nutrients_count == 0:
        return None
    
    # NDS = (Sum of %DV for essential nutrients) / Calories per 100g
    nds = total_dv_percentage / calories
    return round(nds, 3)

def calculate_grade(nds):
    """Calculate grade based on NDS"""
    if nds is None:
        return 'NA'
    
    if nds >= 1.5:
        return 'S'
    elif nds >= 1.2:
        return 'A'
    elif nds >= 0.9:
        return 'B'
    elif nds >= 0.6:
        return 'C'
    elif nds >= 0.3:
        return 'D'
    else:
        return 'F'

def save_complete_catalog(catalog, output_path):
    """Save the complete catalog to JSON"""
    output_file = output_path / "complete_foundation_foods_catalog.json"
    
    with open(output_file, 'w') as f:
        json.dump(catalog, f, indent=2)
    
    logger.info(f"Saved complete catalog to {output_file}")
    
    # Also save statistics
    stats = {
        'total_foods': len(catalog),
        'foods_with_calories': len([f for f in catalog if f['calories']]),
        'foods_with_nds': len([f for f in catalog if f['nutrient_density_score']]),
        'grade_distribution': {}
    }
    
    for food in catalog:
        grade = food['grade']
        if grade in stats['grade_distribution']:
            stats['grade_distribution'][grade] += 1
        else:
            stats['grade_distribution'][grade] = 1
    
    stats_file = output_path / "complete_catalog_statistics.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    logger.info(f"Saved statistics to {stats_file}")
    return output_file

def main():
    """Main function to extract complete nutrient profiles"""
    logger.info("Starting complete nutrient extraction...")
    
    # Load data
    food_data = load_food_data()
    
    # Get Foundation Foods
    foundation_foods = get_foundation_foods(food_data['food'])
    
    # Create complete nutrient profiles
    complete_catalog = create_complete_nutrient_profiles(food_data, foundation_foods)
    
    # Save results
    output_path = Path("../../processed_data")
    output_path.mkdir(exist_ok=True)
    
    output_file = save_complete_catalog(complete_catalog, output_path)
    
    logger.info("Complete nutrient extraction finished!")
    logger.info(f"Processed {len(complete_catalog)} foods with complete nutrient profiles")
    
    # Print sample statistics
    sample_food = complete_catalog[0] if complete_catalog else None
    if sample_food:
        logger.info(f"Sample food: {sample_food['name']}")
        logger.info(f"Nutrients count: {len(sample_food['nutrients'])}")
        logger.info(f"NDS: {sample_food['nutrient_density_score']}")
        logger.info(f"Grade: {sample_food['grade']}")

if __name__ == "__main__":
    main()
