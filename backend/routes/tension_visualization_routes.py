"""
Real-time Visualization Routes for Tension Detector
Streams annotated video frames showing MediaPipe analysis in real-time
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
import logging
from pathlib import Path
import shutil
import json
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from tension_detector.pose_detector import PoseDetector
from tension_detector.velocity_calculator import VelocityCalculator
from tension_detector.visualization_generator import VisualizationGenerator
from routes.tension_routes import get_exercise_details

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tension", tags=["tension-visualization"])

# Temporary upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/analyze/stream")
async def stream_analysis(
    file: UploadFile = File(...),
    exercise: str = "lat_pulldown",
    joint_name: str = None,
    side: str = "left"
):
    """
    Stream real-time analysis with annotated video frames
    
    Returns Server-Sent Events (SSE) stream of:
    - Annotated frames with pose landmarks
    - Real-time velocity calculations
    - Rep detection updates
    - Tension score updates
    
    Frontend can display frames as they arrive for real-time visualization
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
    video_path = UPLOAD_DIR / f"temp_stream_{file.filename}"
    
    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Streaming analysis for: {video_path}")
        
        # Get exercise-specific parameters
        exercise_details = await get_exercise_details(exercise)
        
        # Use recommended joint if not specified
        if joint_name is None:
            joint_name = exercise_details["recommended_joint"]
        
        # Initialize components
        pose_detector = PoseDetector()
        velocity_calculator = VelocityCalculator()
        viz_generator = VisualizationGenerator()
        
        def generate_frames():
            """Generator function for SSE stream"""
            try:
                for frame_data in viz_generator.process_video_with_visualization(
                    str(video_path),
                    pose_detector,
                    velocity_calculator,
                    joint_name=joint_name,
                    side=side,
                    exercise_type=exercise
                ):
                    # Format as SSE
                    yield f"data: {json.dumps(frame_data)}\n\n"
                
                # Send completion message
                yield f"data: {json.dumps({'complete': True, 'message': 'Analysis complete'})}\n\n"
            
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                # Cleanup
                pose_detector.close()
                if video_path.exists():
                    video_path.unlink()
        
        return StreamingResponse(
            generate_frames(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    
    except Exception as e:
        logger.error(f"Error streaming analysis: {str(e)}")
        
        # Clean up on error
        if video_path.exists():
            video_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")


@router.post("/analyze/preview")
async def preview_analysis(
    file: UploadFile = File(...),
    exercise: str = Form("lat_pulldown"),
    joint_name: str = Form(None),
    side: str = Form("left"),
    sample_rate: str = Form("5")  # Accept as string, convert to int
):
    """
    Get preview frames with annotations (not real-time, but faster)
    Returns JSON with array of annotated frames
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
    video_path = UPLOAD_DIR / f"temp_preview_{file.filename}"
    
    try:
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Generating preview for: {video_path}")
        
        # Get exercise-specific parameters
        exercise_details = await get_exercise_details(exercise)
        
        if joint_name is None:
            joint_name = exercise_details["recommended_joint"]
        
        # Initialize components
        pose_detector = PoseDetector()
        velocity_calculator = VelocityCalculator()
        viz_generator = VisualizationGenerator()
        
        # Convert sample_rate to int
        try:
            sample_rate_int = int(sample_rate) if sample_rate else 5
        except (ValueError, TypeError):
            sample_rate_int = 5
        
        # Collect frames
        frames = []
        frame_count = 0
        
        for frame_data in viz_generator.process_video_with_visualization(
            str(video_path),
            pose_detector,
            velocity_calculator,
            joint_name=joint_name,
            side=side,
            exercise_type=exercise
        ):
            # Sample frames
            if frame_count % sample_rate_int == 0:
                frames.append(frame_data)
            frame_count += 1
        
        # Cleanup
        pose_detector.close()
        if video_path.exists():
            video_path.unlink()
        
        return JSONResponse(content={
            'success': True,
            'frames': frames,
            'total_frames': len(frames),
            'sample_rate': sample_rate_int
        })
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"Error generating preview: {str(e)}")
        logger.error(f"Traceback: {error_trace}")
        
        if video_path.exists():
            video_path.unlink()
        
        raise HTTPException(
            status_code=500, 
            detail=f"Preview generation failed: {str(e)}"
        )

