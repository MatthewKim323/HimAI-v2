"""
Real-time Visualization Generator
Creates annotated video frames showing MediaPipe pose detection
"""

import cv2
import mediapipe as mp
import numpy as np
import base64
from typing import List, Dict, Optional, Generator
import logging
from io import BytesIO

logger = logging.getLogger(__name__)


class VisualizationGenerator:
    """
    Generates real-time visualizations of pose detection and analysis
    """
    
    def __init__(self):
        """Initialize MediaPipe drawing utilities"""
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # Color scheme for visualization
        self.colors = {
            'landmark': (0, 255, 0),  # Green for landmarks
            'connection': (255, 255, 255),  # White for connections
            'tracked_joint': (0, 0, 255),  # Red for tracked joint
            'text': (255, 255, 255),  # White text
            'background': (0, 0, 0)  # Black background
        }
    
    def annotate_frame(
        self,
        frame: np.ndarray,
        pose_landmarks,
        tracked_joint: Optional[str] = None,
        joint_side: str = 'left',
        frame_number: int = 0,
        velocity: Optional[float] = None,
        rep_count: int = 0,
        tension_score: Optional[float] = None
    ) -> np.ndarray:
        """
        Annotate a single frame with pose landmarks and analysis info
        
        Args:
            frame: Input frame (BGR)
            pose_landmarks: MediaPipe pose landmarks
            tracked_joint: Joint being tracked (e.g., 'wrist', 'elbow')
            joint_side: 'left' or 'right'
            frame_number: Current frame number
            velocity: Current joint velocity
            rep_count: Current rep count
            tension_score: Current tension score
        
        Returns:
            Annotated frame
        """
        # Create a copy to avoid modifying original
        annotated = frame.copy()
        
        # Draw pose landmarks and connections
        if pose_landmarks:
            self.mp_drawing.draw_landmarks(
                annotated,
                pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
            )
            
            # Highlight tracked joint
            if tracked_joint:
                joint_idx = self._get_joint_index(tracked_joint, joint_side)
                if joint_idx is not None:
                    landmark = pose_landmarks.landmark[joint_idx]
                    h, w = annotated.shape[:2]
                    x = int(landmark.x * w)
                    y = int(landmark.y * h)
                    
                    # Draw large circle for tracked joint
                    cv2.circle(annotated, (x, y), 15, self.colors['tracked_joint'], -1)
                    cv2.circle(annotated, (x, y), 20, self.colors['tracked_joint'], 3)
        
        # Add info overlay
        self._add_info_overlay(
            annotated,
            frame_number=frame_number,
            velocity=velocity,
            rep_count=rep_count,
            tension_score=tension_score,
            tracked_joint=tracked_joint
        )
        
        return annotated
    
    def _get_joint_index(self, joint_name: str, side: str) -> Optional[int]:
        """Get MediaPipe landmark index for a joint"""
        joint_map = {
            'wrist': {
                'left': self.mp_pose.PoseLandmark.LEFT_WRIST,
                'right': self.mp_pose.PoseLandmark.RIGHT_WRIST
            },
            'elbow': {
                'left': self.mp_pose.PoseLandmark.LEFT_ELBOW,
                'right': self.mp_pose.PoseLandmark.RIGHT_ELBOW
            },
            'shoulder': {
                'left': self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                'right': self.mp_pose.PoseLandmark.RIGHT_SHOULDER
            },
            'hip': {
                'left': self.mp_pose.PoseLandmark.LEFT_HIP,
                'right': self.mp_pose.PoseLandmark.RIGHT_HIP
            },
            'knee': {
                'left': self.mp_pose.PoseLandmark.LEFT_KNEE,
                'right': self.mp_pose.PoseLandmark.RIGHT_KNEE
            },
            'ankle': {
                'left': self.mp_pose.PoseLandmark.LEFT_ANKLE,
                'right': self.mp_pose.PoseLandmark.RIGHT_ANKLE
            }
        }
        
        if joint_name in joint_map and side in joint_map[joint_name]:
            return joint_map[joint_name][side]
        return None
    
    def _add_info_overlay(
        self,
        frame: np.ndarray,
        frame_number: int = 0,
        velocity: Optional[float] = None,
        rep_count: int = 0,
        tension_score: Optional[float] = None,
        tracked_joint: Optional[str] = None
    ):
        """Add information overlay to frame"""
        h, w = frame.shape[:2]
        
        # Create semi-transparent overlay
        overlay = frame.copy()
        
        # Draw info box background
        box_height = 120
        cv2.rectangle(
            overlay,
            (10, 10),
            (350, box_height),
            (0, 0, 0),
            -1
        )
        
        # Add transparency
        alpha = 0.7
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
        
        # Add text information
        y_offset = 30
        line_height = 25
        
        # Frame number
        cv2.putText(
            frame,
            f"Frame: {frame_number}",
            (20, y_offset),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            self.colors['text'],
            2
        )
        
        # Tracked joint
        if tracked_joint:
            cv2.putText(
                frame,
                f"Tracking: {tracked_joint}",
                (20, y_offset + line_height),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                self.colors['text'],
                2
            )
        
        # Velocity
        if velocity is not None:
            cv2.putText(
                frame,
                f"Velocity: {velocity:.2f}",
                (20, y_offset + line_height * 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                self.colors['text'],
                2
            )
        
        # Rep count
        cv2.putText(
            frame,
            f"Reps: {rep_count}",
            (20, y_offset + line_height * 3),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            self.colors['text'],
            2
        )
        
        # Tension score
        if tension_score is not None:
            color = (0, 255, 0) if tension_score > 70 else (0, 165, 255) if tension_score > 40 else (0, 0, 255)
            cv2.putText(
                frame,
                f"Tension: {tension_score:.1f}%",
                (20, y_offset + line_height * 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                color,
                2
            )
    
    def frame_to_base64(self, frame: np.ndarray) -> str:
        """
        Convert frame to base64 encoded JPEG
        
        Args:
            frame: Frame to encode (BGR format)
        
        Returns:
            Base64 encoded JPEG string
        """
        # Resize frame for faster transmission (optional)
        # frame = cv2.resize(frame, (640, 480))
        
        # Encode as JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        # Convert to base64
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return img_base64
    
    def process_video_with_visualization(
        self,
        video_path: str,
        pose_detector,
        velocity_calculator,
        joint_name: str = 'wrist',
        side: str = 'left',
        exercise_type: str = 'default'
    ) -> Generator[Dict, None, None]:
        """
        Process video frame-by-frame and yield annotated frames with analysis
        
        Args:
            video_path: Path to video file
            pose_detector: PoseDetector instance
            velocity_calculator: VelocityCalculator instance
            joint_name: Joint to track
            side: 'left' or 'right'
            exercise_type: Exercise type for rep detection
        
        Yields:
            Dictionary with frame data, annotations, and analysis
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            logger.error(f"Could not open video: {video_path}")
            return
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        frame_number = 0
        pose_history = []
        velocities = []
        rep_count = 0
        current_tension = 0.0
        
        logger.info(f"Processing video: {total_frames} frames at {fps} FPS")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Detect pose
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose_detector.pose.process(frame_rgb)
            
            if results.pose_landmarks:
                pose_history.append({
                    'frame': frame_number,
                    'landmarks': results.pose_landmarks,
                    'timestamp': frame_number / fps if fps > 0 else frame_number * 0.033
                })
                
                # Calculate velocity if we have previous frame
                if len(pose_history) > 1:
                    # Extract joint position from current landmarks
                    joint_idx = self._get_joint_index(joint_name, side)
                    if joint_idx is not None:
                        prev_landmark = pose_history[-2]['landmarks'].landmark[joint_idx]
                        curr_landmark = results.pose_landmarks.landmark[joint_idx]
                        
                        prev_pos = (prev_landmark.x, prev_landmark.y, prev_landmark.z)
                        curr_pos = (curr_landmark.x, curr_landmark.y, curr_landmark.z)
                        
                        time_diff = 1.0 / fps if fps > 0 else 0.033
                        velocity = velocity_calculator.calculate_velocity(prev_pos, curr_pos, time_diff)
                        velocities.append(velocity)
                    else:
                        velocities.append(0.0)
                else:
                    velocities.append(0.0)
                
                # Detect reps (simplified - check every 10 frames)
                if len(velocities) > 10 and len(velocities) % 10 == 0:
                    recent_reps = velocity_calculator.detect_reps(
                        velocities,
                        exercise_type=exercise_type
                    )
                    rep_count = len(recent_reps)
                    
                    if recent_reps:
                        current_tension = velocity_calculator.calculate_overall_tension_rating(recent_reps)
                
                # Annotate frame
                annotated_frame = self.annotate_frame(
                    frame,
                    results.pose_landmarks,
                    tracked_joint=joint_name,
                    joint_side=side,
                    frame_number=frame_number,
                    velocity=velocities[-1] if velocities else None,
                    rep_count=rep_count,
                    tension_score=current_tension
                )
                
                # Convert to base64
                frame_base64 = self.frame_to_base64(annotated_frame)
                
                # Yield frame data
                yield {
                    'frame_number': frame_number,
                    'total_frames': total_frames,
                    'progress': (frame_number / total_frames) * 100 if total_frames > 0 else 0,
                    'frame_image': frame_base64,
                    'pose_detected': True,
                    'velocity': velocities[-1] if velocities else None,
                    'rep_count': rep_count,
                    'tension_score': current_tension,
                    'timestamp': frame_number / fps if fps > 0 else frame_number * 0.033
                }
            else:
                # No pose detected
                annotated_frame = self.annotate_frame(
                    frame,
                    None,
                    frame_number=frame_number,
                    rep_count=rep_count
                )
                frame_base64 = self.frame_to_base64(annotated_frame)
                
                yield {
                    'frame_number': frame_number,
                    'total_frames': total_frames,
                    'progress': (frame_number / total_frames) * 100 if total_frames > 0 else 0,
                    'frame_image': frame_base64,
                    'pose_detected': False,
                    'velocity': None,
                    'rep_count': rep_count,
                    'tension_score': current_tension,
                    'timestamp': frame_number / fps if fps > 0 else frame_number * 0.033
                }
            
            frame_number += 1
        
        cap.release()
        
        # Yield final summary
        yield {
            'frame_number': frame_number,
            'total_frames': total_frames,
            'progress': 100.0,
            'complete': True,
            'final_rep_count': rep_count,
            'final_tension_score': current_tension
        }

