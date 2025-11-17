# 🤖 ML Models for HimAI

This directory contains machine learning models for personalized recommendations and analysis.

## 📁 Structure

```
ml_models/
├── __init__.py
├── food_recommender.py          # Neural Collaborative Filtering model
├── train_food_recommender.py    # Training script
├── evaluate_recommender.py       # Evaluation utilities
└── README.md                    # This file
```

## 🍽️ Food Recommendation System

### Overview

Neural Collaborative Filtering (NCF) model that recommends foods based on:
- User behavior (meal history, preferences)
- Food characteristics (70+ nutrients)
- User context (goals, diet type, recent intake)

### Quick Start

#### 1. Train the Model

```bash
cd backend
python ml_models/train_food_recommender.py
```

This will:
- Load your 411 USDA Foundation Foods
- Generate mock user/interaction data
- Train the NCF model
- Save model to `models/food_recommender.h5`

#### 2. Use the API

```python
# Get recommendations
GET /foods/recommend?user_id=1&calorie_goal=2500&protein_goal=150&limit=10
```

Response:
```json
{
  "user_id": 1,
  "recommendations": [
    {
      "food": {
        "fdc_id": 173944,
        "name": "Broccoli, raw",
        "calories": 34.0,
        "protein": 2.82,
        ...
      },
      "score": 0.87,
      "confidence": "high",
      "reason": "Highly recommended, High protein content, Excellent nutrient density"
    },
    ...
  ]
}
```

### Model Architecture

```
Inputs:
├── User ID (Embedding)
├── Food ID (Embedding)
├── Nutrient Features (70 values) → Dense(128) → Dense(64)
└── User Context (5 values) → Dense(32) → Dense(16)

Concatenate → Dense(256) → Dense(128) → Dense(64) → Output (0-1 score)
```

### Training Data

The training script generates mock data, but for production you should:

1. **Collect Real User Data:**
   - User meal history
   - Food interactions (implicit feedback)
   - User goals and preferences

2. **Format Data:**
   ```python
   # users.csv
   user_id,calorie_goal,protein_goal,diet_type,recent_calories,recent_protein
   
   # interactions.csv
   user_id,food_id,rating
   ```

3. **Train with Real Data:**
   ```python
   from ml_models.food_recommender import FoodRecommender
   import pandas as pd
   
   users_df = pd.read_csv("data/users.csv")
   interactions_df = pd.read_csv("data/interactions.csv")
   foods_df = pd.read_csv("data/foods.csv")
   
   recommender = FoodRecommender()
   # ... prepare and train
   ```

### Evaluation

```python
from ml_models.evaluate_recommender import evaluate_recommender

metrics = evaluate_recommender(
    test_interactions=test_data,
    predictions=model_predictions,
    k=10
)

print(f"Precision@10: {metrics['precision@k']:.4f}")
print(f"Recall@10: {metrics['recall@k']:.4f}")
print(f"MAP@10: {metrics['map@k']:.4f}")
```

### Integration

The model is automatically loaded when the API starts. Check health:

```bash
GET /foods/recommend/health
```

## 🔮 Future Models

- **Exercise Form Analyzer**: LSTM for technique analysis
- **Workout Predictor**: Predict optimal workout parameters
- **Injury Risk Predictor**: Detect movement patterns indicating risk
- **Exercise Classifier**: Auto-detect exercise type from video

## 📚 Dependencies

- `tensorflow==2.15.0`
- `pandas`
- `numpy`
- `scikit-learn`

## 🚀 Production Considerations

1. **Model Versioning**: Track model versions
2. **A/B Testing**: Compare ML vs rule-based recommendations
3. **Retraining**: Schedule periodic retraining with new data
4. **Monitoring**: Track recommendation quality metrics
5. **Cold Start**: Handle new users/foods gracefully

