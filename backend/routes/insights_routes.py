"""
Insights (AI) API Routes
Generates weekly fitness progress reports with charts
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import io
import base64
import math

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import cm
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401 - required for 3D
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/insights", tags=["insights"])


class MealEntry(BaseModel):
    date: str
    nutrients: Dict[str, float] = {}


class ExerciseSet(BaseModel):
    weight: float
    reps: int


class ExerciseEntry(BaseModel):
    name: str
    sets: Optional[List[ExerciseSet]] = None
    weight: Optional[float] = None
    reps: Optional[int] = None


class WorkoutEntry(BaseModel):
    date: str
    templateName: Optional[str] = None
    exercises: List[ExerciseEntry]


class ReportRequest(BaseModel):
    week_start: Optional[str] = None
    week_end: Optional[str] = None
    favorite_exercise: Optional[str] = None
    workout_history: List[WorkoutEntry] = []
    meal_history: List[MealEntry] = []


@router.post("/report")
async def generate_weekly_report(payload: ReportRequest):
    try:
        # Aggregate by broad topics: Protein, Carbs, Fats, Vitamins, Minerals
        protein_key = "Protein"
        carbs_key = "Carbohydrate, by difference"
        fats_key = "Total lipid (fat)"

        vitamin_keys = [
            "Vitamin A, RAE", "Vitamin C", "Vitamin D", "Vitamin E (alpha-tocopherol)",
            "Vitamin K (phylloquinone)", "Thiamin", "Riboflavin", "Niacin",
            "Vitamin B-6", "Vitamin B-12", "Folate, DFE", "Pantothenic acid", "Choline, total"
        ]
        mineral_keys = [
            "Calcium, Ca", "Iron, Fe", "Magnesium, Mg", "Phosphorus, P", "Potassium, K",
            "Sodium, Na", "Zinc, Zn", "Copper, Cu", "Selenium, Se", "Manganese, Mn"
        ]

        # Per-nutrient totals across provided days
        days_count = max(1, len({m.date for m in payload.meal_history}))
        total_by_key: Dict[str, float] = {}
        for meal in payload.meal_history:
            for n, val in meal.nutrients.items():
                total_by_key[n] = total_by_key.get(n, 0.0) + float(val or 0)

        def avg_daily(key: str) -> float:
            return float(min(200.0, total_by_key.get(key, 0.0) / days_count))

        def avg_group(keys: List[str]) -> float:
            if not keys:
                return 0.0
            vals = [avg_daily(k) for k in keys if k in total_by_key]
            if not vals:
                return 0.0
            return float(sum(vals) / len(vals))

        coverage_topics = {
            "Protein": avg_daily(protein_key),
            "Carbs": avg_daily(carbs_key),
            "Fats": avg_daily(fats_key),
            "Vitamins": avg_group(vitamin_keys),
            "Minerals": avg_group(mineral_keys),
        }

        # Build radar chart
        radar_img = _generate_radar_chart(coverage_topics)

        # Build 3D line chart for favorite exercise or best available
        fav = payload.favorite_exercise or _pick_favorite_exercise(payload.workout_history)
        line3d_img = _generate_3d_line_chart(payload.workout_history, fav)

        # Compute simple weekly strength delta (% change in est. volume-load)
        strength_change, notes = _compute_strength_change(payload.workout_history, fav)

        # AI summary with LangChain (if available), fallback to rule-based
        nutrition_gaps = [k for k, v in coverage_topics.items() if v < 80]
        summary = (
            f"Strength trend: {strength_change:+.1f}% for {fav}. "
            + ("Key nutrition gaps: " + ", ".join(nutrition_gaps) if nutrition_gaps else "Nutrition coverage looks solid.")
        )
        ai_summary = _try_langchain_summary(coverage_topics, strength_change, fav)

        result = {
            "favorite_exercise": fav,
            "micronutrient_coverage": coverage_topics,
            "radar_chart": radar_img,
            "exercise_3d_chart": line3d_img,
            "strength_change_pct": strength_change,
            "summary": summary,
            "ai_summary": ai_summary,
            "notes": notes,
        }

        return JSONResponse(content=result)
    except Exception as e:
        logger.exception("Failed to generate insights report")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


def _generate_radar_chart(coverage: Dict[str, float]) -> str:
    labels = list(coverage.keys())
    values = [coverage[k] for k in labels]
    num_vars = len(labels)

    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    values += values[:1]
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    ax.set_facecolor('#1a1a1a')
    fig.patch.set_facecolor('#1a1a1a')

    ax.plot(angles, values, color='#4CAF50', linewidth=2)
    ax.fill(angles, values, color='#4CAF50', alpha=0.25)
    ax.set_yticks([50, 100, 150, 200])
    ax.set_yticklabels(["50%", "100%", "150%", "200%"], color='white')
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, color='white', fontsize=9)

    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def _pick_favorite_exercise(workouts: List[WorkoutEntry]) -> str:
    counts: Dict[str, int] = {}
    for w in workouts:
        for ex in w.exercises:
            counts[ex.name] = counts.get(ex.name, 0) + 1
    if not counts:
        return "Bench Press"
    return sorted(counts.items(), key=lambda x: (-x[1], x[0]))[0][0]


def _generate_3d_line_chart(workouts: List[WorkoutEntry], exercise_name: str) -> str:
    # Build (time, reps, weight) sequences
    xs, ys, zs = [], [], []
    t = 0
    for w in sorted(workouts, key=lambda x: x.date):
        for ex in w.exercises:
            if ex.name != exercise_name:
                continue
            if ex.sets and len(ex.sets) > 0:
                for s in ex.sets:
                    xs.append(t)
                    ys.append(s.reps)
                    zs.append(s.weight)
                    t += 1
            elif ex.reps is not None and ex.weight is not None:
                xs.append(t)
                ys.append(int(ex.reps))
                zs.append(float(ex.weight))
                t += 1

    if not xs:
        # create a tiny placeholder to avoid crash
        xs, ys, zs = [0, 1], [5, 6], [20, 25]

    fig = plt.figure(figsize=(8, 5))
    fig.patch.set_facecolor('#1a1a1a')
    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor('#1a1a1a')

    ax.plot(xs, ys, zs, color='#667eea', linewidth=2)
    ax.set_xlabel('Time', color='white')
    ax.set_ylabel('Reps', color='white')
    ax.set_zlabel('Weight', color='white')
    ax.tick_params(colors='white')

    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format='png', bbox_inches='tight')
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def _compute_strength_change(workouts: List[WorkoutEntry], exercise_name: str):
    # Extract average weight per set for each workout session
    session_weights = []  # list of average weights per workout
    
    for w in sorted(workouts, key=lambda x: x.date):
        weights = []
        for ex in w.exercises:
            if ex.name != exercise_name:
                continue
            if ex.sets:
                # Get all weights from sets
                for s in ex.sets:
                    if s.weight and s.weight > 0:
                        weights.append(float(s.weight))
            elif ex.weight is not None and ex.weight > 0:
                weights.append(float(ex.weight))
        
        if weights:
            # Average weight per set for this workout session
            session_weights.append(np.mean(weights))

    if len(session_weights) < 2:
        return 0.0, "Not enough data to compute weekly strength change."

    # Compare first workout vs last workout (most accurate for progression)
    first_weight = session_weights[0]
    last_weight = session_weights[-1]
    
    if first_weight <= 0:
        return 0.0, "Baseline too small; showing 0%."
    
    pct = ((last_weight - first_weight) / first_weight) * 100.0
    return float(pct), f"Computed from average weight per set: {first_weight:.1f}lbs → {last_weight:.1f}lbs."


def _try_langchain_summary(coverage_topics: Dict[str, float], strength_change: float, exercise: str) -> Optional[str]:
    """Attempt to create an AI summary using LangChain if installed and configured."""
    try:
        import os
        # Lazy import to avoid hard dependency
        from langchain_openai import ChatOpenAI  # type: ignore
        
        # Use environment variable if set, otherwise use hardcoded key
        api_key = os.getenv("OPENAI_API_KEY") or "api_key"
        
        # Model requires OPENAI_API_KEY
        llm = ChatOpenAI(api_key=api_key, temperature=0.2, model="gpt-4o-mini")
        cov_text = ", ".join(f"{k}: {v:.0f}%" for k, v in coverage_topics.items())
        prompt = (
            "You are a fitness coach. Generate a concise, actionable weekly report summary.\n"
            f"Nutrient coverage by category: {cov_text}.\n"
            f"Strength change for favorite exercise ({exercise}): {strength_change:.1f}%.\n"
            "Comment on nutrition gaps (below 80%), suggest 1-2 high-impact food strategies, "
            "and 1-2 training adjustments (volume or intensity) for next week. Keep it to 3-5 sentences."
        )
        resp = llm.invoke(prompt)
        # Different LC versions return different shapes
        if isinstance(resp, str):
            return resp
        content = getattr(resp, "content", None)
        if isinstance(content, str):
            return content
        return None
    except Exception:
        return None

