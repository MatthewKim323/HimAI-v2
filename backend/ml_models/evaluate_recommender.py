#!/usr/bin/env python3
"""
Evaluation utilities for Food Recommendation System
"""

import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


def precision_at_k(y_true: List[int], y_pred: List[int], k: int = 10) -> float:
    """
    Calculate Precision@K
    
    Args:
        y_true: List of relevant item indices
        y_pred: List of predicted item indices (sorted by score)
        k: Number of top items to consider
    
    Returns:
        Precision@K score
    """
    if len(y_pred) == 0:
        return 0.0
    
    top_k = y_pred[:k]
    relevant_in_top_k = sum(1 for item in top_k if item in y_true)
    
    return relevant_in_top_k / min(k, len(y_pred))


def recall_at_k(y_true: List[int], y_pred: List[int], k: int = 10) -> float:
    """
    Calculate Recall@K
    
    Args:
        y_true: List of relevant item indices
        y_pred: List of predicted item indices (sorted by score)
        k: Number of top items to consider
    
    Returns:
        Recall@K score
    """
    if len(y_true) == 0:
        return 0.0
    
    top_k = y_pred[:k]
    relevant_in_top_k = sum(1 for item in top_k if item in y_true)
    
    return relevant_in_top_k / len(y_true)


def mean_average_precision(y_true_list: List[List[int]], y_pred_list: List[List[int]], k: int = 10) -> float:
    """
    Calculate Mean Average Precision (MAP@K)
    
    Args:
        y_true_list: List of lists of relevant items for each user
        y_pred_list: List of lists of predicted items for each user
        k: Number of top items to consider
    
    Returns:
        MAP@K score
    """
    if len(y_true_list) == 0:
        return 0.0
    
    ap_scores = []
    
    for y_true, y_pred in zip(y_true_list, y_pred_list):
        if len(y_true) == 0:
            continue
        
        top_k = y_pred[:k]
        relevant_count = 0
        precision_sum = 0.0
        
        for i, item in enumerate(top_k):
            if item in y_true:
                relevant_count += 1
                precision_sum += relevant_count / (i + 1)
        
        if relevant_count > 0:
            ap = precision_sum / min(len(y_true), k)
            ap_scores.append(ap)
    
    return np.mean(ap_scores) if ap_scores else 0.0


def evaluate_recommender(
    test_interactions: List[Dict],
    predictions: List[List[Tuple[int, float]]],
    k: int = 10
) -> Dict[str, float]:
    """
    Comprehensive evaluation of recommendation system
    
    Args:
        test_interactions: List of {user_id, food_id, rating} dicts
        predictions: List of [(food_id, score), ...] for each user
        k: Number of top recommendations to evaluate
    
    Returns:
        Dictionary of evaluation metrics
    """
    # Group interactions by user
    user_relevant = {}
    for interaction in test_interactions:
        user_id = interaction['user_id']
        if interaction['rating'] == 1:  # Only positive interactions
            if user_id not in user_relevant:
                user_relevant[user_id] = []
            user_relevant[user_id].append(interaction['food_id'])
    
    # Calculate metrics
    precision_scores = []
    recall_scores = []
    
    for user_id, relevant_items in user_relevant.items():
        # Find predictions for this user
        user_pred = None
        for i, pred in enumerate(predictions):
            # Assuming predictions are in same order as users
            if i < len(predictions):
                user_pred = [food_id for food_id, score in pred]
                break
        
        if user_pred:
            prec = precision_at_k(relevant_items, user_pred, k)
            rec = recall_at_k(relevant_items, user_pred, k)
            precision_scores.append(prec)
            recall_scores.append(rec)
    
    # Calculate MAP
    y_true_list = list(user_relevant.values())
    y_pred_list = [[food_id for food_id, score in pred] for pred in predictions[:len(y_true_list)]]
    map_score = mean_average_precision(y_true_list, y_pred_list, k)
    
    return {
        'precision@k': np.mean(precision_scores) if precision_scores else 0.0,
        'recall@k': np.mean(recall_scores) if recall_scores else 0.0,
        'map@k': map_score,
        'num_users': len(user_relevant)
    }

