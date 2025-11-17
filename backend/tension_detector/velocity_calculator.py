"""
Velocity Calculator Module
Calculates joint velocities and analyzes movement patterns
"""

import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class VelocityCalculator:
    """
    Calculates velocities from pose data and analyzes movement patterns
    """
    
    def __init__(self, fps: float = 30.0):
        """
        Initialize velocity calculator
        
        Args:
            fps: Frames per second of the video
        """
        self.fps = fps
        self.frame_time = 1.0 / fps
        
        # Exercise-specific parameters for better rep detection
        self.exercise_params = {
            # Upper Body Pushing
            'barbell_bench_press': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 1.2,
                'min_rest_duration': 0.5,
                'smoothing_window': 7,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_push',
                'difficulty': 'intermediate'
            },
            'dumbbell_bench_press': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_push',
                'difficulty': 'intermediate'
            },
            'incline_bench_press': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 1.1,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'incline_push',
                'difficulty': 'intermediate'
            },
            'push_up': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 0.8,
                'min_rest_duration': 0.3,
                'smoothing_window': 5,
                'primary_joints': ['shoulder', 'elbow', 'wrist', 'hip'],
                'recommended_joint': 'shoulder',
                'movement_pattern': 'vertical_push',
                'difficulty': 'beginner'
            },
            
            # Upper Body Pulling
            'lat_pulldown': {
                'velocity_threshold': 0.02,  # Very low threshold to catch individual movements
                'min_rep_duration': 0.2,     # Very short minimum duration
                'min_rest_duration': 0.1,    # Very short rest between reps
                'smoothing_window': 2,       # Minimal smoothing to preserve detail
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'shoulder',
                'movement_pattern': 'vertical_pull',
                'difficulty': 'beginner'
            },
            'pull_up': {
                'velocity_threshold': 0.08,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'shoulder',
                'movement_pattern': 'vertical_pull',
                'difficulty': 'intermediate'
            },
            'seated_cable_row': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.9,
                'min_rest_duration': 0.3,
                'smoothing_window': 5,
                'primary_joints': ['shoulder', 'elbow', 'wrist', 'hip'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_pull',
                'difficulty': 'beginner'
            },
            
            # Arm Isolation
            'barbell_bicep_curl': {
                'velocity_threshold': 0.04,
                'min_rep_duration': 0.7,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_flexion',
                'difficulty': 'beginner'
            },
            'dumbbell_bicep_curl': {
                'velocity_threshold': 0.04,
                'min_rep_duration': 0.6,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_flexion',
                'difficulty': 'beginner'
            },
            'tricep_pushdown': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.6,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'vertical_extension',
                'difficulty': 'beginner'
            },
            'skull_crushers': {
                'velocity_threshold': 0.04,
                'min_rep_duration': 0.8,
                'min_rest_duration': 0.3,
                'smoothing_window': 4,
                'primary_joints': ['elbow', 'wrist'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_extension',
                'difficulty': 'intermediate'
            },
            'overhead_tricep_press': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.8,
                'min_rest_duration': 0.3,
                'smoothing_window': 4,
                'primary_joints': ['elbow', 'wrist', 'shoulder'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'vertical_extension',
                'difficulty': 'intermediate'
            },
            
            # Shoulder Exercises
            'shoulder_press': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'shoulder',
                'movement_pattern': 'vertical_press',
                'difficulty': 'intermediate'
            },
            'lateral_raises': {
                'velocity_threshold': 0.04,
                'min_rep_duration': 0.8,
                'min_rest_duration': 0.3,
                'smoothing_window': 4,
                'primary_joints': ['shoulder', 'elbow', 'wrist'],
                'recommended_joint': 'shoulder',
                'movement_pattern': 'lateral_abduction',
                'difficulty': 'beginner'
            },
            
            # Lower Body
            'barbell_squat': {
                'velocity_threshold': 0.08,
                'min_rep_duration': 1.5,
                'min_rest_duration': 0.6,
                'smoothing_window': 8,
                'primary_joints': ['hip', 'knee', 'ankle', 'shoulder'],
                'recommended_joint': 'knee',
                'movement_pattern': 'vertical_squat',
                'difficulty': 'intermediate'
            },
            'dumbbell_goblet_squat': {
                'velocity_threshold': 0.07,
                'min_rep_duration': 1.3,
                'min_rest_duration': 0.5,
                'smoothing_window': 7,
                'primary_joints': ['hip', 'knee', 'ankle', 'elbow'],
                'recommended_joint': 'knee',
                'movement_pattern': 'vertical_squat',
                'difficulty': 'beginner'
            },
            'deadlift': {
                'velocity_threshold': 0.08,
                'min_rep_duration': 1.2,
                'min_rest_duration': 0.8,
                'smoothing_window': 8,
                'primary_joints': ['hip', 'knee', 'ankle', 'shoulder'],
                'recommended_joint': 'hip',
                'movement_pattern': 'hip_hinge',
                'difficulty': 'intermediate'
            },
            'romanian_deadlift': {
                'velocity_threshold': 0.07,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.6,
                'smoothing_window': 7,
                'primary_joints': ['hip', 'knee', 'ankle', 'shoulder'],
                'recommended_joint': 'hip',
                'movement_pattern': 'hip_hinge',
                'difficulty': 'intermediate'
            },
            'lunges': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['hip', 'knee', 'ankle'],
                'recommended_joint': 'knee',
                'movement_pattern': 'lunge',
                'difficulty': 'beginner'
            },
            'calf_raises': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.6,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['ankle', 'knee'],
                'recommended_joint': 'ankle',
                'movement_pattern': 'plantar_flexion',
                'difficulty': 'beginner'
            },
            'leg_press': {
                'velocity_threshold': 0.07,
                'min_rep_duration': 1.2,
                'min_rest_duration': 0.5,
                'smoothing_window': 7,
                'primary_joints': ['hip', 'knee', 'ankle'],
                'recommended_joint': 'knee',
                'movement_pattern': 'leg_press',
                'difficulty': 'beginner'
            },
            'hip_thrust': {
                'velocity_threshold': 0.06,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 6,
                'primary_joints': ['hip', 'knee', 'shoulder'],
                'recommended_joint': 'hip',
                'movement_pattern': 'hip_extension',
                'difficulty': 'intermediate'
            },
            
            # Legacy exercises for backward compatibility
            'bench_press': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.8,
                'min_rest_duration': 0.3,
                'smoothing_window': 5,
                'primary_joints': ['shoulder', 'elbow'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_push',
                'difficulty': 'intermediate'
            },
            'bicep_curl': {
                'velocity_threshold': 0.04,
                'min_rep_duration': 0.6,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['wrist', 'elbow'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'horizontal_flexion',
                'difficulty': 'beginner'
            },
            'squat': {
                'velocity_threshold': 0.08,
                'min_rep_duration': 1.0,
                'min_rest_duration': 0.4,
                'smoothing_window': 7,
                'primary_joints': ['hip', 'knee'],
                'recommended_joint': 'knee',
                'movement_pattern': 'vertical_squat',
                'difficulty': 'beginner'
            },
            
            'default': {
                'velocity_threshold': 0.05,
                'min_rep_duration': 0.6,
                'min_rest_duration': 0.2,
                'smoothing_window': 3,
                'primary_joints': ['wrist', 'elbow'],
                'recommended_joint': 'elbow',
                'movement_pattern': 'general'
            }
        }
    
    def calculate_velocity(self, pos1: Tuple[float, float, float], 
                          pos2: Tuple[float, float, float], 
                          time_diff: float) -> float:
        """
        Calculate velocity between two 3D positions
        
        Args:
            pos1: First position (x, y, z)
            pos2: Second position (x, y, z)
            time_diff: Time difference in seconds
            
        Returns:
            Velocity magnitude (units/second)
        """
        if time_diff == 0:
            return 0.0
        
        # Calculate Euclidean distance
        distance = np.sqrt(
            (pos2[0] - pos1[0])**2 + 
            (pos2[1] - pos1[1])**2 + 
            (pos2[2] - pos1[2])**2
        )
        
        return distance / time_diff
    
    def calculate_joint_velocities(self, pose_data_sequence: List[Dict], 
                                   joint_name: str = 'wrist', 
                                   side: str = 'left') -> List[Dict]:
        """
        Calculate velocities for a specific joint across frames
        
        Args:
            pose_data_sequence: List of pose data from consecutive frames
            joint_name: Name of joint to track
            side: 'left' or 'right'
            
        Returns:
            List of velocity data points
        """
        velocities = []
        
        for i in range(1, len(pose_data_sequence)):
            prev_frame = pose_data_sequence[i-1]
            curr_frame = pose_data_sequence[i]
            
            # Get joint positions
            prev_landmarks = prev_frame['landmarks']
            curr_landmarks = curr_frame['landmarks']
            
            if joint_name not in prev_landmarks or joint_name not in curr_landmarks:
                continue
            
            joint_idx = 0 if side == 'left' else 1
            prev_pos = prev_landmarks[joint_name][joint_idx]
            curr_pos = curr_landmarks[joint_name][joint_idx]
            
            # Calculate velocity
            prev_coords = (prev_pos['x'], prev_pos['y'], prev_pos['z'])
            curr_coords = (curr_pos['x'], curr_pos['y'], curr_pos['z'])
            
            time_diff = curr_frame['timestamp'] - prev_frame['timestamp']
            velocity = self.calculate_velocity(prev_coords, curr_coords, time_diff)
            
            velocities.append({
                'frame': curr_frame['frame_number'],
                'timestamp': curr_frame['timestamp'],
                'velocity': velocity,
                'position': curr_coords
            })
        
        return velocities
    
    def detect_reps(self, velocities: List[Dict], 
                   exercise_type: str = 'default',
                   velocity_threshold: float = None,
                   min_rep_duration: float = None,
                   min_rest_duration: float = None) -> List[Dict]:
        """
        Detect repetitions based on velocity patterns with improved algorithm for compound exercises
        
        Args:
            velocities: List of velocity data points
            exercise_type: Type of exercise for optimized parameters
            velocity_threshold: Override threshold for detecting movement start/end
            min_rep_duration: Override minimum duration for a valid rep (seconds)
            min_rest_duration: Override minimum rest time between reps (seconds)
            
        Returns:
            List of detected reps with start/end frames and metrics
        """
        if not velocities:
            return []
        
        # Get exercise-specific parameters
        params = self.exercise_params.get(exercise_type, self.exercise_params['default'])
        
        # Use provided parameters or exercise-specific defaults
        velocity_threshold = velocity_threshold or params['velocity_threshold']
        min_rep_duration = min_rep_duration or params['min_rep_duration']
        min_rest_duration = min_rest_duration or params['min_rest_duration']
        smoothing_window = params['smoothing_window']
        
        # Apply smoothing to reduce noise
        smoothed_velocities = self._smooth_velocity_data(velocities, smoothing_window)
        
        # Use bar movement detection for lat_pulldown
        if exercise_type == 'lat_pulldown':
            # Use the new bar movement detection method
            reps = self.detect_reps_from_bar_movement(smoothed_velocities, exercise_type)
            logger.info(f"Bar movement detection result: {len(reps)} reps")
            return reps
    def detect_reps_from_bar_movement(self, velocities: List[Dict], exercise_type: str = 'lat_pulldown') -> List[Dict]:
        """
        Detect reps by tracking actual bar/hands movement (vertical position changes)
        Then calculate velocity within each detected rep
        """
        logger.info("Using bar movement detection for rep counting")
        
        # Extract position data (assuming velocities contain position info)
        positions = []
        for vel_data in velocities:
            # Use actual joint position data - extract y-coordinate for vertical movement
            if 'position' in vel_data and isinstance(vel_data['position'], (list, tuple)):
                # Position is (x, y, z) tuple, use y-coordinate for vertical movement
                position = vel_data['position'][1]  # y-coordinate
            else:
                position = vel_data['frame']  # Use frame as position proxy
            
            positions.append({
                'frame': vel_data['frame'],
                'timestamp': vel_data['timestamp'],
                'position': position,
                'velocity': vel_data['velocity']
            })
        
        # Detect reps based on vertical movement patterns
        reps = self._detect_bar_movement_reps(positions)
        
        # Calculate velocity metrics for each detected rep
        enhanced_reps = []
        for rep in reps:
            # Extract velocity data for this rep
            rep_velocities = [v for v in velocities if rep['start_frame'] <= v['frame'] <= rep['end_frame']]
            
            if rep_velocities:
                # Calculate velocity metrics within this rep
                avg_velocity = sum(v['velocity'] for v in rep_velocities) / len(rep_velocities)
                max_velocity = max(v['velocity'] for v in rep_velocities)
                min_velocity = min(v['velocity'] for v in rep_velocities)
                
                # Calculate tension based on velocity within the rep
                tension_score = max(0, 100 - (avg_velocity * 50))
                
                enhanced_rep = {
                    'start_time': rep['start_time'],
                    'end_time': rep['end_time'],
                    'duration': rep['duration'],
                    'start_frame': rep['start_frame'],
                    'end_frame': rep['end_frame'],
                    'avg_velocity': avg_velocity,
                    'max_velocity': max_velocity,
                    'min_velocity': min_velocity,
                    'tension_score': tension_score,
                    'rep_type': 'bar_movement',
                    'velocity_points': len(rep_velocities)
                }
                enhanced_reps.append(enhanced_rep)
        
        logger.info(f"Bar movement detection found {len(enhanced_reps)} reps")
        return enhanced_reps
    
    def _detect_bar_movement_reps(self, positions: List[Dict]) -> List[Dict]:
        """
        Detect reps by analyzing vertical bar/hands movement patterns
        Looks for pull-down and release-up cycles
        """
        logger.info("Analyzing bar movement patterns for rep detection")
        
        reps = []
        
        # Calculate position changes (movement direction)
        movements = []
        for i in range(1, len(positions)):
            prev_pos = positions[i-1]['position']
            curr_pos = positions[i]['position']
            movement = curr_pos - prev_pos  # Positive = down, Negative = up
            movements.append({
                'frame': positions[i]['frame'],
                'timestamp': positions[i]['timestamp'],
                'movement': movement,
                'position': curr_pos
            })
        
        # Find pull-down phases (positive movement)
        pull_phases = []
        i = 0
        while i < len(movements):
            if movements[i]['movement'] > 0.005:  # Much lower threshold based on actual data
                pull_start = i
                # Find end of pull phase
                while i < len(movements) and movements[i]['movement'] > 0:
                    i += 1
                pull_end = i - 1
                
                if pull_end > pull_start:  # Valid pull phase
                    pull_phases.append({
                        'start_frame': movements[pull_start]['frame'],
                        'end_frame': movements[pull_end]['frame'],
                        'start_time': movements[pull_start]['timestamp'],
                        'end_time': movements[pull_end]['timestamp'],
                        'duration': movements[pull_end]['timestamp'] - movements[pull_start]['timestamp']
                    })
            else:
                i += 1
        
        # Find release-up phases (negative movement) after each pull
        for pull_phase in pull_phases:
            pull_end_frame = pull_phase['end_frame']
            
            # Look for release phase after this pull
            release_start = None
            release_end = None
            
            for i, movement in enumerate(movements):
                if movement['frame'] > pull_end_frame:
                    if movement['movement'] < -0.005:  # Much lower threshold based on actual data
                        release_start = i
                        # Find end of release phase
                        while i < len(movements) and movements[i]['movement'] < 0:
                            i += 1
                        release_end = i - 1
                        break
            
            # If we found a complete pull-release cycle, it's a rep
            if release_start is not None and release_end is not None:
                rep = {
                    'start_time': pull_phase['start_time'],
                    'end_time': movements[release_end]['timestamp'],
                    'duration': movements[release_end]['timestamp'] - pull_phase['start_time'],
                    'start_frame': pull_phase['start_frame'],
                    'end_frame': movements[release_end]['frame'],
                    'pull_duration': pull_phase['duration'],
                    'release_duration': movements[release_end]['timestamp'] - movements[release_start]['timestamp']
                }
                reps.append(rep)
        
        logger.info(f"Detected {len(reps)} reps from bar movement analysis")
        return reps
        
        reps = []
        in_rep = False
        rep_start_idx = 0
        last_rep_end_time = 0
        
        for i, vel_data in enumerate(smoothed_velocities):
            velocity = vel_data['velocity']
            timestamp = vel_data['timestamp']
            
            # Detect start of rep (velocity increases above threshold)
            if not in_rep and velocity > velocity_threshold:
                # Ensure enough time has passed since last rep
                if timestamp - last_rep_end_time >= min_rest_duration:
                    in_rep = True
                    rep_start_idx = i
            
            # Detect end of rep (velocity drops below threshold)
            elif in_rep and velocity < velocity_threshold:
                rep_end_idx = i
                rep_duration = velocities[rep_end_idx]['timestamp'] - velocities[rep_start_idx]['timestamp']
                
                # Only count if duration is sufficient and movement is significant
                if rep_duration >= min_rep_duration and self._is_significant_movement(velocities[rep_start_idx:rep_end_idx+1]):
                    rep_velocities = [v['velocity'] for v in velocities[rep_start_idx:rep_end_idx+1]]
                    
                    reps.append({
                        'rep_number': len(reps) + 1,
                        'start_frame': velocities[rep_start_idx]['frame'],
                        'end_frame': velocities[rep_end_idx]['frame'],
                        'start_time': velocities[rep_start_idx]['timestamp'],
                        'end_time': velocities[rep_end_idx]['timestamp'],
                        'duration': rep_duration,
                        'avg_velocity': np.mean(rep_velocities),
                        'max_velocity': np.max(rep_velocities),
                        'min_velocity': np.min(rep_velocities),
                        'velocity_profile': rep_velocities
                    })
                    
                    last_rep_end_time = velocities[rep_end_idx]['timestamp']
                
                in_rep = False
        
        logger.info(f"Detected {len(reps)} repetitions")
        return reps
    
    def _smooth_velocity_data(self, velocities: List[Dict], window_size: int = 5) -> List[Dict]:
        """
        Apply moving average smoothing to reduce noise in velocity data
        
        Args:
            velocities: List of velocity data points
            window_size: Size of smoothing window
            
        Returns:
            Smoothed velocity data
        """
        if len(velocities) < window_size:
            return velocities
        
        smoothed = []
        for i in range(len(velocities)):
            start_idx = max(0, i - window_size // 2)
            end_idx = min(len(velocities), i + window_size // 2 + 1)
            
            window_velocities = [v['velocity'] for v in velocities[start_idx:end_idx]]
            smoothed_velocity = np.mean(window_velocities)
            
            smoothed.append({
                **velocities[i],
                'velocity': smoothed_velocity
            })
        
        return smoothed
    
    def _adaptive_lat_pulldown_detection(self, velocities: List[Dict], velocity_threshold: float, 
                                       min_rep_duration: float, min_rest_duration: float) -> List[Dict]:
        """
        Adaptive detection specifically for lat pulldowns that analyzes movement patterns
        """
        # Analyze the video characteristics first
        video_duration = velocities[-1]['timestamp'] - velocities[0]['timestamp'] if velocities else 0
        avg_velocity = sum(v['velocity'] for v in velocities) / len(velocities) if velocities else 0
        max_velocity = max(v['velocity'] for v in velocities) if velocities else 0
        
        logger.info(f"Video analysis: duration={video_duration:.1f}s, avg_vel={avg_velocity:.3f}, max_vel={max_velocity:.3f}")
        
        # Try multiple parameter sets based on video characteristics
        param_sets = [
            # Conservative (for fast, short videos)
            {'name': 'conservative', 'vel_thresh': velocity_threshold * 1.2, 'min_dur': min_rep_duration * 1.2, 'min_rest': min_rest_duration * 1.5},
            # Primary (default)
            {'name': 'primary', 'vel_thresh': velocity_threshold, 'min_dur': min_rep_duration, 'min_rest': min_rest_duration},
            # Lenient (for slow, long videos)
            {'name': 'lenient', 'vel_thresh': velocity_threshold * 0.8, 'min_dur': min_rep_duration * 0.8, 'min_rest': min_rest_duration * 0.7},
            # Very lenient (for very slow videos)
            {'name': 'very_lenient', 'vel_thresh': velocity_threshold * 0.6, 'min_dur': min_rep_duration * 0.6, 'min_rest': min_rest_duration * 0.5},
        ]
        
        results = []
        for param_set in param_sets:
            reps = self._detect_reps_core(velocities, param_set['vel_thresh'], param_set['min_dur'], param_set['min_rest'])
            results.append((param_set['name'], reps))
        
        # Smart selection based on video characteristics and rep count
        def score_result(result):
            name, reps = result
            count = len(reps)
            
            # Base score on rep count
            if count == 0:
                return 0
            elif 4 <= count <= 6:
                return 10  # Perfect range
            elif 3 <= count <= 8:
                return 8 - abs(count - 5)  # Good range
            elif count < 3:
                return count  # Prefer more reps if under 3
            else:
                return max(0, 8 - count)  # Penalize over-detection
        
        # Sort by score
        results.sort(key=score_result, reverse=True)
        
        best_method, best_reps = results[0]
        logger.info(f"Using {best_method} detection: {len(best_reps)} reps (score: {score_result((best_method, best_reps))})")
        
        return best_reps
    
    def _detect_reps_core(self, velocities: List[Dict], velocity_threshold: float, 
                         min_rep_duration: float, min_rest_duration: float) -> List[Dict]:
        """
        Core rep detection logic
        """
        reps = []
        in_rep = False
        rep_start_idx = 0
        last_rep_end_time = 0
        
        for i, vel_data in enumerate(velocities):
            velocity = vel_data['velocity']
            timestamp = vel_data['timestamp']
            
            # Detect start of rep (velocity increases above threshold)
            if not in_rep and velocity > velocity_threshold:
                # Ensure enough time has passed since last rep
                if timestamp - last_rep_end_time >= min_rest_duration:
                    in_rep = True
                    rep_start_idx = i
            
            # Detect end of rep (velocity drops below threshold)
            elif in_rep and velocity < velocity_threshold:
                rep_end_idx = i
                rep_duration = velocities[rep_end_idx]['timestamp'] - velocities[rep_start_idx]['timestamp']
                
                # Check if rep meets minimum duration
                if rep_duration >= min_rep_duration:
                    # Extract rep velocity data
                    rep_velocities = velocities[rep_start_idx:rep_end_idx+1]
                    
                    # Check if movement is significant
                    if self._is_significant_movement(rep_velocities):
                        avg_velocity = sum(v['velocity'] for v in rep_velocities) / len(rep_velocities)
                        
                        reps.append({
                            'start_time': velocities[rep_start_idx]['timestamp'],
                            'end_time': velocities[rep_end_idx]['timestamp'],
                            'duration': rep_duration,
                            'avg_velocity': avg_velocity,
                            'start_frame': velocities[rep_start_idx]['frame'],
                            'end_frame': velocities[rep_end_idx]['frame']
                        })
                        
                        last_rep_end_time = velocities[rep_end_idx]['timestamp']
                
                in_rep = False
        
        return reps
    
    def _detect_concentric_eccentric_reps(self, velocities: List[Dict], velocity_threshold: float, 
                                         min_rep_duration: float, min_rest_duration: float) -> List[Dict]:
        """
        Detect reps using concentric-eccentric pattern for lat pulldowns
        Looks for: Pull down (concentric) -> Release up (eccentric) = 1 rep
        """
        logger.info("Using concentric-eccentric rep detection for lat pulldown")
        
        reps = []
        i = 0
        
        while i < len(velocities) - 10:  # Need at least 10 frames for pattern detection
            # Look for concentric phase (pulling down - positive velocity)
            concentric_start = None
            concentric_end = None
            
            # Find concentric phase (pulling down)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] > velocity_threshold:
                    concentric_start = i
                    break
                i += 1
            
            if concentric_start is None:
                i += 1
                continue
            
            # Find end of concentric phase (velocity drops below threshold)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] < velocity_threshold:
                    concentric_end = i
                    break
                i += 1
            
            if concentric_end is None:
                i += 1
                continue
            
            # Look for eccentric phase (releasing up - negative velocity or low positive)
            eccentric_start = None
            eccentric_end = None
            
            # Find eccentric phase (releasing up)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] < velocity_threshold * 0.7:  # More sensitive for eccentric
                    eccentric_start = i
                    break
                i += 1
            
            if eccentric_start is None:
                i += 1
                continue
            
            # Find end of eccentric phase (velocity increases again or stays low)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] > velocity_threshold * 0.6 or i - eccentric_start > 10:  # More sensitive, shorter max frames
                    eccentric_end = i
                    break
                i += 1
            
            if eccentric_end is None:
                eccentric_end = min(i + 10, len(velocities) - 1)
            
            # Check if we have a complete concentric-eccentric pattern
            if (concentric_start is not None and concentric_end is not None and 
                eccentric_start is not None and eccentric_end is not None):
                
                # Calculate rep duration
                rep_duration = velocities[eccentric_end]['timestamp'] - velocities[concentric_start]['timestamp']
                
                # Check minimum duration
                if rep_duration >= min_rep_duration:
                    # Extract velocity data for the entire rep
                    rep_velocities = velocities[concentric_start:eccentric_end+1]
                    
                    # Calculate average velocity and tension metrics
                    avg_velocity = sum(v['velocity'] for v in rep_velocities) / len(rep_velocities)
                    
                    # Calculate concentric vs eccentric velocity
                    concentric_velocities = [v['velocity'] for v in rep_velocities[:concentric_end-concentric_start+1]]
                    eccentric_velocities = [v['velocity'] for v in rep_velocities[concentric_end-concentric_start+1:]]
                    
                    concentric_avg = sum(concentric_velocities) / len(concentric_velocities) if concentric_velocities else 0
                    eccentric_avg = sum(eccentric_velocities) / len(eccentric_velocities) if eccentric_velocities else 0
                    
                    # Calculate tension rating based on velocity decay
                    # Slower reps (lower velocity) = higher tension
                    tension_score = max(0, 100 - (avg_velocity * 50))  # Scale to 0-100
                    
                    reps.append({
                        'start_time': velocities[concentric_start]['timestamp'],
                        'end_time': velocities[eccentric_end]['timestamp'],
                        'duration': rep_duration,
                        'avg_velocity': avg_velocity,
                        'concentric_velocity': concentric_avg,
                        'eccentric_velocity': eccentric_avg,
                        'tension_score': tension_score,
                        'start_frame': velocities[concentric_start]['frame'],
                        'end_frame': velocities[eccentric_end]['frame'],
                        'concentric_start': concentric_start,
                        'concentric_end': concentric_end,
                        'eccentric_start': eccentric_start,
                        'eccentric_end': eccentric_end
                    })
                    
                    logger.info(f"Detected rep {len(reps)}: duration={rep_duration:.2f}s, "
                              f"concentric_vel={concentric_avg:.3f}, eccentric_vel={eccentric_avg:.3f}, "
                              f"tension={tension_score:.1f}")
            
            i += 1
        
        logger.info(f"Concentric-eccentric detection found {len(reps)} reps")
        return reps
    
    def _detect_small_rom_reps(self, velocities: List[Dict], velocity_threshold: float, 
                              min_rep_duration: float, min_rest_duration: float) -> List[Dict]:
        """
        Detect smaller range of motion reps (fatigue reps) using more sensitive parameters
        These typically occur toward the end of a set when ROM decreases due to fatigue
        """
        logger.info("Using small ROM rep detection for fatigue reps")
        
        reps = []
        i = 0
        
        while i < len(velocities) - 10:  # Need enough frames for pattern detection
            # Look for small concentric-eccentric patterns (like primary but more sensitive)
            concentric_start = None
            concentric_end = None
            
            # Find small concentric phase (pulling down - very sensitive threshold)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] > velocity_threshold * 0.4:  # More sensitive than primary
                    concentric_start = i
                    break
                i += 1
            
            if concentric_start is None:
                i += 1
                continue
            
            # Find end of small concentric phase
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] < velocity_threshold * 0.3:  # Lower threshold
                    concentric_end = i
                    break
                i += 1
            
            if concentric_end is None:
                i += 1
                continue
            
            # Look for small eccentric phase (releasing up)
            eccentric_start = None
            eccentric_end = None
            
            # Find small eccentric phase
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] < velocity_threshold * 0.4:  # More sensitive
                    eccentric_start = i
                    break
                i += 1
            
            if eccentric_start is None:
                i += 1
                continue
            
            # Find end of small eccentric phase (shorter duration)
            while i < len(velocities) - 5:
                if velocities[i]['velocity'] > velocity_threshold * 0.3 or i - eccentric_start > 8:  # Max 8 frames for small ROM
                    eccentric_end = i
                    break
                i += 1
            
            if eccentric_end is None:
                eccentric_end = min(i + 5, len(velocities) - 1)
            
            # Check if we have a complete small ROM pattern
            if (concentric_start is not None and concentric_end is not None and 
                eccentric_start is not None and eccentric_end is not None):
                
                # Calculate rep duration
                rep_duration = velocities[eccentric_end]['timestamp'] - velocities[concentric_start]['timestamp']
                
                # For small ROM reps, they should be shorter than primary reps
                if min_rep_duration <= rep_duration <= min_rep_duration * 3:  # Reasonable duration range
                    # Extract velocity data for the entire rep
                    rep_velocities = velocities[concentric_start:eccentric_end+1]
                    
                    # Calculate average velocity
                    avg_velocity = sum(v['velocity'] for v in rep_velocities) / len(rep_velocities)
                    
                    # Calculate concentric vs eccentric velocity
                    concentric_velocities = [v['velocity'] for v in rep_velocities[:concentric_end-concentric_start+1]]
                    eccentric_velocities = [v['velocity'] for v in rep_velocities[concentric_end-concentric_start+1:]]
                    
                    concentric_avg = sum(concentric_velocities) / len(concentric_velocities) if concentric_velocities else 0
                    eccentric_avg = sum(eccentric_velocities) / len(eccentric_velocities) if eccentric_velocities else 0
                    
                    # Calculate tension rating (small ROM reps typically have higher tension)
                    tension_score = max(0, 100 - (avg_velocity * 40))  # More sensitive scaling
                    
                    reps.append({
                        'start_time': velocities[concentric_start]['timestamp'],
                        'end_time': velocities[eccentric_end]['timestamp'],
                        'duration': rep_duration,
                        'avg_velocity': avg_velocity,
                        'concentric_velocity': concentric_avg,
                        'eccentric_velocity': eccentric_avg,
                        'tension_score': tension_score,
                        'start_frame': velocities[concentric_start]['frame'],
                        'end_frame': velocities[eccentric_end]['frame'],
                        'rep_type': 'small_rom'  # Mark as small ROM rep
                    })
                    
                    logger.info(f"Detected small ROM rep {len(reps)}: duration={rep_duration:.2f}s, "
                              f"concentric_vel={concentric_avg:.3f}, eccentric_vel={eccentric_avg:.3f}, "
                              f"tension={tension_score:.1f}")
            
            i += 1
        
        logger.info(f"Small ROM detection found {len(reps)} reps")
        return reps
    
    def _combine_rep_detections(self, primary_reps: List[Dict], secondary_reps: List[Dict]) -> List[Dict]:
        """
        Combine primary and secondary rep detections, removing duplicates
        Primary reps take precedence over secondary reps when they overlap
        """
        logger.info(f"Combining {len(primary_reps)} primary reps with {len(secondary_reps)} secondary reps")
        
        combined_reps = []
        used_time_ranges = set()
        
        # Add all primary reps first (they take precedence)
        for rep in primary_reps:
            start_time = rep['start_time']
            end_time = rep['end_time']
            
            # Create a time range identifier
            time_range = (round(start_time, 1), round(end_time, 1))
            used_time_ranges.add(time_range)
            
            # Mark as primary rep
            rep['rep_type'] = 'primary'
            combined_reps.append(rep)
        
        # Add secondary reps that don't overlap with primary reps
        for rep in secondary_reps:
            start_time = rep['start_time']
            end_time = rep['end_time']
            
            # Check for overlap with existing reps
            overlaps = False
            for used_start, used_end in used_time_ranges:
                # Check if this rep overlaps with any existing rep
                if (start_time <= used_end and end_time >= used_start):
                    overlaps = True
                    break
            
            if not overlaps:
                # Add this secondary rep
                time_range = (round(start_time, 1), round(end_time, 1))
                used_time_ranges.add(time_range)
                combined_reps.append(rep)
            else:
                logger.info(f"Skipping overlapping secondary rep: {start_time:.2f}s - {end_time:.2f}s")
        
        # Sort combined reps by start time
        combined_reps.sort(key=lambda x: x['start_time'])
        
        # Filter out very short reps (likely noise)
        filtered_reps = []
        for rep in combined_reps:
            if rep['duration'] >= 0.4:  # Minimum 0.4 seconds for a valid rep
                filtered_reps.append(rep)
            else:
                logger.info(f"Filtered out short rep: {rep['duration']:.2f}s")
        
        logger.info(f"Combined detection result: {len(filtered_reps)} total reps (filtered from {len(combined_reps)})")
        return filtered_reps
    
    def _split_combined_reps(self, reps: List[Dict], velocities: List[Dict]) -> List[Dict]:
        """
        Split combined reps that are too long into individual reps
        Looks for velocity valleys between movements
        """
        logger.info(f"Splitting {len(reps)} potentially combined reps")
        
        split_reps = []
        
        for rep in reps:
            # If rep is longer than 6 seconds, it might be combined
            if rep['duration'] > 6.0:
                logger.info(f"Splitting long rep: {rep['duration']:.2f}s")
                
                # Find velocity valleys within this rep
                start_frame = rep['start_frame']
                end_frame = rep['end_frame']
                
                # Extract velocities for this rep
                rep_velocities = [v for v in velocities if start_frame <= v['frame'] <= end_frame]
                
                if len(rep_velocities) < 20:  # Need enough data points
                    split_reps.append(rep)
                    continue
                
                # Find valleys (local minima) in velocity
                valleys = []
                for i in range(5, len(rep_velocities) - 5):
                    current_vel = rep_velocities[i]['velocity']
                    # Check if this is a local minimum
                    is_valley = True
                    for j in range(i-3, i+4):
                        if j != i and j >= 0 and j < len(rep_velocities):
                            if rep_velocities[j]['velocity'] < current_vel:
                                is_valley = False
                                break
                    
                    if is_valley and current_vel < 0.1:  # Low velocity threshold
                        valleys.append(i)
                
                # Split the rep at valleys
                if len(valleys) > 0:
                    logger.info(f"Found {len(valleys)} valleys in long rep")
                    
                    # Create splits
                    split_points = [0] + valleys + [len(rep_velocities) - 1]
                    
                    for i in range(len(split_points) - 1):
                        start_idx = split_points[i]
                        end_idx = split_points[i + 1]
                        
                        if end_idx - start_idx > 5:  # Minimum frames for a rep
                            split_rep = {
                                'start_time': rep_velocities[start_idx]['timestamp'],
                                'end_time': rep_velocities[end_idx]['timestamp'],
                                'duration': rep_velocities[end_idx]['timestamp'] - rep_velocities[start_idx]['timestamp'],
                                'avg_velocity': sum(v['velocity'] for v in rep_velocities[start_idx:end_idx+1]) / (end_idx - start_idx + 1),
                                'tension_score': rep['tension_score'],  # Keep original tension
                                'start_frame': rep_velocities[start_idx]['frame'],
                                'end_frame': rep_velocities[end_idx]['frame'],
                                'rep_type': 'split'
                            }
                            split_reps.append(split_rep)
                else:
                    split_reps.append(rep)
            else:
                split_reps.append(rep)
        
        logger.info(f"Split detection result: {len(split_reps)} total reps")
        return split_reps
    
    def _is_significant_movement(self, rep_velocities: List[Dict]) -> bool:
        """
        Check if a detected movement is significant enough to be a real rep
        
        Args:
            rep_velocities: Velocity data for the potential rep
            
        Returns:
            True if movement is significant enough
        """
        if not rep_velocities:
            return False
        
        velocities = [v['velocity'] for v in rep_velocities]
        
        # Check for sufficient velocity range (movement should have clear peaks and valleys)
        velocity_range = max(velocities) - min(velocities)
        if velocity_range < 0.03:  # Lowered threshold for shoulder movements
            return False
        
        # Check for proper movement pattern (should have acceleration and deceleration)
        if len(velocities) < 3:
            return False
        
        # Look for velocity pattern: start low, peak, end low
        mid_point = len(velocities) // 2
        start_avg = np.mean(velocities[:mid_point//2]) if mid_point > 2 else velocities[0]
        peak_avg = np.mean(velocities[mid_point//2:mid_point + mid_point//2]) if mid_point > 2 else np.mean(velocities)
        end_avg = np.mean(velocities[mid_point + mid_point//2:]) if mid_point > 2 else velocities[-1]
        
        # Should have a clear peak in the middle
        if peak_avg <= start_avg or peak_avg <= end_avg:
            return False
        
        return True
    
    def detect_exercise_type(self, velocities: List[Dict], joint_name: str) -> str:
        """
        Detect the type of exercise based on movement patterns
        
        Args:
            velocities: List of velocity data points
            joint_name: Joint being tracked
            
        Returns:
            Detected exercise type
        """
        if not velocities:
            return 'default'
        
        # Analyze movement characteristics
        vel_values = [v['velocity'] for v in velocities]
        avg_velocity = np.mean(vel_values)
        max_velocity = np.max(vel_values)
        velocity_std = np.std(vel_values)
        
        # Duration analysis
        total_duration = velocities[-1]['timestamp'] - velocities[0]['timestamp']
        avg_rep_duration = total_duration / max(1, len(velocities) // 30)  # Rough estimate
        
        # Exercise-specific detection logic
        if joint_name in ['wrist', 'elbow'] and avg_velocity < 0.1 and avg_rep_duration > 2.0:
            return 'lat_pulldown'
        elif joint_name in ['wrist', 'elbow'] and avg_velocity > 0.15 and avg_rep_duration < 1.5:
            return 'bicep_curl'
        elif joint_name in ['shoulder', 'elbow'] and avg_velocity > 0.2:
            return 'pull_up'
        else:
            return 'default'
    
    def calculate_rep_tension_score(self, rep_data: Dict) -> float:
        """
        Calculate tension score for a single rep based on velocity profile
        
        Lower average velocity = higher tension (force-velocity relationship)
        
        Args:
            rep_data: Dictionary containing rep metrics
            
        Returns:
            Tension score (0-100)
        """
        avg_velocity = rep_data['avg_velocity']
        max_velocity = rep_data['max_velocity']
        duration = rep_data['duration']
        
        # Inverse relationship: slower movement = higher tension
        # Normalize velocity (typical range 0.1 - 1.0 units/sec)
        velocity_score = max(0, 100 - (avg_velocity * 100))
        
        # Bonus for controlled movement (low max velocity)
        control_score = max(0, 100 - (max_velocity * 80))
        
        # Bonus for longer duration (time under tension)
        duration_score = min(100, duration * 20)  # 5 seconds = 100 points
        
        # Weighted combination
        tension_score = (
            velocity_score * 0.5 +  # 50% weight on average velocity
            control_score * 0.3 +   # 30% weight on control
            duration_score * 0.2    # 20% weight on duration
        )
        
        return min(100, max(0, tension_score))
    
    def calculate_overall_tension_rating(self, reps: List[Dict]) -> float:
        """
        Calculate overall tension rating from all reps
        Uses concentric-eccentric analysis for lat pulldowns
        
        Args:
            reps: List of rep data dictionaries
            
        Returns:
            Overall tension rating (0-100)
        """
        if not reps:
            return 0.0
        
        # Check if we have concentric-eccentric data (new method)
        if 'tension_score' in reps[0]:
            # Use the new tension scoring method
            tension_scores = [rep['tension_score'] for rep in reps]
            avg_tension = sum(tension_scores) / len(tension_scores)
            
            # Calculate velocity decay (slower reps toward failure = higher tension)
            if len(reps) > 1:
                first_half = reps[:len(reps)//2]
                second_half = reps[len(reps)//2:]
                
                first_avg_vel = sum(rep['avg_velocity'] for rep in first_half) / len(first_half)
                second_avg_vel = sum(rep['avg_velocity'] for rep in second_half) / len(second_half)
                
                # Calculate velocity decay factor
                velocity_decay = (first_avg_vel - second_avg_vel) / first_avg_vel if first_avg_vel > 0 else 0
                decay_bonus = min(20, velocity_decay * 50)  # Up to 20 point bonus for velocity decay
                
                return min(100, avg_tension + decay_bonus)
            else:
                return avg_tension
        
        # Fallback to old method for other exercises
        rep_scores = [self.calculate_rep_tension_score(rep) for rep in reps]
        weights = np.linspace(0.8, 1.2, len(rep_scores))
        weighted_score = np.average(rep_scores, weights=weights)
        
        return round(weighted_score, 1)

