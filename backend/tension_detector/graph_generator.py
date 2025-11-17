"""
Graph Generator Module
Creates force-velocity graphs for visualization
"""

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
from typing import List, Dict
import io
import base64
import logging

logger = logging.getLogger(__name__)


class GraphGenerator:
    """
    Generates force-velocity graphs and other visualizations
    """
    
    def __init__(self):
        """Initialize graph generator with styling"""
        plt.style.use('dark_background')
        self.colors = {
            'primary': '#667eea',
            'secondary': '#764ba2',
            'accent': '#4CAF50',
            'warning': '#FFC107',
            'danger': '#F44336'
        }
    
    def generate_force_velocity_graph(self, reps: List[Dict]) -> str:
        """
        Generate force-velocity graph from rep data
        
        Args:
            reps: List of rep data dictionaries
            
        Returns:
            Base64 encoded PNG image
        """
        if not reps:
            return self._generate_empty_graph()
        
        fig, ax = plt.subplots(figsize=(10, 6), facecolor='#1a1a1a')
        ax.set_facecolor('#1a1a1a')
        
        # Extract data
        velocities = [rep['avg_velocity'] for rep in reps]
        # Estimate force (inverse relationship with velocity)
        forces = [100 - (v * 80) for v in velocities]  # Normalized force
        
        # Create scatter plot
        scatter = ax.scatter(velocities, forces, 
                           c=range(len(reps)), 
                           cmap='viridis',
                           s=200, 
                           alpha=0.7,
                           edgecolors='white',
                           linewidth=2)
        
        # Add rep numbers as labels
        for i, (v, f) in enumerate(zip(velocities, forces)):
            ax.annotate(f'Rep {i+1}', 
                       (v, f), 
                       xytext=(5, 5), 
                       textcoords='offset points',
                       fontsize=10,
                       color='white',
                       weight='bold')
        
        # Fit a curve (hyperbolic relationship)
        if len(velocities) > 2:
            v_range = np.linspace(min(velocities), max(velocities), 100)
            # Simple inverse relationship
            z = np.polyfit(velocities, forces, 2)
            p = np.poly1d(z)
            ax.plot(v_range, p(v_range), 
                   color=self.colors['primary'], 
                   linestyle='--', 
                   linewidth=2,
                   alpha=0.5,
                   label='Force-Velocity Curve')
        
        # Styling
        ax.set_xlabel('Velocity (units/sec)', fontsize=12, color='white', weight='bold')
        ax.set_ylabel('Estimated Force (normalized)', fontsize=12, color='white', weight='bold')
        ax.set_title('Force-Velocity Profile', fontsize=16, color='white', weight='bold', pad=20)
        ax.grid(True, alpha=0.2, linestyle='--')
        ax.legend(loc='upper right', fontsize=10)
        
        # Add colorbar
        cbar = plt.colorbar(scatter, ax=ax)
        cbar.set_label('Rep Sequence', rotation=270, labelpad=20, color='white')
        cbar.ax.yaxis.set_tick_params(color='white')
        plt.setp(plt.getp(cbar.ax.axes, 'yticklabels'), color='white')
        
        # Set tick colors
        ax.tick_params(colors='white')
        
        # Convert to base64
        return self._fig_to_base64(fig)
    
    def generate_velocity_timeline(self, velocities: List[Dict]) -> str:
        """
        Generate velocity over time graph
        
        Args:
            velocities: List of velocity data points
            
        Returns:
            Base64 encoded PNG image
        """
        if not velocities:
            return self._generate_empty_graph()
        
        fig, ax = plt.subplots(figsize=(12, 6), facecolor='#1a1a1a')
        ax.set_facecolor('#1a1a1a')
        
        # Extract data
        timestamps = [v['timestamp'] for v in velocities]
        velocity_values = [v['velocity'] for v in velocities]
        
        # Plot velocity over time
        ax.plot(timestamps, velocity_values, 
               color=self.colors['primary'], 
               linewidth=2,
               label='Joint Velocity')
        
        # Fill under curve
        ax.fill_between(timestamps, velocity_values, 
                       alpha=0.3, 
                       color=self.colors['primary'])
        
        # Styling
        ax.set_xlabel('Time (seconds)', fontsize=12, color='white', weight='bold')
        ax.set_ylabel('Velocity (units/sec)', fontsize=12, color='white', weight='bold')
        ax.set_title('Movement Velocity Timeline', fontsize=16, color='white', weight='bold', pad=20)
        ax.grid(True, alpha=0.2, linestyle='--')
        ax.legend(loc='upper right', fontsize=10)
        ax.tick_params(colors='white')
        
        return self._fig_to_base64(fig)
    
    def generate_rep_comparison(self, reps: List[Dict]) -> str:
        """
        Generate bar chart comparing rep metrics
        
        Args:
            reps: List of rep data dictionaries
            
        Returns:
            Base64 encoded PNG image
        """
        if not reps:
            return self._generate_empty_graph()
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8), facecolor='#1a1a1a')
        
        for ax in [ax1, ax2]:
            ax.set_facecolor('#1a1a1a')
        
        # Generate rep numbers if not present
        for i, rep in enumerate(reps):
            if 'rep_number' not in rep:
                rep['rep_number'] = i + 1
        
        rep_numbers = [rep['rep_number'] for rep in reps]
        avg_velocities = [rep['avg_velocity'] for rep in reps]
        durations = [rep['duration'] for rep in reps]
        
        # Average velocity comparison
        bars1 = ax1.bar(rep_numbers, avg_velocities, 
                       color=self.colors['primary'], 
                       alpha=0.7,
                       edgecolor='white',
                       linewidth=1.5)
        ax1.set_xlabel('Rep Number', fontsize=12, color='white', weight='bold')
        ax1.set_ylabel('Avg Velocity', fontsize=12, color='white', weight='bold')
        ax1.set_title('Average Velocity per Rep', fontsize=14, color='white', weight='bold')
        ax1.grid(True, alpha=0.2, axis='y')
        ax1.tick_params(colors='white')
        
        # Duration comparison
        bars2 = ax2.bar(rep_numbers, durations, 
                       color=self.colors['accent'], 
                       alpha=0.7,
                       edgecolor='white',
                       linewidth=1.5)
        ax2.set_xlabel('Rep Number', fontsize=12, color='white', weight='bold')
        ax2.set_ylabel('Duration (sec)', fontsize=12, color='white', weight='bold')
        ax2.set_title('Time Under Tension per Rep', fontsize=14, color='white', weight='bold')
        ax2.grid(True, alpha=0.2, axis='y')
        ax2.tick_params(colors='white')
        
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _fig_to_base64(self, fig) -> str:
        """
        Convert matplotlib figure to base64 string
        
        Args:
            fig: Matplotlib figure
            
        Returns:
            Base64 encoded PNG image
        """
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight', facecolor='#1a1a1a')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return f"data:image/png;base64,{img_base64}"
    
    def _generate_empty_graph(self) -> str:
        """
        Generate placeholder graph when no data available
        
        Returns:
            Base64 encoded PNG image
        """
        fig, ax = plt.subplots(figsize=(10, 6), facecolor='#1a1a1a')
        ax.set_facecolor('#1a1a1a')
        
        ax.text(0.5, 0.5, 'No Data Available', 
               ha='center', va='center',
               fontsize=20, color='#666',
               transform=ax.transAxes)
        
        ax.set_xticks([])
        ax.set_yticks([])
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_visible(False)
        ax.spines['left'].set_visible(False)
        
        return self._fig_to_base64(fig)

