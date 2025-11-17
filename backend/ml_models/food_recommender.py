"""
Personalized Food Recommendation System
Neural Collaborative Filtering with Nutrient Awareness
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
import logging
from pathlib import Path
import pickle
from sklearn.preprocessing import StandardScaler, LabelEncoder

logger = logging.getLogger(__name__)


class FoodRecommender:
    """
    Neural Collaborative Filtering model for personalized food recommendations
    Combines user embeddings, food embeddings, nutrient features, and user context
    """
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize food recommender
        
        Args:
            model_path: Path to saved model weights (optional)
        """
        self.model = None
        self.scaler = StandardScaler()
        self.user_encoder = LabelEncoder()
        self.food_encoder = LabelEncoder()
        self.num_users = 0
        self.num_foods = 0
        self.nutrient_dim = 70
        self.context_dim = 5
        
        if model_path and Path(model_path).exists():
            self.load_model(model_path)
    
    def build_model(
        self,
        num_users: int,
        num_foods: int,
        nutrient_dim: int = 70,
        context_dim: int = 5,
        embedding_dim: int = 64  # Increased from 32 for better representations
    ) -> Model:
        """
        Build Neural Collaborative Filtering model
        
        Args:
            num_users: Number of unique users
            num_foods: Number of unique foods
            nutrient_dim: Number of nutrient features
            context_dim: Number of user context features
            embedding_dim: Embedding dimension for users/foods
        
        Returns:
            Compiled Keras model
        """
        self.num_users = num_users
        self.num_foods = num_foods
        self.nutrient_dim = nutrient_dim
        self.context_dim = context_dim
        
        # Input layers
        user_input = layers.Input(shape=(1,), name="user_id")
        food_input = layers.Input(shape=(1,), name="food_id")
        nutrient_input = layers.Input(shape=(nutrient_dim,), name="nutrients")
        context_input = layers.Input(shape=(context_dim,), name="user_context")
        
        # Embeddings
        user_emb = layers.Embedding(
            input_dim=num_users + 1,  # +1 for unknown users
            output_dim=embedding_dim,
            name="user_embedding"
        )(user_input)
        food_emb = layers.Embedding(
            input_dim=num_foods + 1,  # +1 for unknown foods
            output_dim=embedding_dim,
            name="food_embedding"
        )(food_input)
        
        user_vec = layers.Flatten()(user_emb)
        food_vec = layers.Flatten()(food_emb)
        
        # Nutrient network (deeper)
        nutrient_dense = layers.Dense(256, activation='relu', name="nutrient_dense1")(nutrient_input)
        nutrient_dense = layers.Dropout(0.2)(nutrient_dense)
        nutrient_dense = layers.Dense(128, activation='relu', name="nutrient_dense2")(nutrient_dense)
        nutrient_dense = layers.Dropout(0.15)(nutrient_dense)
        nutrient_dense = layers.Dense(64, activation='relu', name="nutrient_dense3")(nutrient_dense)
        
        # Context network (deeper)
        context_dense = layers.Dense(64, activation='relu', name="context_dense1")(context_input)
        context_dense = layers.Dropout(0.1)(context_dense)
        context_dense = layers.Dense(32, activation='relu', name="context_dense2")(context_dense)
        
        # Concatenate all features
        concat = layers.Concatenate(name="concat_features")([
            user_vec, food_vec, nutrient_dense, context_dense
        ])
        
        # Deep layers (wider and deeper)
        x = layers.Dense(512, activation='relu', name="dense1")(concat)
        x = layers.Dropout(0.3)(x)
        x = layers.Dense(256, activation='relu', name="dense2")(x)
        x = layers.Dropout(0.25)(x)
        x = layers.Dense(128, activation='relu', name="dense3")(x)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(64, activation='relu', name="dense4")(x)
        
        # Output: recommendation score (0-1)
        output = layers.Dense(1, activation='sigmoid', name="recommendation_score")(x)
        
        model = Model(
            inputs=[user_input, food_input, nutrient_input, context_input],
            outputs=output
        )
        
        model.compile(
            optimizer=keras.optimizers.legacy.Adam(learning_rate=0.0005),  # Lower learning rate for stability
            loss='binary_crossentropy',
            metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
        )
        
        self.model = model
        logger.info(f"Built model with {model.count_params():,} parameters")
        
        return model
    
    def prepare_training_data(
        self,
        interactions_df: pd.DataFrame,
        users_df: pd.DataFrame,
        foods_df: pd.DataFrame,
        food_nutrient_data: Dict[int, np.ndarray]
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Prepare training data from DataFrames
        
        Args:
            interactions_df: DataFrame with columns [user_id, food_id, rating]
            users_df: DataFrame with user context [user_id, calorie_goal, protein_goal, ...]
            foods_df: DataFrame with food metadata
            food_nutrient_data: Dict mapping food_id to nutrient array
        
        Returns:
            Tuple of (user_ids, food_ids, nutrients, contexts, ratings)
        """
        # Merge interactions with user and food data
        merged = interactions_df.merge(users_df, on='user_id', how='left')
        merged = merged.merge(foods_df[['food_id']], on='food_id', how='left')
        
        # Encode user and food IDs
        if not hasattr(self.user_encoder, 'classes_'):
            self.user_encoder.fit(merged['user_id'].unique())
        if not hasattr(self.food_encoder, 'classes_'):
            self.food_encoder.fit(merged['food_id'].unique())
        
        user_ids = self.user_encoder.transform(merged['user_id'])
        food_ids = self.food_encoder.transform(merged['food_id'])
        
        # Extract nutrient features
        nutrients = np.array([
            food_nutrient_data.get(fid, np.zeros(self.nutrient_dim))
            for fid in merged['food_id']
        ])
        
        # Extract user context (calorie_goal, protein_goal, recent_calories, recent_protein, diet_type_encoded)
        contexts = []
        for _, row in merged.iterrows():
            context = [
                row.get('calorie_goal', 2000),
                row.get('protein_goal', 100),
                row.get('recent_calories', 0),  # Last 7 days average
                row.get('recent_protein', 0),   # Last 7 days average
                row.get('diet_type_encoded', 0)  # 0=balanced, 1=high-protein, 2=low-carb, etc.
            ]
            contexts.append(context)
        contexts = np.array(contexts)
        
        # Ratings (0 or 1)
        ratings = merged['rating'].values.astype(np.float32)
        
        logger.info(f"Prepared {len(merged)} training samples")
        
        return user_ids, food_ids, nutrients, contexts, ratings
    
    def train(
        self,
        user_ids: np.ndarray,
        food_ids: np.ndarray,
        nutrients: np.ndarray,
        contexts: np.ndarray,
        ratings: np.ndarray,
        validation_split: float = 0.1,
        epochs: int = 10,
        batch_size: int = 256,
        verbose: int = 1
    ) -> keras.callbacks.History:
        """
        Train the recommendation model
        
        Args:
            user_ids: Encoded user IDs
            food_ids: Encoded food IDs
            nutrients: Nutrient feature arrays
            contexts: User context arrays
            ratings: Target ratings (0 or 1)
            validation_split: Fraction of data for validation
            epochs: Number of training epochs
            batch_size: Batch size
            verbose: Verbosity level
        
        Returns:
            Training history
        """
        if self.model is None:
            num_users = len(np.unique(user_ids))
            num_foods = len(np.unique(food_ids))
            self.build_model(num_users, num_foods, nutrients.shape[1], contexts.shape[1])
        
        # Scale nutrients
        nutrients_scaled = self.scaler.fit_transform(nutrients)
        
        # Prepare inputs
        X = [
            user_ids.reshape(-1, 1),
            food_ids.reshape(-1, 1),
            nutrients_scaled,
            contexts
        ]
        y = ratings
        
        # Callbacks with better patience
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_accuracy',  # Monitor accuracy instead of loss
                patience=5,  # More patience
                restore_best_weights=True,
                mode='max'
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=3,  # More patience before reducing LR
                min_lr=1e-7,
                verbose=1
            ),
            keras.callbacks.ModelCheckpoint(
                filepath='models/food_recommender_best.h5',
                monitor='val_accuracy',
                save_best_only=True,
                mode='max',
                verbose=1
            )
        ]
        
        # Train
        history = self.model.fit(
            X, y,
            batch_size=batch_size,
            epochs=epochs,
            validation_split=validation_split,
            callbacks=callbacks,
            verbose=verbose
        )
        
        logger.info("Training completed")
        
        return history
    
    def predict(
        self,
        user_id: int,
        food_ids: List[int],
        food_nutrients: Dict[int, np.ndarray],
        user_context: np.ndarray
    ) -> List[Tuple[int, float]]:
        """
        Predict recommendation scores for foods
        
        Args:
            user_id: User ID (will be encoded)
            food_ids: List of food IDs to score
            food_nutrients: Dict mapping food_id to nutrient array
            user_context: User context array [calorie_goal, protein_goal, recent_calories, recent_protein, diet_type]
        
        Returns:
            List of (food_id, score) tuples sorted by score
        """
        if self.model is None:
            raise ValueError("Model not loaded. Call load_model() or train() first.")
        
        # Encode user and food IDs
        try:
            encoded_user_id = self.user_encoder.transform([user_id])[0]
        except ValueError:
            # Unknown user - use 0 (will map to embedding index 0)
            encoded_user_id = 0
        
        encoded_food_ids = []
        nutrients_list = []
        
        for food_id in food_ids:
            try:
                encoded_food_id = self.food_encoder.transform([food_id])[0]
            except ValueError:
                # Unknown food - skip or use 0
                continue
            
            encoded_food_ids.append(encoded_food_id)
            nutrients_list.append(food_nutrients.get(food_id, np.zeros(self.nutrient_dim)))
        
        if not encoded_food_ids:
            return []
        
        # Prepare inputs
        user_input = np.array([[encoded_user_id]] * len(encoded_food_ids))
        food_input = np.array([[fid] for fid in encoded_food_ids])
        nutrient_input = self.scaler.transform(np.array(nutrients_list))
        context_input = np.tile(user_context.reshape(1, -1), (len(encoded_food_ids), 1))
        
        # Predict
        scores = self.model.predict(
            [user_input, food_input, nutrient_input, context_input],
            verbose=0
        ).flatten()
        
        # Return sorted by score
        results = list(zip(food_ids, scores))
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results
    
    def recommend(
        self,
        user_id: int,
        candidate_foods: List[Dict],
        user_context: np.ndarray,
        top_k: int = 10
    ) -> List[Dict]:
        """
        Get top-k food recommendations
        
        Args:
            user_id: User ID
            candidate_foods: List of food dictionaries with 'fdc_id' and nutrient data
            user_context: User context array
            top_k: Number of recommendations
        
        Returns:
            List of recommended foods with scores
        """
        # Extract food IDs and nutrients
        food_ids = [food.get('fdc_id', food.get('id')) for food in candidate_foods]
        food_nutrients = {}
        
        for food in candidate_foods:
            food_id = food.get('fdc_id', food.get('id'))
            # Extract nutrient features (70 nutrients)
            nutrients = self._extract_nutrient_features(food)
            food_nutrients[food_id] = nutrients
        
        # Predict scores
        predictions = self.predict(user_id, food_ids, food_nutrients, user_context)
        
        # Get top-k
        top_predictions = predictions[:top_k]
        
        # Format results
        recommendations = []
        for food_id, score in top_predictions:
            # Find original food object
            food_obj = next(
                (f for f in candidate_foods if f.get('fdc_id', f.get('id')) == food_id),
                None
            )
            if food_obj:
                recommendations.append({
                    'food': food_obj,
                    'score': float(score),
                    'confidence': 'high' if score > 0.7 else 'medium' if score > 0.4 else 'low'
                })
        
        return recommendations
    
    def _extract_nutrient_features(self, food: Dict) -> np.ndarray:
        """
        Extract normalized nutrient features from food object
        
        Args:
            food: Food dictionary with nutrients
        
        Returns:
            Array of 70 nutrient values
        """
        # Map of nutrient names to extract (70 total)
        # Using USDA nutrient names from your database
        nutrient_mapping = [
            ('calories', 'Energy'),
            ('protein', 'Protein'),
            ('fat', 'Total lipid (fat)'),
            ('carbohydrates', 'Carbohydrate, by difference'),
            ('fiber', 'Fiber, total dietary'),
            ('calcium', 'Calcium, Ca'),
            ('iron', 'Iron, Fe'),
            ('magnesium', 'Magnesium, Mg'),
            ('phosphorus', 'Phosphorus, P'),
            ('potassium', 'Potassium, K'),
            ('sodium', 'Sodium, Na'),
            ('zinc', 'Zinc, Zn'),
            ('copper', 'Copper, Cu'),
            ('manganese', 'Manganese, Mn'),
            ('selenium', 'Selenium, Se'),
            ('vitamin_c', 'Vitamin C, total ascorbic acid'),
            ('thiamin', 'Thiamin'),
            ('riboflavin', 'Riboflavin'),
            ('niacin', 'Niacin'),
            ('vitamin_b6', 'Vitamin B-6'),
            ('folate', 'Folate, total'),
            ('vitamin_b12', 'Vitamin B-12'),
            ('vitamin_a', 'Vitamin A, RAE'),
            ('vitamin_e', 'Vitamin E (alpha-tocopherol)'),
            ('vitamin_d', 'Vitamin D (D2 + D3)'),
            ('vitamin_k', 'Vitamin K (phylloquinone)'),
            ('pantothenic_acid', 'Pantothenic acid'),
            ('choline', 'Choline, total'),
            ('betaine', 'Betaine'),
        ]
        
        nutrients = []
        nutrients_dict = food.get('nutrients', {})
        
        # Extract nutrients using mapping
        for direct_key, usda_key in nutrient_mapping:
            value = 0.0
            
            # Try direct key first (calories, protein, etc.)
            if direct_key in food:
                value = food[direct_key] or 0.0
            # Try USDA key in nutrients dict
            elif usda_key in nutrients_dict:
                nutrient_obj = nutrients_dict[usda_key]
                if isinstance(nutrient_obj, dict):
                    value = nutrient_obj.get('amount', 0.0)
                elif hasattr(nutrient_obj, 'amount'):
                    value = nutrient_obj.amount or 0.0
                else:
                    value = float(nutrient_obj) if nutrient_obj else 0.0
            # Try direct key in nutrients dict
            elif direct_key in nutrients_dict:
                nutrient_obj = nutrients_dict[direct_key]
                if isinstance(nutrient_obj, dict):
                    value = nutrient_obj.get('amount', 0.0)
                elif hasattr(nutrient_obj, 'amount'):
                    value = nutrient_obj.amount or 0.0
                else:
                    value = float(nutrient_obj) if nutrient_obj else 0.0
            
            nutrients.append(float(value))
        
        # Pad to 70 with zeros (or add more nutrients from your database)
        while len(nutrients) < self.nutrient_dim:
            nutrients.append(0.0)
        
        return np.array(nutrients[:self.nutrient_dim])
    
    def save_model(self, model_path: str, scaler_path: str = None, encoders_path: str = None):
        """Save model and preprocessors"""
        if self.model is None:
            raise ValueError("No model to save")
        
        Path(model_path).parent.mkdir(parents=True, exist_ok=True)
        self.model.save(model_path)
        logger.info(f"Saved model to {model_path}")
        
        # Save scaler
        if scaler_path:
            with open(scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
        
        # Save encoders
        if encoders_path:
            with open(encoders_path, 'wb') as f:
                pickle.dump({
                    'user_encoder': self.user_encoder,
                    'food_encoder': self.food_encoder
                }, f)
    
    def load_model(self, model_path: str, scaler_path: str = None, encoders_path: str = None):
        """Load model and preprocessors"""
        self.model = keras.models.load_model(model_path)
        logger.info(f"Loaded model from {model_path}")
        
        # Load scaler
        if scaler_path and Path(scaler_path).exists():
            with open(scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
        
        # Load encoders
        if encoders_path and Path(encoders_path).exists():
            with open(encoders_path, 'rb') as f:
                encoders = pickle.load(f)
                self.user_encoder = encoders['user_encoder']
                self.food_encoder = encoders['food_encoder']
        
        # Extract dimensions from model
        if self.model:
            # Infer dimensions from model architecture
            self.num_users = self.model.get_layer('user_embedding').input_dim - 1
            self.num_foods = self.model.get_layer('food_embedding').input_dim - 1

