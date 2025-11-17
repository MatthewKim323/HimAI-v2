# HimAI Tension Detector

AI-powered mechanical tension analysis for resistance training exercises.

## Overview

The Tension Detector uses computer vision and biomechanics principles to analyze exercise videos and provide real-time feedback on mechanical tension - a key factor in muscle growth and strength gains.

## How It Works

### 1. **Pose Detection** (`pose_detector.py`)
- Uses MediaPipe Pose to detect 33 body landmarks in real-time
- Tracks key joints: shoulders, elbows, wrists, hips, knees, ankles
- Processes video frame-by-frame with high accuracy

### 2. **Velocity Calculation** (`velocity_calculator.py`)
- Calculates 3D joint velocities between frames
- Detects repetitions based on velocity patterns
- Applies force-velocity relationship: slower movement = higher tension

### 3. **Tension Analysis** (`tension_analyzer.py`)
- Calculates per-rep tension scores (0-100%)
- Weights later reps more heavily (fatigue = higher tension)
- Provides actionable recommendations

### 4. **Visualization** (`graph_generator.py`)
- Force-velocity profile graphs
- Velocity timeline charts
- Rep-by-rep comparison bars

## Force-Velocity Relationship

The tension detector is based on the fundamental biomechanics principle:

```
Force ∝ 1/Velocity
```

**Slower movements = Higher force = Greater mechanical tension**

This relationship is why:
- Controlled eccentric phases build more muscle
- Explosive movements develop power but less hypertrophy
- Time under tension is crucial for muscle growth

## Tension Rating Formula

```python
tension_score = (
    velocity_score * 0.5 +    # 50% weight on average velocity
    control_score * 0.3 +      # 30% weight on movement control
    duration_score * 0.2       # 20% weight on time under tension
)
```

Where:
- `velocity_score = 100 - (avg_velocity * 100)`
- `control_score = 100 - (max_velocity * 80)`
- `duration_score = min(100, duration * 20)`

## API Endpoints

### Analyze Video
```
POST /tension/analyze
Content-Type: multipart/form-data

Parameters:
  - file: Video file (MP4, MOV, WEBM)
  - joint_name: Joint to track (default: "wrist")
  - side: "left" or "right" (default: "left")

Response:
{
  "success": true,
  "tension_rating": 85.3,
  "rep_count": 10,
  "reps": [...],
  "force_velocity_graph": "data:image/png;base64,...",
  "velocity_timeline": "data:image/png;base64,...",
  "rep_comparison": "data:image/png;base64,...",
  "analysis_summary": "...",
  "recommendations": [...]
}
```

### Health Check
```
GET /tension/health

Response:
{
  "status": "healthy",
  "service": "tension_detector"
}
```

### Supported Joints
```
GET /tension/supported-joints

Response:
{
  "joints": [
    {"name": "wrist", "description": "..."},
    {"name": "elbow", "description": "..."},
    ...
  ],
  "sides": ["left", "right"]
}
```

## Supported Exercises

### Push Exercises
- Bench Press (track: wrist)
- Overhead Press (track: wrist)
- Push-ups (track: wrist)

### Pull Exercises
- Pull-ups (track: wrist)
- Rows (track: wrist/elbow)
- Lat Pulldowns (track: wrist)

### Lower Body
- Squats (track: hip/knee)
- Lunges (track: knee)
- Deadlifts (track: hip)

## Technical Details

### Dependencies
- **MediaPipe**: Pose detection and landmark tracking
- **OpenCV**: Video processing and frame extraction
- **NumPy**: Numerical computations
- **Matplotlib**: Graph generation

### Performance
- Processing speed: ~30 FPS on modern hardware
- Accuracy: 95%+ landmark detection in good lighting
- Video length: Up to 60 seconds recommended

### Limitations
- Requires clear view of the tracked joint
- Best results with good lighting and minimal background clutter
- Single-person videos only
- Side or front view recommended

## Example Usage

```python
from tension_detector.tension_analyzer import TensionAnalyzer

# Initialize analyzer
analyzer = TensionAnalyzer()

# Analyze video
result = analyzer.analyze_video(
    video_path="bench_press.mp4",
    joint_name="wrist",
    side="right"
)

print(f"Tension Rating: {result['tension_rating']}/100")
print(f"Reps Detected: {result['rep_count']}")
print(f"Summary: {result['analysis_summary']}")

# Clean up
analyzer.close()
```

## Future Enhancements

- [ ] Real-time video streaming analysis
- [ ] Multi-joint tracking for compound movements
- [ ] Exercise classification (auto-detect exercise type)
- [ ] Form correction suggestions
- [ ] Progressive overload tracking
- [ ] Comparison with optimal movement patterns

## References

1. Schoenfeld, B. J. (2010). The mechanisms of muscle hypertrophy and their application to resistance training. *Journal of Strength and Conditioning Research*, 24(10), 2857-2872.

2. Suchomel, T. J., et al. (2018). The importance of muscular strength: training considerations. *Sports Medicine*, 48(4), 765-785.

3. Kraemer, W. J., & Ratamess, N. A. (2004). Fundamentals of resistance training: progression and exercise prescription. *Medicine & Science in Sports & Exercise*, 36(4), 674-688.

