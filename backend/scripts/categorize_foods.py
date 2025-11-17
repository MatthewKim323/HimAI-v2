#!/usr/bin/env python3
"""
Categorize Foundation Foods into predefined categories
"""

import json
import re
from pathlib import Path

def categorize_food(food_name):
    """Categorize a food based on its name"""
    name_lower = food_name.lower()
    
    # Fruits
    fruit_keywords = [
        'apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'blackberry', 'raspberry',
        'cherry', 'peach', 'pear', 'plum', 'kiwi', 'mango', 'pineapple', 'lemon', 'lime',
        'cranberry', 'pomegranate', 'avocado', 'coconut', 'fig', 'date', 'prune', 'raisin',
        'grapefruit', 'tangerine', 'mandarin', 'cantaloupe', 'watermelon', 'honeydew',
        'papaya', 'passion fruit', 'dragon fruit', 'star fruit', 'persimmon', 'elderberry',
        'currant', 'gooseberry', 'boysenberry', 'loganberry', 'mulberry', 'black currant',
        'red currant', 'white currant', 'juniper berry', 'serviceberry', 'chokeberry',
        'huckleberry', 'lingonberry', 'cloudberry', 'salmonberry', 'wineberry'
    ]
    
    # Vegetables
    vegetable_keywords = [
        'broccoli', 'carrot', 'spinach', 'lettuce', 'tomato', 'cucumber', 'pepper', 'onion',
        'garlic', 'potato', 'sweet potato', 'corn', 'peas', 'beans', 'celery', 'cabbage',
        'cauliflower', 'brussels sprouts', 'kale', 'chard', 'collard', 'mustard greens',
        'turnip', 'radish', 'beet', 'parsnip', 'rutabaga', 'squash', 'pumpkin', 'zucchini',
        'eggplant', 'asparagus', 'artichoke', 'leek', 'shallot', 'scallion', 'chive',
        'mushroom', 'okra', 'rhubarb', 'fennel', 'endive', 'arugula', 'watercress',
        'dandelion', 'purslane', 'lamb\'s quarters', 'amaranth', 'quinoa', 'buckwheat'
    ]
    
    # Meats
    meat_keywords = [
        'beef', 'chicken', 'pork', 'lamb', 'turkey', 'duck', 'goose', 'veal', 'bison',
        'venison', 'elk', 'rabbit', 'goat', 'mutton', 'ham', 'bacon', 'sausage', 'hot dog',
        'bratwurst', 'chorizo', 'pepperoni', 'salami', 'prosciutto', 'pancetta', 'liver',
        'kidney', 'heart', 'tongue', 'brain', 'sweetbread', 'tripe', 'oxtail', 'shank',
        'ribs', 'loin', 'chop', 'cutlet', 'tenderloin', 'sirloin', 'brisket', 'round',
        'flank', 'skirt', 'hanger', 'strip', 't-bone', 'porterhouse', 'filet', 'ribeye'
    ]
    
    # Grains
    grain_keywords = [
        'rice', 'wheat', 'oats', 'barley', 'rye', 'corn', 'quinoa', 'buckwheat', 'millet',
        'sorghum', 'amaranth', 'teff', 'spelt', 'kamut', 'bulgur', 'couscous', 'pasta',
        'noodles', 'bread', 'roll', 'bagel', 'muffin', 'cracker', 'cereal', 'granola',
        'flour', 'meal', 'grits', 'polenta', 'tortilla', 'wrap', 'pita', 'naan', 'flatbread'
    ]
    
    # Dairy
    dairy_keywords = [
        'milk', 'cheese', 'yogurt', 'butter', 'cream', 'sour cream', 'cottage cheese',
        'ricotta', 'mozzarella', 'cheddar', 'swiss', 'parmesan', 'feta', 'goat cheese',
        'blue cheese', 'brie', 'camembert', 'gouda', 'havarti', 'provolone', 'monterey',
        'colby', 'jack', 'cheddar', 'american', 'velveeta', 'cream cheese', 'mascarpone',
        'buttermilk', 'kefir', 'sour cream', 'whipping cream', 'half and half', 'heavy cream',
        'light cream', 'evaporated milk', 'condensed milk', 'powdered milk', 'dry milk'
    ]
    
    # Nuts
    nut_keywords = [
        'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia',
        'brazil nut', 'pine nut', 'pili nut', 'kukui nut', 'candlenut', 'tiger nut',
        'peanut', 'groundnut', 'sunflower seed', 'pumpkin seed', 'sesame seed', 'chia seed',
        'flax seed', 'hemp seed', 'poppy seed', 'caraway seed', 'fennel seed', 'cumin seed',
        'coriander seed', 'mustard seed', 'nigella seed', 'celery seed', 'dill seed'
    ]
    
    # Check categories in order of specificity
    for keyword in fruit_keywords:
        if keyword in name_lower:
            return 'Fruits'
    
    for keyword in vegetable_keywords:
        if keyword in name_lower:
            return 'Vegetables'
    
    for keyword in meat_keywords:
        if keyword in name_lower:
            return 'Meats'
    
    for keyword in grain_keywords:
        if keyword in name_lower:
            return 'Grains'
    
    for keyword in dairy_keywords:
        if keyword in name_lower:
            return 'Dairy'
    
    for keyword in nut_keywords:
        if keyword in name_lower:
            return 'Nuts'
    
    # Special cases and patterns
    if any(word in name_lower for word in ['juice', 'smoothie', 'drink', 'beverage']):
        if any(fruit in name_lower for fruit in ['apple', 'orange', 'grape', 'cranberry', 'pomegranate']):
            return 'Fruits'
        else:
            return 'Miscellaneous'
    
    if any(word in name_lower for word in ['oil', 'fat', 'lard', 'shortening']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['sugar', 'honey', 'syrup', 'molasses', 'maple']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['salt', 'spice', 'herb', 'seasoning']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['sauce', 'dressing', 'condiment', 'relish']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['soup', 'broth', 'stock', 'bouillon']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['snack', 'chip', 'cracker', 'pretzel']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['candy', 'chocolate', 'sweet', 'dessert']):
        return 'Miscellaneous'
    
    if any(word in name_lower for word in ['alcohol', 'wine', 'beer', 'spirit']):
        return 'Miscellaneous'
    
    # Default to Miscellaneous for unclassified items
    return 'Miscellaneous'

