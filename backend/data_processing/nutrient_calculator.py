import numpy as np
from typing import Dict, Optional, List, Any
import logging
from models.food_models import NutrientProfile

logger = logging.getLogger(__name__)

class NutrientCalculator:
    """High-performance nutrient calculations using vectorized operations"""
    
    def __init__(self):
        # Conversion factors for different units
        self.unit_conversions = {
            'g': 1.0,
            'mg': 0.001,
            'µg': 0.000001,
            'kg': 1000.0,
            'lb': 453.592,
            'oz': 28.3495,
            'cup': 240.0,  # Approximate for water
            'tbsp': 15.0,
            'tsp': 5.0,
            'slice': 28.0,  # Approximate for bread
            'piece': 1.0,  # Will need specific food data
            'serving': 100.0  # Default serving size
        }
        
        # Daily values for %DV calculations
        self.daily_values = {
            'Energy (kcal)': 2000,
            'Protein': 50,  # g
            'Total lipid (fat)': 65,  # g
            'Carbohydrate, by difference': 300,  # g
            'Fiber, total dietary': 25,  # g
            'Calcium, Ca': 1000,  # mg
            'Iron, Fe': 18,  # mg
            'Magnesium, Mg': 400,  # mg
            'Phosphorus, P': 1000,  # mg
            'Potassium, K': 3500,  # mg
            'Sodium, Na': 2300,  # mg
            'Zinc, Zn': 11,  # mg
            'Copper, Cu': 0.9,  # mg
            'Manganese, Mn': 2.3,  # mg
            'Selenium, Se': 55,  # µg
            'Vitamin C, total ascorbic acid': 90,  # mg
            'Thiamin': 1.2,  # mg
            'Riboflavin': 1.3,  # mg
            'Niacin': 16,  # mg
            'Pantothenic acid': 5,  # mg
            'Vitamin B-6': 1.7,  # mg
            'Folate, total': 400,  # µg
            'Vitamin B-12': 2.4,  # µg
            'Vitamin A, RAE': 900,  # µg
            'Vitamin E (alpha-tocopherol)': 15,  # mg
            'Vitamin D (D2 + D3)': 20,  # µg
            'Vitamin K (phylloquinone)': 120,  # µg
        }
    
    async def scale_nutrients(
        self, 
        nutrients: Dict[str, NutrientProfile], 
        serving_size: float, 
        serving_unit: str
    ) -> Dict[str, NutrientProfile]:
        """
        Scale nutrients from per-100g to specified serving size
        Uses vectorized operations for high performance
        """
        try:
            # Convert serving size to grams
            serving_size_g = await self._convert_to_grams(serving_size, serving_unit)
            
            # Calculate scaling factor (serving_size_g / 100g)
            scale_factor = serving_size_g / 100.0
            
            # Scale all nutrients
            scaled_nutrients = {}
            
            for nutrient_name, profile in nutrients.items():
                if profile.amount is None:
                    scaled_nutrients[nutrient_name] = NutrientProfile(
                        name=profile.name,
                        amount=None,
                        unit=profile.unit,
                        daily_value=profile.daily_value,
                        daily_value_percentage=None
                    )
                    continue
                
                # Scale the amount
                scaled_amount = profile.amount * scale_factor
                
                # Calculate %DV if daily value is available
                daily_value = self.daily_values.get(nutrient_name)
                daily_value_percentage = None
                
                if daily_value and daily_value > 0:
                    daily_value_percentage = (scaled_amount / daily_value) * 100
                
                scaled_nutrients[nutrient_name] = NutrientProfile(
                    name=profile.name,
                    amount=round(scaled_amount, 2),
                    unit=profile.unit,
                    daily_value=daily_value,
                    daily_value_percentage=round(daily_value_percentage, 1) if daily_value_percentage else None
                )
            
            return scaled_nutrients
            
        except Exception as e:
            logger.error(f"Error scaling nutrients: {e}")
            return nutrients
    
    async def _convert_to_grams(self, amount: float, unit: str) -> float:
        """Convert any unit to grams"""
        try:
            unit_lower = unit.lower().strip()
            
            # Handle common variations
            if unit_lower in ['gram', 'grams', 'g']:
                return amount
            elif unit_lower in ['kilogram', 'kilograms', 'kg']:
                return amount * self.unit_conversions['kg']
            elif unit_lower in ['pound', 'pounds', 'lb', 'lbs']:
                return amount * self.unit_conversions['lb']
            elif unit_lower in ['ounce', 'ounces', 'oz']:
                return amount * self.unit_conversions['oz']
            elif unit_lower in ['cup', 'cups']:
                return amount * self.unit_conversions['cup']
            elif unit_lower in ['tablespoon', 'tablespoons', 'tbsp']:
                return amount * self.unit_conversions['tbsp']
            elif unit_lower in ['teaspoon', 'teaspoons', 'tsp']:
                return amount * self.unit_conversions['tsp']
            elif unit_lower in ['slice', 'slices']:
                return amount * self.unit_conversions['slice']
            elif unit_lower in ['piece', 'pieces']:
                return amount * self.unit_conversions['piece']
            elif unit_lower in ['serving', 'servings']:
                return amount * self.unit_conversions['serving']
            else:
                # Default to grams if unit not recognized
                logger.warning(f"Unknown unit '{unit}', defaulting to grams")
                return amount
                
        except Exception as e:
            logger.error(f"Error converting unit {unit}: {e}")
            return amount
    
    async def calculate_nutrient_density_score(
        self, 
        nutrients: Dict[str, NutrientProfile]
    ) -> Optional[float]:
        """
        Calculate Nutrient Density Score using vectorized operations
        NDS = Σ(nutrient_amount / daily_value) / number_of_nutrients
        """
        try:
            scores = []
            
            for nutrient_name, profile in nutrients.items():
                if profile.amount is None:
                    continue
                
                daily_value = self.daily_values.get(nutrient_name)
                if daily_value and daily_value > 0:
                    score = profile.amount / daily_value
                    scores.append(score)
            
            if not scores:
                return None
            
            # Use numpy for vectorized calculation
            scores_array = np.array(scores)
            return float(np.mean(scores_array))
            
        except Exception as e:
            logger.error(f"Error calculating NDS: {e}")
            return None
    
    async def calculate_grade_from_nds(
        self, 
        nds_score: Optional[float], 
        has_calories: bool = True
    ) -> str:
        """Calculate grade based on NDS score"""
        if not has_calories:
            return "NA"
        
        if nds_score is None:
            return "D"
        
        # Grade cutoffs
        if nds_score >= 0.8:
            return "S"
        elif nds_score >= 0.6:
            return "A"
        elif nds_score >= 0.4:
            return "B"
        elif nds_score >= 0.2:
            return "C"
        else:
            return "D"
    
    async def validate_nutrient_data(
        self, 
        nutrients: Dict[str, NutrientProfile]
    ) -> Dict[str, Any]:
        """
        Validate nutrient data for completeness and accuracy
        Returns validation results and suggestions
        """
        try:
            validation_results = {
                'is_valid': True,
                'missing_nutrients': [],
                'unrealistic_values': [],
                'completeness_score': 0.0,
                'suggestions': []
            }
            
            # Check for missing essential nutrients
            essential_nutrients = [
                'Energy (kcal)', 'Protein', 'Total lipid (fat)', 
                'Carbohydrate, by difference', 'Fiber, total dietary'
            ]
            
            missing_count = 0
            for nutrient in essential_nutrients:
                if nutrient not in nutrients or nutrients[nutrient].amount is None:
                    validation_results['missing_nutrients'].append(nutrient)
                    missing_count += 1
            
            # Calculate completeness score
            total_essential = len(essential_nutrients)
            validation_results['completeness_score'] = (total_essential - missing_count) / total_essential
            
            # Check for unrealistic values
            calories = nutrients.get('Energy (kcal)')
            if calories and calories.amount:
                if calories.amount > 1000:  # More than 1000 kcal per 100g is unrealistic
                    validation_results['unrealistic_values'].append(
                        f"Calories too high: {calories.amount} kcal/100g"
                    )
                elif calories.amount <= 0:
                    validation_results['unrealistic_values'].append(
                        f"Calories too low: {calories.amount} kcal/100g"
                    )
            
            # Generate suggestions
            if missing_count > 0:
                validation_results['suggestions'].append(
                    f"Add missing essential nutrients: {', '.join(validation_results['missing_nutrients'])}"
                )
            
            if validation_results['unrealistic_values']:
                validation_results['suggestions'].append(
                    "Review and correct unrealistic nutrient values"
                )
            
            # Overall validation
            if missing_count > 2 or validation_results['unrealistic_values']:
                validation_results['is_valid'] = False
            
            return validation_results
            
        except Exception as e:
            logger.error(f"Error validating nutrient data: {e}")
            return {
                'is_valid': False,
                'missing_nutrients': [],
                'unrealistic_values': [],
                'completeness_score': 0.0,
                'suggestions': ['Validation failed due to error']
            }
    
    async def batch_calculate_nds(
        self, 
        foods_nutrients: List[Dict[str, NutrientProfile]]
    ) -> List[Optional[float]]:
        """
        Calculate NDS for multiple foods using vectorized operations
        Optimized for processing large datasets
        """
        try:
            nds_scores = []
            
            for nutrients in foods_nutrients:
                nds_score = await self.calculate_nutrient_density_score(nutrients)
                nds_scores.append(nds_score)
            
            return nds_scores
            
        except Exception as e:
            logger.error(f"Error in batch NDS calculation: {e}")
            return [None] * len(foods_nutrients)
