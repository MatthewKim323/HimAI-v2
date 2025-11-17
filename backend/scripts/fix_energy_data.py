#!/usr/bin/env python3
"""
Fix energy data in the Foundation Foods catalog by properly extracting
energy values from the original USDA CSV files.
"""

import pandas as pd
import json
import os
from pathlib import Path

def fix_energy_data():
    """Fix energy data in the Foundation Foods catalog."""
    
    # Paths
    data_path = Path("../../food_data/FoodData_Central_foundation_food_csv_2025-04-24")
    processed_path = Path("../../processed_data/foundation_foods_catalog.json")
    
    print("🔧 Fixing energy data in Foundation Foods catalog...")
    
    # Load the processed JSON file
    with open(processed_path, 'r') as f:
        data = json.load(f)
    
    print(f"📊 Loaded {len(data['foods'])} foods from processed data")
    
    # Load original CSV files
    print("📁 Loading original USDA CSV files...")
    
    # Load food data
    food_df = pd.read_csv(data_path / "food.csv")
    print(f"   Loaded {len(food_df)} foods from food.csv")
    
    # Load nutrient data
    nutrient_df = pd.read_csv(data_path / "nutrient.csv")
    print(f"   Loaded {len(nutrient_df)} nutrients from nutrient.csv")
    
    # Load food nutrient data
    food_nutrient_df = pd.read_csv(data_path / "food_nutrient.csv", low_memory=False)
    print(f"   Loaded {len(food_nutrient_df)} food-nutrient relationships")
    
    # Get energy nutrient IDs
    energy_nutrients = nutrient_df[nutrient_df['id'].isin([1008, 1062])]
    print(f"   Found {len(energy_nutrients)} energy nutrients:")
    for _, row in energy_nutrients.iterrows():
        print(f"     ID {row['id']}: {row['name']} ({row['unit_name']})")
    
    # Create a mapping of fdc_id to energy data
    energy_data = {}
    
    # Process each food
    for _, food_row in food_df.iterrows():
        fdc_id = food_row['fdc_id']
        
        # Get energy nutrients for this food
        food_energy = food_nutrient_df[
            (food_nutrient_df['fdc_id'] == fdc_id) & 
            (food_nutrient_df['nutrient_id'].isin([1008, 1062]))
        ]
        
        if len(food_energy) > 0:
            calories = None
            
            # Look for kcal first
            kcal_data = food_energy[food_energy['nutrient_id'] == 1008]
            if len(kcal_data) > 0:
                calories = kcal_data.iloc[0]['amount']
            
            # If no kcal, look for kJ and convert
            if calories is None:
                kj_data = food_energy[food_energy['nutrient_id'] == 1062]
                if len(kj_data) > 0:
                    kj_amount = kj_data.iloc[0]['amount']
                    calories = kj_amount / 4.184  # Convert kJ to kcal
            
            if calories is not None:
                energy_data[fdc_id] = {
                    'calories': calories,
                    'has_energy': True
                }
            else:
                energy_data[fdc_id] = {
                    'calories': None,
                    'has_energy': False
                }
        else:
            energy_data[fdc_id] = {
                'calories': None,
                'has_energy': False
            }
    
    print(f"📊 Processed energy data for {len(energy_data)} foods")
    
    # Count foods with and without energy
    foods_with_energy = sum(1 for data in energy_data.values() if data['has_energy'])
    foods_without_energy = len(energy_data) - foods_with_energy
    
    print(f"   Foods with energy data: {foods_with_energy}")
    print(f"   Foods without energy data: {foods_without_energy}")
    
    # Update the processed data
    print("🔄 Updating processed data...")
    
    updated_count = 0
    for food in data['foods']:
        fdc_id = food['fdc_id']
        if fdc_id in energy_data:
            energy_info = energy_data[fdc_id]
            
            if energy_info['has_energy']:
                # Update calories
                food['calories'] = energy_info['calories']
                
                # Recalculate NDS and grade if we have calories
                if energy_info['calories'] and energy_info['calories'] > 0:
                    # Simple NDS calculation (this should be improved)
                    # For now, just set a basic NDS based on calories
                    if energy_info['calories'] < 50:
                        food['nutrient_density_score'] = 2.0  # High NDS for low-calorie foods
                        food['grade'] = 'S'
                    elif energy_info['calories'] < 100:
                        food['nutrient_density_score'] = 1.5
                        food['grade'] = 'A'
                    elif energy_info['calories'] < 200:
                        food['nutrient_density_score'] = 1.0
                        food['grade'] = 'B'
                    elif energy_info['calories'] < 300:
                        food['nutrient_density_score'] = 0.7
                        food['grade'] = 'C'
                    else:
                        food['nutrient_density_score'] = 0.4
                        food['grade'] = 'D'
                
                updated_count += 1
            else:
                # No energy data available
                food['calories'] = None
                food['nutrient_density_score'] = None
                food['grade'] = 'NA'
    
    print(f"✅ Updated {updated_count} foods with energy data")
    
    # Save the updated data
    print("💾 Saving updated data...")
    with open(processed_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print("🎉 Energy data fix completed!")
    
    # Show some examples
    print("\n📋 Sample foods with energy data:")
    count = 0
    for food in data['foods']:
        if food.get('calories') and food['calories'] > 0:
            print(f"   {food['name']}: {food['calories']:.1f} cal, Grade: {food['grade']}")
            count += 1
            if count >= 10:
                break

if __name__ == "__main__":
    fix_energy_data()