def main():
    """Categorize all foods in the complete catalog"""
    input_file = Path("../../processed_data/complete_foundation_foods_catalog.json")
    output_file = Path("../../processed_data/categorized_foundation_foods_catalog.json")
    
    print("Loading complete food catalog...")
    with open(input_file, 'r') as f:
        foods = json.load(f)
    
    print(f"Processing {len(foods)} foods...")
    
    # Categorize each food
    categorized_foods = []
    category_counts = {}
    
    for food in foods:
        category = categorize_food(food['name'])
        food['category'] = category
        
        # Count categories
        if category in category_counts:
            category_counts[category] += 1
        else:
            category_counts[category] = 1
        
        categorized_foods.append(food)
    
    # Save categorized catalog
    with open(output_file, 'w') as f:
        json.dump(categorized_foods, f, indent=2)
    
    print(f"Saved categorized catalog to {output_file}")
    print("\nCategory distribution:")
    for category, count in sorted(category_counts.items()):
        print(f"  {category}: {count} foods")
    
    # Show some examples
    print("\nSample categorizations:")
    for category in ['Fruits', 'Vegetables', 'Meats', 'Grains', 'Dairy', 'Nuts', 'Miscellaneous']:
        examples = [f['name'] for f in categorized_foods if f['category'] == category][:3]
        if examples:
            print(f"  {category}: {', '.join(examples)}")

if __name__ == "__main__":
    main()
