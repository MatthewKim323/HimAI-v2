/**
 * Tension Visualization Service
 * Handles real-time visualization of MediaPipe pose detection
 */

const API_BASE_URL = 'http://169.231.213.72:8000';

export interface FrameData {
  frame_number: number;
  total_frames: number;
  progress: number;
  frame_image: string; // Base64 encoded JPEG
  pose_detected: boolean;
  velocity?: number;
  rep_count: number;
  tension_score?: number;
  timestamp: number;
  complete?: boolean;
  error?: string;
}

class TensionVisualizationService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Stream real-time analysis (React Native compatible)
   * Uses preview endpoint and displays frames progressively to simulate real-time
   * 
   * @param videoUri - Local video URI from expo-image-picker
   * @param exercise - Exercise type
   * @param jointName - Joint to track (optional)
   * @param side - 'left' or 'right'
   * @param onFrame - Callback for each frame
   * @param onComplete - Callback when complete
   * @param onError - Error callback
   */
  async streamAnalysis(
    videoUri: string,
    exercise: string,
    jointName?: string,
    side: string = 'left',
    onFrame: (frame: FrameData) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Use preview endpoint since React Native doesn't support ReadableStream
      // We'll process frames progressively to simulate real-time
      const formData = new FormData();
      
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'exercise.mp4',
      } as any);
      
      formData.append('exercise', exercise);
      if (jointName) formData.append('joint_name', jointName);
      formData.append('side', side);
      formData.append('sample_rate', '1'); // Get every frame for real-time feel

      console.log('📹 Starting real-time analysis...');
      
      const response = await fetch(`${this.baseUrl}/tension/analyze/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.frames || data.frames.length === 0) {
        throw new Error('No frames received from analysis');
      }

      console.log(`📹 Received ${data.frames.length} frames, displaying progressively...`);

      // Display frames progressively to simulate real-time streaming
      // Calculate delay based on video duration and frame count
      const totalFrames = data.frames.length;
      const lastFrame = data.frames[totalFrames - 1];
      const videoDuration = lastFrame?.timestamp || (totalFrames * 0.033); // Assume 30fps if no timestamp
      const frameDelay = (videoDuration * 1000) / totalFrames; // Delay in ms

      // Display frames with progressive delay
      for (let i = 0; i < data.frames.length; i++) {
        const frame = data.frames[i];
        
        // Call frame callback
        onFrame(frame as FrameData);
        
        // Wait before showing next frame (except for last frame)
        if (i < data.frames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.max(16, frameDelay))); // Min 16ms (60fps)
        }
      }

      console.log('✅ Real-time analysis complete');
      onComplete();
      
    } catch (error) {
      console.error('❌ Real-time analysis error:', error);
      onError(error as Error);
    }
  }

  /**
   * Get preview frames (faster, non-streaming)
   * 
   * @param videoUri - Local video URI
   * @param exercise - Exercise type
   * @param jointName - Joint to track
   * @param side - 'left' or 'right'
   * @param sampleRate - Send every Nth frame (default: 5)
   */
  async getPreviewFrames(
    videoUri: string,
    exercise: string,
    jointName?: string,
    side: string = 'left',
    sampleRate: number = 5
  ): Promise<FrameData[]> {
    try {
      const formData = new FormData();
      
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'exercise.mp4',
      } as any);
      
      formData.append('exercise', exercise);
      if (jointName) formData.append('joint_name', jointName);
      formData.append('side', side);
      formData.append('sample_rate', sampleRate.toString());

      const response = await fetch(`${this.baseUrl}/tension/analyze/preview`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.frames || [];
    } catch (error) {
      console.error('Failed to get preview frames:', error);
      throw error;
    }
  }
}

export const tensionVisualizationService = new TensionVisualizationService();
export default tensionVisualizationService;

