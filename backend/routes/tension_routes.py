"""
Tension Detector API Routes
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import os
import shutil
from pathlib import Path
import logging

from tension_detector.tension_analyzer import TensionAnalyzer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tension", tags=["tension"])

# Initialize analyzer
analyzer = TensionAnalyzer()

# Create upload directory
UPLOAD_DIR = Path("uploads/videos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class AnalysisRequest(BaseModel):
    """Request model for video analysis"""
    joint_name: Optional[str] = "wrist"
    side: Optional[str] = "left"


@router.post("/analyze")
async def analyze_video(
    file: UploadFile = File(...),
    exercise: str = "lat_pulldown",
    joint_name: str = None,
    side: str = "left"
):
    """
    Analyze uploaded video for mechanical tension
    
    Args:
        file: Video file (MP4, MOV, WEBM)
        exercise: Exercise type (lat_pulldown, pull_up, bicep_curl, etc.)
        joint_name: Joint to track (auto-selected if not provided)
        side: left or right
        
    Returns:
        Analysis results including tension rating and graphs
    """
    # Validate file type
    allowed_extensions = ['.mp4', '.mov', '.webm', '.avi']
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save uploaded file
    video_path = UPLOAD_DIR / f"temp_{file.filename}"
    
    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing video: {video_path}")
        
        # Get exercise-specific parameters
        exercise_details = await get_exercise_details(exercise)
        
        # Use recommended joint if not specified
        if joint_name is None:
            joint_name = exercise_details["recommended_joint"]
        
        logger.info(f"Analyzing {exercise} with joint: {joint_name}")
        
        # Analyze video with exercise-specific parameters
        result = analyzer.analyze_video(
            str(video_path),
            joint_name=joint_name,
            side=side,
            exercise_type=exercise
        )
        
        # Clean up
        if video_path.exists():
            video_path.unlink()
        
        return JSONResponse(content=result)
    
    except Exception as e:
        logger.error(f"Error analyzing video: {str(e)}")
        
        # Clean up on error
        if video_path.exists():
            video_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "tension_detector"}


@router.get("/supported-joints")
async def get_supported_joints():
    """Get list of supported joints for tracking"""
    return {
        "joints": [
            {"name": "wrist", "description": "Wrist joint - good for push/pull exercises"},
            {"name": "elbow", "description": "Elbow joint - good for arm exercises"},
            {"name": "shoulder", "description": "Shoulder joint - good for overhead movements"},
            {"name": "hip", "description": "Hip joint - good for lower body exercises"},
            {"name": "knee", "description": "Knee joint - good for squats and lunges"},
            {"name": "ankle", "description": "Ankle joint - good for calf exercises"}
        ],
        "sides": ["left", "right"]
    }


@router.get("/exercises")
async def get_supported_exercises():
    """Get list of supported exercises with optimal joint recommendations"""
    return {
        "exercises": [
            # Upper Body Pushing
            {
                "name": "barbell_bench_press",
                "display_name": "Barbell Bench Press",
                "description": "Horizontal pushing exercise for chest and triceps",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_push",
                "difficulty": "intermediate",
                "category": "Upper Body Pushing"
            },
            {
                "name": "dumbbell_bench_press",
                "display_name": "Dumbbell Bench Press",
                "description": "Horizontal pushing with dumbbells for chest and triceps",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_push",
                "difficulty": "intermediate",
                "category": "Upper Body Pushing"
            },
            {
                "name": "incline_bench_press",
                "display_name": "Incline Bench Press",
                "description": "Inclined horizontal pushing for upper chest",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "incline_push",
                "difficulty": "intermediate",
                "category": "Upper Body Pushing"
            },
            {
                "name": "push_up",
                "display_name": "Push-up",
                "description": "Bodyweight horizontal pushing exercise",
                "primary_joints": ["shoulder", "elbow", "wrist", "hip"],
                "recommended_joint": "shoulder",
                "movement_pattern": "vertical_push",
                "difficulty": "beginner",
                "category": "Upper Body Pushing"
            },
            
            # Upper Body Pulling
            {
                "name": "lat_pulldown",
                "display_name": "Lat Pulldown",
                "description": "Vertical pulling exercise targeting lats and biceps",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "shoulder",
                "movement_pattern": "vertical_pull",
                "difficulty": "beginner",
                "category": "Upper Body Pulling"
            },
            {
                "name": "pull_up",
                "display_name": "Pull-up",
                "description": "Bodyweight vertical pulling exercise",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "shoulder",
                "movement_pattern": "vertical_pull",
                "difficulty": "intermediate",
                "category": "Upper Body Pulling"
            },
            {
                "name": "seated_cable_row",
                "display_name": "Seated Cable Row",
                "description": "Horizontal pulling exercise for back and biceps",
                "primary_joints": ["shoulder", "elbow", "wrist", "hip"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_pull",
                "difficulty": "beginner",
                "category": "Upper Body Pulling"
            },
            
            # Arm Isolation
            {
                "name": "barbell_bicep_curl",
                "display_name": "Barbell Bicep Curl",
                "description": "Isolation exercise for biceps with barbell",
                "primary_joints": ["elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_flexion",
                "difficulty": "beginner",
                "category": "Arm Isolation"
            },
            {
                "name": "dumbbell_bicep_curl",
                "display_name": "Dumbbell Bicep Curl",
                "description": "Isolation exercise for biceps with dumbbells",
                "primary_joints": ["elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_flexion",
                "difficulty": "beginner",
                "category": "Arm Isolation"
            },
            {
                "name": "tricep_pushdown",
                "display_name": "Tricep Pushdown",
                "description": "Isolation exercise for triceps",
                "primary_joints": ["elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "vertical_extension",
                "difficulty": "beginner",
                "category": "Arm Isolation"
            },
            {
                "name": "skull_crushers",
                "display_name": "Skull Crushers",
                "description": "Isolation exercise for triceps with barbell",
                "primary_joints": ["elbow", "wrist"],
                "recommended_joint": "elbow",
                "movement_pattern": "horizontal_extension",
                "difficulty": "intermediate",
                "category": "Arm Isolation"
            },
            {
                "name": "overhead_tricep_press",
                "display_name": "Overhead Tricep Press",
                "description": "Vertical tricep isolation exercise",
                "primary_joints": ["elbow", "wrist", "shoulder"],
                "recommended_joint": "elbow",
                "movement_pattern": "vertical_extension",
                "difficulty": "intermediate",
                "category": "Arm Isolation"
            },
            
            # Shoulder Exercises
            {
                "name": "shoulder_press",
                "display_name": "Shoulder Press",
                "description": "Vertical pressing exercise for shoulders",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "shoulder",
                "movement_pattern": "vertical_press",
                "difficulty": "intermediate",
                "category": "Shoulder Exercises"
            },
            {
                "name": "lateral_raises",
                "display_name": "Lateral Raises",
                "description": "Isolation exercise for shoulder deltoids",
                "primary_joints": ["shoulder", "elbow", "wrist"],
                "recommended_joint": "shoulder",
                "movement_pattern": "lateral_abduction",
                "difficulty": "beginner",
                "category": "Shoulder Exercises"
            },
            
            # Lower Body
            {
                "name": "barbell_squat",
                "display_name": "Barbell Squat",
                "description": "Lower body compound movement with barbell",
                "primary_joints": ["hip", "knee", "ankle", "shoulder"],
                "recommended_joint": "knee",
                "movement_pattern": "vertical_squat",
                "difficulty": "intermediate",
                "category": "Lower Body"
            },
            {
                "name": "dumbbell_goblet_squat",
                "display_name": "Dumbbell Goblet Squat",
                "description": "Lower body compound movement with dumbbell",
                "primary_joints": ["hip", "knee", "ankle", "elbow"],
                "recommended_joint": "knee",
                "movement_pattern": "vertical_squat",
                "difficulty": "beginner",
                "category": "Lower Body"
            },
            {
                "name": "deadlift",
                "display_name": "Deadlift",
                "description": "Hip hinge movement for posterior chain",
                "primary_joints": ["hip", "knee", "ankle", "shoulder"],
                "recommended_joint": "hip",
                "movement_pattern": "hip_hinge",
                "difficulty": "intermediate",
                "category": "Lower Body"
            },
            {
                "name": "romanian_deadlift",
                "display_name": "Romanian Deadlift",
                "description": "Hip hinge movement focusing on hamstrings",
                "primary_joints": ["hip", "knee", "ankle", "shoulder"],
                "recommended_joint": "hip",
                "movement_pattern": "hip_hinge",
                "difficulty": "intermediate",
                "category": "Lower Body"
            },
            {
                "name": "lunges",
                "display_name": "Lunges",
                "description": "Unilateral lower body movement",
                "primary_joints": ["hip", "knee", "ankle"],
                "recommended_joint": "knee",
                "movement_pattern": "lunge",
                "difficulty": "beginner",
                "category": "Lower Body"
            },
            {
                "name": "calf_raises",
                "display_name": "Calf Raises",
                "description": "Isolation exercise for calf muscles",
                "primary_joints": ["ankle", "knee"],
                "recommended_joint": "ankle",
                "movement_pattern": "plantar_flexion",
                "difficulty": "beginner",
                "category": "Lower Body"
            },
            {
                "name": "leg_press",
                "display_name": "Leg Press",
                "description": "Machine-based lower body exercise",
                "primary_joints": ["hip", "knee", "ankle"],
                "recommended_joint": "knee",
                "movement_pattern": "leg_press",
                "difficulty": "beginner",
                "category": "Lower Body"
            },
            {
                "name": "hip_thrust",
                "display_name": "Hip Thrust",
                "description": "Hip extension exercise for glutes",
                "primary_joints": ["hip", "knee", "shoulder"],
                "recommended_joint": "hip",
                "movement_pattern": "hip_extension",
                "difficulty": "intermediate",
                "category": "Lower Body"
            }
        ]
    }


@router.get("/exercises/{exercise_name}")
async def get_exercise_details(exercise_name: str):
    """Get detailed information about a specific exercise"""
    exercises = {
        "lat_pulldown": {
            "name": "lat_pulldown",
            "display_name": "Lat Pulldown",
            "description": "Vertical pulling exercise targeting lats and biceps",
            "primary_joints": ["shoulder", "elbow", "wrist"],
            "recommended_joint": "shoulder",
            "movement_pattern": "vertical_pull",
            "difficulty": "beginner",
            "tips": [
                "Keep your core engaged throughout the movement",
                "Pull the bar down to your chest, not behind your head",
                "Control the weight on both the concentric and eccentric phases",
                "Focus on squeezing your shoulder blades together"
            ],
            "common_mistakes": [
                "Using momentum instead of muscle control",
                "Pulling the bar behind the head",
                "Not controlling the eccentric (lowering) phase",
                "Using too much weight"
            ]
        },
        "pull_up": {
            "name": "pull_up",
            "display_name": "Pull-up",
            "description": "Bodyweight vertical pulling exercise",
            "primary_joints": ["shoulder", "elbow"],
            "recommended_joint": "shoulder",
            "movement_pattern": "vertical_pull",
            "difficulty": "intermediate",
            "tips": [
                "Start from a dead hang position",
                "Pull your chest up to the bar",
                "Lower yourself with control",
                "Engage your lats and core"
            ],
            "common_mistakes": [
                "Kipping or using momentum",
                "Not reaching full range of motion",
                "Not controlling the descent",
                "Using too narrow or too wide grip"
            ]
        },
        "bicep_curl": {
            "name": "bicep_curl",
            "display_name": "Bicep Curl",
            "description": "Isolation exercise for biceps",
            "primary_joints": ["wrist", "elbow"],
            "recommended_joint": "elbow",
            "movement_pattern": "horizontal_flexion",
            "difficulty": "beginner",
            "tips": [
                "Keep your elbows at your sides",
                "Control the weight throughout the full range of motion",
                "Squeeze your biceps at the top",
                "Don't swing the weight"
            ],
            "common_mistakes": [
                "Using momentum to lift the weight",
                "Moving the elbows forward",
                "Not controlling the eccentric phase",
                "Using too much weight"
            ]
        },
        "push_up": {
            "name": "push_up",
            "display_name": "Push-up",
            "description": "Bodyweight horizontal pushing exercise",
            "primary_joints": ["shoulder", "elbow"],
            "recommended_joint": "shoulder",
            "movement_pattern": "vertical_push",
            "difficulty": "beginner",
            "tips": [
                "Keep your body in a straight line",
                "Lower your chest to the ground",
                "Push up explosively",
                "Engage your core throughout"
            ],
            "common_mistakes": [
                "Sagging hips or raised butt",
                "Not going low enough",
                "Flaring elbows too wide",
                "Not maintaining straight body line"
            ]
        },
        "squat": {
            "name": "squat",
            "display_name": "Squat",
            "description": "Lower body compound movement",
            "primary_joints": ["hip", "knee"],
            "recommended_joint": "knee",
            "movement_pattern": "vertical_squat",
            "difficulty": "beginner",
            "tips": [
                "Keep your chest up and core engaged",
                "Sit back into your hips",
                "Go down until thighs are parallel to floor",
                "Drive through your heels to stand up"
            ],
            "common_mistakes": [
                "Knees caving in",
                "Not going deep enough",
                "Leaning too far forward",
                "Heels coming off the ground"
            ]
        },
        "bench_press": {
            "name": "bench_press",
            "display_name": "Bench Press",
            "description": "Horizontal pushing exercise for chest and triceps",
            "primary_joints": ["shoulder", "elbow"],
            "recommended_joint": "elbow",
            "movement_pattern": "horizontal_push",
            "difficulty": "intermediate",
            "tips": [
                "Keep your feet flat on the floor",
                "Retract your shoulder blades",
                "Lower the bar to your chest",
                "Press up explosively"
            ],
            "common_mistakes": [
                "Bouncing the bar off your chest",
                "Not controlling the descent",
                "Flaring elbows too wide",
                "Lifting feet off the ground"
            ]
        }
    }
    
    if exercise_name not in exercises:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    return exercises[exercise_name]

