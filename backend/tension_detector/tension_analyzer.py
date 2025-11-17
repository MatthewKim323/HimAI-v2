"""
Tension Analyzer Module
Main module that coordinates pose detection, velocity calculation, and analysis
"""

from typing import Dict, Optional
import logging
from pathlib import Path

from .pose_detector import PoseDetector
from .velocity_calculator import VelocityCalculator
from .graph_generator import GraphGenerator

logger = logging.getLogger(__name__)


class TensionAnalyzer:
    """
    Main class for analyzing mechanical tension from exercise videos
    """
    
    def __init__(self):
        """Initialize all components"""
        self.pose_detector = PoseDetector()
        self.velocity_calculator = VelocityCalculator()
        self.graph_generator = GraphGenerator()
    
    def analyze_video(self, video_path: str, joint_name: str = 'wrist', side: str = 'left', exercise_type: str = 'default') -> Dict:
        """
        Analyze a video and return complete tension analysis
        
        Args:
            video_path: Path to video file
            joint_name: Joint to track ('wrist', 'elbow', 'shoulder', etc.)
            side: 'left' or 'right'
            
        Returns:
            Dictionary containing:
                - tension_rating: Overall tension score (0-100)
                - rep_count: Number of reps detected
                - reps: List of rep data
                - force_velocity_graph: Base64 encoded graph
                - velocity_timeline: Base64 encoded timeline graph
                - rep_comparison: Base64 encoded comparison graph
        """
        logger.info(f"Starting video analysis: {video_path}")
        
        # Step 1: Detect pose in all frames
        logger.info("Step 1: Detecting pose in video frames...")
        pose_data = self.pose_detector.process_video(video_path)
        
        if not pose_data:
            logger.error("No pose data detected in video")
            return self._generate_error_response("No pose detected in video")
        
        logger.info(f"Detected pose in {len(pose_data)} frames")
        
        # Step 2: Calculate joint velocities
        logger.info(f"Step 2: Calculating {joint_name} velocities...")
        velocities = self.velocity_calculator.calculate_joint_velocities(
            pose_data, 
            joint_name=joint_name, 
            side=side
        )
        
        if not velocities:
            logger.error("Could not calculate velocities")
            return self._generate_error_response("Could not track joint movement")
        
        logger.info(f"Calculated {len(velocities)} velocity data points")
        
        # Step 3: Detect repetitions using specified exercise type
        logger.info(f"Step 3: Detecting repetitions for {exercise_type}...")
        reps = self.velocity_calculator.detect_reps(velocities, exercise_type=exercise_type)
        
        if not reps:
            logger.warning("No repetitions detected")
            return self._generate_error_response("No repetitions detected. Try recording a full set.")
        
        logger.info(f"Detected {len(reps)} repetitions")
        
        # Step 4: Calculate tension rating
        logger.info("Step 4: Calculating tension rating...")
        tension_rating = self.velocity_calculator.calculate_overall_tension_rating(reps)
        logger.info(f"Tension rating: {tension_rating}/100")
        
        # Step 5: Generate graphs
        logger.info("Step 5: Generating visualizations...")
        force_velocity_graph = self.graph_generator.generate_force_velocity_graph(reps)
        velocity_timeline = self.graph_generator.generate_velocity_timeline(velocities)
        rep_comparison = self.graph_generator.generate_rep_comparison(reps)
        
        # Step 6: Compile results
        result = {
            'success': True,
            'tension_rating': tension_rating,
            'rep_count': len(reps),
            'reps': reps,
            'force_velocity_graph': force_velocity_graph,
            'velocity_timeline': velocity_timeline,
            'rep_comparison': rep_comparison,
            'analysis_summary': self._generate_summary(tension_rating, reps),
            'recommendations': self._generate_recommendations(tension_rating, reps)
        }
        
        logger.info("Analysis complete!")
        return result
    
    def _generate_summary(self, tension_rating: float, reps: list) -> str:
        """Generate human-readable summary of analysis"""
        avg_duration = sum(r['duration'] for r in reps) / len(reps) if reps else 0
        avg_velocity = sum(r['avg_velocity'] for r in reps) / len(reps) if reps else 0
        
        summary = f"Analyzed {len(reps)} repetitions. "
        summary += f"Average time under tension: {avg_duration:.1f}s per rep. "
        summary += f"Average movement velocity: {avg_velocity:.3f} units/sec. "
        
        if tension_rating >= 80:
            summary += "Excellent mechanical tension! Your controlled tempo is maximizing muscle engagement."
        elif tension_rating >= 60:
            summary += "Good tension, but there's room for improvement. Try slowing down the eccentric phase."
        else:
            summary += "Low tension detected. Focus on slower, more controlled movements to increase time under tension."
        
        return summary
    
    def _generate_recommendations(self, tension_rating: float, reps: list) -> list:
        """Generate actionable recommendations"""
        recommendations = []
        
        if tension_rating < 60:
            recommendations.append("Slow down your repetitions - aim for 3-4 seconds per phase")
            recommendations.append("Focus on the eccentric (lowering) portion of the movement")
        
        if reps:
            avg_duration = sum(r['duration'] for r in reps) / len(reps)
            if avg_duration < 2.0:
                recommendations.append("Increase time under tension - each rep should take at least 2-3 seconds")
            
            # Check for velocity consistency
            velocities = [r['avg_velocity'] for r in reps]
            if len(velocities) > 1:
                velocity_std = (sum((v - sum(velocities)/len(velocities))**2 for v in velocities) / len(velocities)) ** 0.5
                if velocity_std > 0.1:
                    recommendations.append("Try to maintain consistent tempo across all reps")
        
        if not recommendations:
            recommendations.append("Great form! Maintain this tempo and focus on progressive overload")
            recommendations.append("Consider adding a pause at peak contraction for even more tension")
        
        return recommendations
    
    def _generate_error_response(self, error_message: str) -> Dict:
        """Generate error response"""
        return {
            'success': False,
            'error': error_message,
            'tension_rating': 0,
            'rep_count': 0,
            'reps': [],
            'force_velocity_graph': self.graph_generator._generate_empty_graph(),
            'velocity_timeline': None,
            'rep_comparison': None,
            'analysis_summary': error_message,
            'recommendations': ["Please upload a clear video showing the full exercise movement"]
        }
    
    def close(self):
        """Release resources"""
        self.pose_detector.close()

