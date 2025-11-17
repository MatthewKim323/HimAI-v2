"""
Pose Detection Module using MediaPipe
Detects body joints and tracks movement for tension analysis
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PoseDetector:
    """
    Detects human pose using MediaPipe and tracks joint positions
    """
    
    def __init__(self):
        """Initialize MediaPipe Pose detector"""
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,  # 0, 1, or 2. Higher = more accurate but slower
            smooth_landmarks=True,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Key joints for exercise analysis
        self.key_joints = {
            'shoulder': [self.mp_pose.PoseLandmark.LEFT_SHOULDER, 
                        self.mp_pose.PoseLandmark.RIGHT_SHOULDER],
            'elbow': [self.mp_pose.PoseLandmark.LEFT_ELBOW, 
                     self.mp_pose.PoseLandmark.RIGHT_ELBOW],
            'wrist': [self.mp_pose.PoseLandmark.LEFT_WRIST, 
                     self.mp_pose.PoseLandmark.RIGHT_WRIST],
            'hip': [self.mp_pose.PoseLandmark.LEFT_HIP, 
                   self.mp_pose.PoseLandmark.RIGHT_HIP],
            'knee': [self.mp_pose.PoseLandmark.LEFT_KNEE, 
                    self.mp_pose.PoseLandmark.RIGHT_KNEE],
            'ankle': [self.mp_pose.PoseLandmark.LEFT_ANKLE, 
                     self.mp_pose.PoseLandmark.RIGHT_ANKLE]
        }
    
    def detect_pose(self, frame: np.ndarray) -> Optional[Dict]:
        """
        Detect pose in a single frame
        
        Args:
            frame: Input image frame (BGR format)
            
        Returns:
            Dictionary containing landmark positions or None if no pose detected
        """
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame
        results = self.pose.process(frame_rgb)
        
        if not results.pose_landmarks:
            return None
        
        # Extract landmark positions
        landmarks = {}
        for landmark_name, landmark_indices in self.key_joints.items():
            positions = []
            for idx in landmark_indices:
                landmark = results.pose_landmarks.landmark[idx]
                positions.append({
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z,
                    'visibility': landmark.visibility
                })
            landmarks[landmark_name] = positions
        
        return {
            'landmarks': landmarks,
            'raw_landmarks': results.pose_landmarks
        }
    
    def process_video(self, video_path: str) -> List[Dict]:
        """
        Process entire video and extract pose data for each frame
        
        Args:
            video_path: Path to video file
            
        Returns:
            List of pose data for each frame
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            logger.error(f"Failed to open video: {video_path}")
            return []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        logger.info(f"Processing video: {frame_count} frames at {fps} FPS")
        
        pose_data = []
        frame_number = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            
            if not ret:
                break
            
            # Detect pose in current frame
            pose_result = self.detect_pose(frame)
            
            if pose_result:
                pose_result['frame_number'] = frame_number
                pose_result['timestamp'] = frame_number / fps
                pose_data.append(pose_result)
            
            frame_number += 1
            
            # Log progress every 30 frames
            if frame_number % 30 == 0:
                logger.info(f"Processed {frame_number}/{frame_count} frames")
        
        cap.release()
        logger.info(f"Video processing complete: {len(pose_data)} frames with pose data")
        
        return pose_data
    
    def get_joint_position(self, pose_data: Dict, joint_name: str, side: str = 'left') -> Optional[Tuple[float, float, float]]:
        """
        Get 3D position of a specific joint
        
        Args:
            pose_data: Pose data dictionary
            joint_name: Name of joint (e.g., 'shoulder', 'elbow')
            side: 'left' or 'right'
            
        Returns:
            (x, y, z) position or None
        """
        if joint_name not in pose_data['landmarks']:
            return None
        
        joint_positions = pose_data['landmarks'][joint_name]
        index = 0 if side == 'left' else 1
        
        if index >= len(joint_positions):
            return None
        
        pos = joint_positions[index]
        return (pos['x'], pos['y'], pos['z'])
    
    def close(self):
        """Release resources"""
        self.pose.close()

