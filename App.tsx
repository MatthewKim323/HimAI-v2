import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Dimensions, TextInput, PanResponder, Animated, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import foodService, { FoodServiceResponse } from './services/foodService';
import { FoodItem, FoodRecommendationResponse } from './services/api';
import tensionVisualizationService, { FrameData } from './services/tensionVisualizationService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [vitalityPercentage] = useState(78); // Example vitality percentage
  
  // Food menu states
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('Most Recent');
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]); // Load all foods from API
  const [showFoodDropdown, setShowFoodDropdown] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [showFoodDetails, setShowFoodDetails] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [filteredFoods, setFilteredFoods] = useState<FoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [usingBackend, setUsingBackend] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Food recommendations states
  const [foodRecommendations, setFoodRecommendations] = useState<FoodRecommendationResponse | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationsAvailable, setRecommendationsAvailable] = useState(false);
  const [userCalorieGoal, setUserCalorieGoal] = useState(2500);
  const [userProteinGoal, setUserProteinGoal] = useState(150);
  const [userDietType, setUserDietType] = useState('balanced');

  // Day tracking states
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [showViewDayModal, setShowViewDayModal] = useState(false);
  const [dayNutrients, setDayNutrients] = useState<any>({});
  const [dayCalories, setDayCalories] = useState(0);
  const [dayFoods, setDayFoods] = useState<any[]>([]);
  const [selectedFoodForAdd, setSelectedFoodForAdd] = useState<FoodItem | null>(null);
  const [gramInput, setGramInput] = useState('');

  // Tension Detector states
  const [showTensionDetector, setShowTensionDetector] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<any>(null);
  const [tensionRating, setTensionRating] = useState<number | null>(null);
  const [forceVelocityGraph, setForceVelocityGraph] = useState<string | null>(null);
  const [velocityTimeline, setVelocityTimeline] = useState<string | null>(null);
  const [repComparison, setRepComparison] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState('lat_pulldown');
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  
  // Real-time visualization states
  const [showRealTimeVisualization, setShowRealTimeVisualization] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const [visualizationProgress, setVisualizationProgress] = useState(0);
  const [realTimeRepCount, setRealTimeRepCount] = useState(0);
  const [realTimeVelocity, setRealTimeVelocity] = useState<number | null>(null);
  const [realTimeTension, setRealTimeTension] = useState<number | null>(null);

  // Load available exercises
  const loadExercises = async () => {
    try {
      const response = await fetch('http://169.231.213.72:8000/tension/exercises');
      if (response.ok) {
        const data = await response.json();
        setAvailableExercises(data.exercises);
      }
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
  };

  // Video upload functions
  const pickVideo = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required', 
          'Please grant access to your photo library to select videos. You can enable this in Settings > HimAI > Photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // On iOS, this will open the app settings
              // On Android, it will open system settings
            }}
          ]
        );
        return;
      }

      // Launch image picker for videos
      // For expo-image-picker v17, use MediaTypeOptions if available, otherwise use string
      const mediaType = ImagePicker.MediaTypeOptions?.Videos || 'videos';
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60, // 60 seconds max
        allowsMultipleSelection: false,
        videoQuality: ImagePicker.VideoQuality?.Medium || 0.5,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const video = result.assets[0];
        
        // Validate video was selected
        if (!video.uri) {
          Alert.alert('Error', 'No video URI found. Please try selecting the video again.');
          return;
        }

        setUploadedVideo({
          uri: video.uri,
          name: video.fileName || video.uri.split('/').pop() || 'exercise_video.mp4',
          type: video.mimeType || 'video/mp4',
          size: video.fileSize || 0,
        });
        setUploadProgress(0);
        console.log('✅ Video selected:', video.fileName || video.uri);
      } else if (result.canceled) {
        console.log('Video selection cancelled by user');
      }
    } catch (error: any) {
      console.error('Error picking video:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to select video. Please try again.';
      
      if (error.code === 'PHPhotosErrorDomain' || error.message?.includes('3164')) {
        errorMessage = 'Photo library access error. Please check your privacy settings and try again.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      Alert.alert('Video Selection Error', errorMessage, [
        { text: 'OK' },
        { 
          text: 'Try Document Picker', 
          onPress: async () => {
            // Fallback to document picker
            try {
              const docResult = await DocumentPicker.getDocumentAsync({
                type: 'video/*',
                copyToCacheDirectory: true,
              });
              
              if (!docResult.canceled && docResult.assets[0]) {
                const video = docResult.assets[0];
                setUploadedVideo({
                  uri: video.uri,
                  name: video.name || 'exercise_video.mp4',
                  type: video.mimeType || 'video/mp4',
                  size: video.size || 0,
                });
                setUploadProgress(0);
                console.log('✅ Video selected via document picker:', video.name);
              }
            } catch (docError) {
              console.error('Document picker error:', docError);
              Alert.alert('Error', 'Failed to select video using document picker.');
            }
          }
        }
      ]);
    }
  };

  const uploadVideo = async (useRealTime: boolean = false) => {
    if (!uploadedVideo) {
      Alert.alert('No Video', 'Please select a video first.');
      return;
    }

    // If real-time visualization requested
    if (useRealTime) {
      setShowRealTimeVisualization(true);
      setIsAnalyzing(true);
      setCurrentFrame(null);
      setVisualizationProgress(0);
      setRealTimeRepCount(0);
      setRealTimeVelocity(null);
      setRealTimeTension(null);

      try {
        await tensionVisualizationService.streamAnalysis(
          uploadedVideo.uri,
          selectedExercise,
          undefined, // joint_name - auto-selected
          'left',
          (frame: FrameData) => {
            // Update UI with each frame
            setCurrentFrame(`data:image/jpeg;base64,${frame.frame_image}`);
            setVisualizationProgress(frame.progress);
            setRealTimeRepCount(frame.rep_count);
            setRealTimeVelocity(frame.velocity || null);
            setRealTimeTension(frame.tension_score || null);
          },
          async () => {
            // On complete, get final results
            setIsAnalyzing(false);
            setShowRealTimeVisualization(false);
            
            // Get final analysis results
            const formData = new FormData();
            formData.append('file', {
              uri: uploadedVideo.uri,
              type: uploadedVideo.type,
              name: uploadedVideo.name,
            } as any);
            formData.append('exercise', selectedExercise);
            formData.append('side', 'left');

            const response = await fetch('http://169.231.213.72:8000/tension/analyze', {
              method: 'POST',
              body: formData,
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                setAnalysisResults(result);
                setTensionRating(result.tension_rating);
                setForceVelocityGraph(result.force_velocity_graph);
                setVelocityTimeline(result.velocity_timeline);
                setRepComparison(result.rep_comparison);
              }
            }
          },
          (error: Error) => {
            console.error('Streaming error:', error);
            Alert.alert('Analysis Error', error.message);
            setIsAnalyzing(false);
            setShowRealTimeVisualization(false);
          }
        );
      } catch (error) {
        console.error('Failed to start streaming:', error);
        Alert.alert('Error', 'Failed to start real-time analysis');
        setIsAnalyzing(false);
        setShowRealTimeVisualization(false);
      }
      return;
    }

    // Standard analysis (non-real-time)
    setIsAnalyzing(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uploadedVideo.uri,
        type: uploadedVideo.type,
        name: uploadedVideo.name,
      } as any);
      formData.append('exercise', selectedExercise);
      formData.append('side', 'left');

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('http://169.231.213.72:8000/tension/analyze', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let fetch handle it automatically for FormData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setAnalysisResults(result);
        setTensionRating(result.tension_rating);
        setForceVelocityGraph(result.force_velocity_graph);
        setVelocityTimeline(result.velocity_timeline);
        setRepComparison(result.rep_comparison);
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', 'Failed to analyze video. Please check your connection and try again.');
    } finally {
      setIsAnalyzing(false);
      setUploadProgress(0);
    }
  };

  // Sharing functionality
  const shareResults = async () => {
    if (!analysisResults) {
      Alert.alert('No Results', 'No analysis results to share.');
      return;
    }

    try {
      const shareText = `🎯 HimAI Tension Analysis Results\n\n` +
        `Tension Rating: ${analysisResults.tension_rating}/100\n` +
        `Reps Detected: ${analysisResults.rep_count}\n` +
        `Analysis: ${analysisResults.analysis_summary}\n\n` +
        `Recommendations:\n${analysisResults.recommendations?.map((rec: string) => `• ${rec}`).join('\n') || 'None'}\n\n` +
        `Analyzed with HimAI Tension Detector`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareText, {
          mimeType: 'text/plain',
          dialogTitle: 'Share Tension Analysis Results',
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert('Share Failed', 'Failed to share results. Please try again.');
    }
  };

  // Load foods on app startup
  useEffect(() => {
    const loadFoods = async () => {
      try {
        setIsSearching(true);
        const foods = await foodService.getAllFoods();
        setRecentFoods(foods);
        setUsingBackend(foodService.getServiceStatus().using_backend);
        console.log(`🍽️ Loaded ${foods.length} foods from ${foodService.getServiceStatus().using_backend ? 'Python backend' : 'local JSON'}`);
      } catch (error) {
        console.error('Failed to load foods:', error);
        Alert.alert('Error', 'Failed to load food data. Please check your connection.');
      } finally {
        setIsSearching(false);
      }
    };

    loadFoods();
  }, []);

  // Load food recommendations
  const loadRecommendations = async () => {
    try {
      setIsLoadingRecommendations(true);
      
      // Check if recommendation system is available
      const available = await foodService.checkRecommendationAvailability();
      setRecommendationsAvailable(available);
      
      if (!available) {
        console.log('🍽️ Recommendation system not available (model not trained)');
        return;
      }
      
      // Calculate recent averages from meal history
      const recentMeals = mealHistory.slice(-7); // Last 7 days
      const recentCalories = recentMeals.length > 0
        ? recentMeals.reduce((sum, meal) => sum + (meal.calories || 0), 0) / recentMeals.length
        : 0;
      const recentProtein = recentMeals.length > 0
        ? recentMeals.reduce((sum, meal) => sum + (meal.protein || 0), 0) / recentMeals.length
        : 0;
      
      // Get recommendations (using user ID 1 for now, can be replaced with actual user ID)
      const recommendations = await foodService.getRecommendations(
        1, // user_id
        userCalorieGoal,
        userProteinGoal,
        recentCalories,
        recentProtein,
        userDietType,
        10, // limit
        selectedCategory !== 'All' ? selectedCategory : undefined
      );
      
      if (recommendations) {
        setFoodRecommendations(recommendations);
        console.log(`🍽️ Loaded ${recommendations.recommendations.length} recommendations`);
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // Load recommendations when food tab is active and backend is available
  useEffect(() => {
    if (activeTab === 'food' && usingBackend && !foodRecommendations) {
      loadRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, usingBackend]);

  // Efficient food filtering with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      
      try {
        // Use the food service for search (handles both backend and local data)
        const response = await foodService.searchFoods(
          foodSearchQuery.trim() || undefined,
          selectedSort,
          500,
          selectedCategory !== 'All' ? selectedCategory : undefined
        );
        
        setFilteredFoods(response.foods);
        setUsingBackend(response.using_backend);
      } catch (error) {
        console.error('Search failed:', error);
        // Fallback to local filtering if API fails
        let filtered = recentFoods;
        
        if (foodSearchQuery.trim()) {
          const query = foodSearchQuery.toLowerCase();
          filtered = filtered.filter((food: FoodItem) => 
            food.name.toLowerCase().includes(query)
          );
        }
        
        // Apply sorting
        switch (selectedSort) {
          case 'A to Z':
            filtered = filtered.sort((a: FoodItem, b: FoodItem) => a.name.localeCompare(b.name));
            break;
          case 'Z to A':
            filtered = filtered.sort((a: FoodItem, b: FoodItem) => b.name.localeCompare(a.name));
            break;
          case 'Most Frequent':
          case 'Most Recent':
          default:
            filtered = filtered.sort((a: FoodItem, b: FoodItem) => 
              (b.nutrient_density_score || 0) - (a.nutrient_density_score || 0)
            );
            break;
        }
        
        setFilteredFoods(filtered.slice(0, 500));
        setUsingBackend(false);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Slightly longer debounce for API calls

    return () => clearTimeout(timeoutId);
  }, [foodSearchQuery, selectedSort, selectedCategory, recentFoods]);

  // Helper function to safely get nutrient value
  const getNutrientValue = (food: FoodItem, nutrientName: string): number | null => {
    return (food as any)[nutrientName] || null;
  };

  // Helper function to safely get daily value percentage
  const getDailyValuePercentage = (food: FoodItem, nutrientName: string): number | null => {
    return food.dailyValuePercentages?.[nutrientName] || null;
  };

  // Function to parse food name and cooking method
  const parseFoodName = (foodName: string) => {
    const cookingMethods = ['baked', 'fried', 'grilled', 'roasted', 'steamed', 'boiled', 'raw', 'cooked', 'sautéed', 'braised'];
    const lowerName = foodName.toLowerCase();
    
    for (const method of cookingMethods) {
      if (lowerName.includes(`, ${method}`)) {
        const parts = foodName.split(`, ${method}`);
        return {
          mainFood: parts[0].trim(),
          cookingMethod: method.charAt(0).toUpperCase() + method.slice(1)
        };
      }
    }
    
    return {
      mainFood: foodName,
      cookingMethod: null
    };
  };

  // Function to get nutrient color based on nutrient type
  const getNutrientColor = (nutrientName: string) => {
    const lowerName = nutrientName.toLowerCase();
    
    // Vitamins
    if (lowerName.includes('vitamin c') || lowerName.includes('ascorbic acid')) return '#FF6B6B';
    if (lowerName.includes('vitamin a')) return '#FFB347';
    if (lowerName.includes('vitamin d')) return '#FFD93D';
    if (lowerName.includes('vitamin e')) return '#6BCF7F';
    if (lowerName.includes('vitamin k')) return '#4ECDC4';
    if (lowerName.includes('thiamin') || lowerName.includes('riboflavin') || lowerName.includes('niacin') || lowerName.includes('folate') || lowerName.includes('b-12')) return '#A8E6CF';
    
    // Minerals
    if (lowerName.includes('calcium')) return '#FFB6C1';
    if (lowerName.includes('iron')) return '#FFA07A';
    if (lowerName.includes('magnesium')) return '#98FB98';
    if (lowerName.includes('phosphorus')) return '#F0E68C';
    if (lowerName.includes('potassium')) return '#DDA0DD';
    if (lowerName.includes('zinc')) return '#B0C4DE';
    if (lowerName.includes('selenium')) return '#F5DEB3';
    
    // Macronutrients
    if (lowerName.includes('protein')) return '#4CAF50';
    if (lowerName.includes('fat') || lowerName.includes('lipid')) return '#FF9800';
    if (lowerName.includes('carbohydrate')) return '#2196F3';
    if (lowerName.includes('fiber')) return '#9C27B0';
    if (lowerName.includes('energy') || lowerName.includes('calorie')) return '#667eea';
    
    // Other
    if (lowerName.includes('water')) return '#87CEEB';
    if (lowerName.includes('cholesterol')) return '#FF5722';
    if (lowerName.includes('sodium')) return '#795548';
    
    return '#666666'; // Default color
  };

  // Lifts menu states
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [selectedExerciseCategory, setSelectedExerciseCategory] = useState('All');
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedTargetMuscle, setSelectedTargetMuscle] = useState('All');
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [showMuscleDropdown, setShowMuscleDropdown] = useState(false);
  const [exercises] = useState([
  {
    id: 1,
    name: 'Neck Flexion',
    equipment: 'Cable',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 2,
    name: 'Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 3,
    name: 'Lateral Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 4,
    name: 'Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 5,
    name: 'Lateral Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 6,
    name: 'Neck Flexion',
    equipment: 'Weighted',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 7,
    name: 'Lateral Neck Flexion',
    equipment: 'Weighted',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 8,
    name: 'Wall Front Neck Bridge',
    equipment: 'Body Weight',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 3,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 9,
    name: 'Wall Side Neck Bridge',
    equipment: 'Body Weight',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 3,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 10,
    name: 'Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 11,
    name: 'Lateral Neck Flexion',
    equipment: 'Other',
    targetMuscle: 'Sternocleidomastoid',
    difficulty: 2,
    emoji: '🦴',
    category: 'Neck'
  },
  {
    id: 12,
    name: 'Neck Extension',
    equipment: 'Cable',
    targetMuscle: 'Splenius',
    difficulty: 2,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 13,
    name: 'Neck Extension',
    equipment: 'Other',
    targetMuscle: 'Splenius',
    difficulty: 2,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 14,
    name: 'Neck Extension',
    equipment: 'Other',
    targetMuscle: 'Splenius',
    difficulty: 2,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 15,
    name: 'Seated Neck Extension',
    equipment: 'Weighted',
    targetMuscle: 'Splenius',
    difficulty: 2,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 16,
    name: 'Seated Neck Extension:  Harness',
    equipment: 'Weighted',
    targetMuscle: 'Splenius',
    difficulty: 3,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 17,
    name: 'Neck Retraction',
    equipment: 'Other',
    targetMuscle: 'Splenius',
    difficulty: 1,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 18,
    name: 'Wall Rear Neck Bridge',
    equipment: 'Body Weight',
    targetMuscle: 'Splenius',
    difficulty: 3,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 19,
    name: 'Lying Neck Retraction',
    equipment: 'Other',
    targetMuscle: 'Splenius',
    difficulty: 1,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 20,
    name: 'Neck Extension',
    equipment: 'Other',
    targetMuscle: 'Splenius',
    difficulty: 2,
    emoji: '🦴',
    category: 'Miscellaneous'
  },
  {
    id: 21,
    name: 'Front Raise',
    equipment: 'Barbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 22,
    name: 'Military Press',
    equipment: 'Barbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 23,
    name: 'Military Press:  Seated',
    equipment: 'Barbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 24,
    name: 'Front Raise',
    equipment: 'Cable',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 25,
    name: 'Front Raise:  Alternating',
    equipment: 'Cable',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 26,
    name: 'Front Raise:  One Arm',
    equipment: 'Cable',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 27,
    name: 'Shoulder Press',
    equipment: 'Cable',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 28,
    name: 'Shoulder Press:  Seated',
    equipment: 'Cable',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 29,
    name: 'Arnold Press',
    equipment: 'Dumbbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 30,
    name: 'Front Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 31,
    name: 'Front Raise:  Alternating',
    equipment: 'Dumbbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 32,
    name: 'Shoulder Press',
    equipment: 'Dumbbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 33,
    name: 'Shoulder Press:  One Arm',
    equipment: 'Dumbbell',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 34,
    name: 'Military Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 35,
    name: 'Reclined Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 36,
    name: 'Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 37,
    name: 'Reclined Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 38,
    name: 'Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 39,
    name: 'Shoulder Press:  Parallel Grip',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 40,
    name: 'Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 41,
    name: 'Shoulder Press',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 42,
    name: 'Pike Press (between benches)',
    equipment: 'Body Weight',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 43,
    name: 'Pike Press (between benches):  Elevated (between benches)',
    equipment: 'Body Weight',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 5,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 44,
    name: 'Front Raise',
    equipment: 'Other',
    targetMuscle: 'Anterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 45,
    name: 'Upright Row',
    equipment: 'Barbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 46,
    name: 'Lateral Raise',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 47,
    name: 'Lateral Raise:  One Arm',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 48,
    name: 'Upright Row',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 49,
    name: 'Upright Row:  One Arm',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 50,
    name: 'Upright Row:  with rope',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 51,
    name: 'Y Raise',
    equipment: 'Cable',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 52,
    name: 'Incline Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 53,
    name: 'Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 54,
    name: 'Upright Row',
    equipment: 'Dumbbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 55,
    name: 'Upright Row:  One Arm',
    equipment: 'Dumbbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 56,
    name: 'Lateral Raise',
    equipment: 'Other',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 57,
    name: 'Lateral Raise',
    equipment: 'Other',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 58,
    name: 'Lateral Raise:  other machine',
    equipment: 'Other',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 59,
    name: 'Upright Row​​​​​​​',
    equipment: 'Smith',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 60,
    name: 'Y Raise',
    equipment: 'Other',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 61,
    name: 'Rear Delt Row',
    equipment: 'Barbell',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 62,
    name: 'Reverse Fly',
    equipment: 'Cable',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 63,
    name: 'Rear Delt Row',
    equipment: 'Cable',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 64,
    name: 'Rear Delt Row:  Standing Rear Delt Row (stirrups)',
    equipment: 'Cable',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 65,
    name: 'Rear Lateral Raise',
    equipment: 'Cable',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 66,
    name: 'Rear Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 67,
    name: 'Rear Delt Row',
    equipment: 'Dumbbell',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 68,
    name: 'Seated Rear Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 69,
    name: 'Lying Rear Lateral Raise',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 70,
    name: 'Seated Rear Delt Row',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 71,
    name: 'Seated Rear Delt Row:  alternative machine',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 72,
    name: 'Lying Rear Lateral Raise',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 73,
    name: 'Seated Rear Delt Row',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 74,
    name: 'Seated Reverse Fly',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 75,
    name: 'Seated Reverse Fly:  pronated grip',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 76,
    name: 'Rear Delt Row',
    equipment: 'Smith',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 77,
    name: 'Rear Delt Inverted Row (high bar)',
    equipment: 'Body Weight',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 78,
    name: 'Rear Delt Inverted Row (on hips)',
    equipment: 'Body Weight',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 79,
    name: 'Rear Delt Row',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Shoulders'
  },
  {
    id: 80,
    name: 'Reverse Fly',
    equipment: 'Other',
    targetMuscle: 'Posterior Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 81,
    name: 'Front Lateral Raise',
    equipment: 'Cable',
    targetMuscle: 'Supraspinatus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 82,
    name: 'Front Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Supraspinatus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 83,
    name: 'Full Can Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Supraspinatus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 84,
    name: 'Lying Lateral Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Lateral Deltoid',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Shoulders'
  },
  {
    id: 85,
    name: 'Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 86,
    name: 'Triceps Dip:  kneeling',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 87,
    name: 'Close Grip Bench Press',
    equipment: 'Barbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 88,
    name: 'Lying Triceps Extension',
    equipment: 'Barbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 89,
    name: 'Lying Triceps Extension:  Skull Crusher',
    equipment: 'Barbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 90,
    name: 'Triceps Extension',
    equipment: 'Barbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 91,
    name: 'Bent-over Triceps Extension',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 92,
    name: 'Pushdown',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 93,
    name: 'Pushdown:  One Arm',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 94,
    name: 'Pushdown:  with back support',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Triceps'
  },
  {
    id: 95,
    name: 'Pushdown:  with V-bar attachment',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 96,
    name: 'Triceps Dip',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 97,
    name: 'Triceps Extension',
    equipment: 'Cable',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 100,
    name: 'Kickback',
    equipment: 'Dumbbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Triceps'
  },
  {
    id: 101,
    name: 'Lying Triceps Extension',
    equipment: 'Dumbbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 102,
    name: 'One Arm Triceps Extension (on bench)',
    equipment: 'Dumbbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 103,
    name: 'Triceps Extension',
    equipment: 'Dumbbell',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 104,
    name: 'Close Grip Bench Press',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 105,
    name: 'Triceps Extension',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 106,
    name: 'Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 107,
    name: 'Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 108,
    name: 'Triceps Dip:  alternative machine',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 109,
    name: 'Triceps Extension',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 110,
    name: 'Triceps Extension:  with preacher pad New!',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 111,
    name: 'Standing Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 112,
    name: 'Close Grip Bench Press',
    equipment: 'Smith',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 113,
    name: 'Bench Dip',
    equipment: 'Weighted',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 114,
    name: 'Triceps Dip',
    equipment: 'Weighted',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 115,
    name: 'Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 116,
    name: 'Bench Dip',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 117,
    name: 'Bench Dip:  heel on floor',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 118,
    name: 'Close Grip Push-up',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 119,
    name: 'Close Grip Push-up:  on knees',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 120,
    name: 'Close Grip Push-up:  Incline on bar',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Triceps'
  },
  {
    id: 121,
    name: 'Triceps Dip',
    equipment: 'Body Weight',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 122,
    name: 'Triceps Extension',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 123,
    name: 'Triceps Dip',
    equipment: 'Other',
    targetMuscle: 'Triceps Brachii',
    difficulty: 4,
    emoji: '💪',
    category: 'Triceps'
  },
  {
    id: 124,
    name: 'Curl',
    equipment: 'Barbell',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 125,
    name: 'Alternating Curl',
    equipment: 'Cable',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 126,
    name: 'Curl',
    equipment: 'Cable',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 127,
    name: 'Curl:  with stirrups',
    equipment: 'Cable',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 128,
    name: 'Curl:  One Arm Curl',
    equipment: 'Cable',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 129,
    name: 'Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 130,
    name: 'Incline Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Biceps Brachii',
    difficulty: 3,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 131,
    name: 'Curl',
    equipment: 'Other',
    targetMuscle: 'Biceps Brachii',
    difficulty: 2,
    emoji: '💪',
    category: 'Biceps'
  },
  {
    id: 132,
    name: 'Inverted Biceps Row',
    equipment: 'Body Weight',
    targetMuscle: 'Biceps Brachii',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Biceps'
  },
  {
    id: 133,
    name: 'Preacher Curl',
    equipment: 'Barbell',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 134,
    name: 'Prone Incline Curl',
    equipment: 'Barbell',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 135,
    name: 'Concentration Curl',
    equipment: 'Cable',
    targetMuscle: 'Brachialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 136,
    name: 'Preacher Curl',
    equipment: 'Cable',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 137,
    name: 'Preacher Curl: Stirrups',
    equipment: 'Cable',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 138,
    name: 'Concentration Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Brachialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 139,
    name: 'Preacher Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 140,
    name: 'Preacher Curl',
    equipment: 'Other',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 141,
    name: 'Preacher Curl: arms high',
    equipment: 'Other',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 142,
    name: 'Preacher Curl',
    equipment: 'Other',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 143,
    name: 'Preacher Curl: arms high',
    equipment: 'Other',
    targetMuscle: 'Brachialis',
    difficulty: 3,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 144,
    name: 'Arm Curl',
    equipment: 'Other',
    targetMuscle: 'Brachialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 145,
    name: 'Reverse Curl',
    equipment: 'Barbell',
    targetMuscle: 'Brachioradialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 146,
    name: 'Hammer Curl',
    equipment: 'Cable',
    targetMuscle: 'Brachioradialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 147,
    name: 'Reverse Curl',
    equipment: 'Cable',
    targetMuscle: 'Brachioradialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 148,
    name: 'Hammer Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Brachioradialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 149,
    name: 'Reverse Curl​​​​​​​',
    equipment: 'Other',
    targetMuscle: 'Brachioradialis',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 150,
    name: 'Wrist Curl',
    equipment: 'Barbell',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 151,
    name: 'Wrist Curl',
    equipment: 'Cable',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 152,
    name: 'Wrist Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 153,
    name: 'Grip',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 154,
    name: 'Wrist Curl',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 155,
    name: 'Grip',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 156,
    name: 'Wrist Curl',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 157,
    name: 'One Hand Grip',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 158,
    name: 'One Hand​​​​​​​',
    equipment: 'Other',
    targetMuscle: 'Wrist Flexors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 159,
    name: 'Reverse Wrist Curl',
    equipment: 'Barbell',
    targetMuscle: 'Wrist Extensors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 160,
    name: 'Reverse Wrist Curl',
    equipment: 'Cable',
    targetMuscle: 'Wrist Extensors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 161,
    name: 'Reverse Wrist Curl',
    equipment: 'Dumbbell',
    targetMuscle: 'Wrist Extensors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 162,
    name: 'Reverse Wrist Curl',
    equipment: 'Other',
    targetMuscle: 'Wrist Extensors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 163,
    name: 'Reverse Wrist Curl',
    equipment: 'Other',
    targetMuscle: 'Wrist Extensors',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 164,
    name: 'Seated Pronation',
    equipment: 'Dumbbell',
    targetMuscle: 'Pronators',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 165,
    name: 'Seated Pronation',
    equipment: 'Other',
    targetMuscle: 'Pronators',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 166,
    name: 'Seated Supination',
    equipment: 'Dumbbell',
    targetMuscle: 'Supinator',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 167,
    name: 'Seated Supination',
    equipment: 'Other',
    targetMuscle: 'Supinator',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 168,
    name: 'Bent-over Row',
    equipment: 'Barbell',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 169,
    name: 'Bent-over Row:  Underhand',
    equipment: 'Barbell',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 170,
    name: 'One Arm Bent-over Row',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 171,
    name: 'One Arm Straight Back Seated High Row',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 172,
    name: 'Seated Row',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 173,
    name: 'Seated Row:  Straight Back',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 174,
    name: 'Seated Wide Grip Row',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 175,
    name: 'Seated Wide Grip Row:  Straight Back',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 176,
    name: 'Bent-over Row',
    equipment: 'Dumbbell',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 177,
    name: 'Lying Row',
    equipment: 'Dumbbell',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 178,
    name: 'Incline Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 179,
    name: 'Incline Row:  Close Grip',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 180,
    name: 'Seated Rows',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 181,
    name: 'Seated Rows:  Narrow Grip',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 186,
    name: ',Lever (plate loaded),Yes,Basic,Compound,Pull,Latissimus Dorsi',
    equipment: 'Other',
    targetMuscle: 'Trapezius',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 187,
    name: 'Seated Rows (Others)',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 188,
    name: 'Seated Rows (Others):  Seated Low Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 189,
    name: 'Seated Rows (Others):  Seated High Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 190,
    name: 'T-bar Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 191,
    name: 'T-bar Row:  Close grip',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 192,
    name: 'Seated Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 193,
    name: 'Seated Row:  Wide Grip',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 194,
    name: 'Seated Row (no chest pad)',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 195,
    name: 'Seated Row (no chest pad):  Straight Back',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 196,
    name: 'Underhand Seated Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 197,
    name: 'Bent-over Row',
    equipment: 'Smith',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 198,
    name: 'Inverted Row',
    equipment: 'Weighted',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 199,
    name: 'Inverted Row',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 200,
    name: 'Inverted Row:  Feet Elevated',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 201,
    name: 'Inverted Row:  High Bar',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 202,
    name: 'Inverted Row:  On Hips',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 203,
    name: 'Inverted Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 204,
    name: 'Inverted Row:  One Arm',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 205,
    name: 'Row',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 206,
    name: 'Row:  One Arm',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Lower Trapezius Rhomboids Middle Trapezius',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 207,
    name: 'Pull-up (open-centered bar)',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 208,
    name: 'Pull-up (open-centered bar):  Standing',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 209,
    name: 'Parallel Close Grip Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 210,
    name: 'Pullover',
    equipment: 'Barbell',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 211,
    name: 'Bent-over Pullover',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 212,
    name: 'Close Grip Pulldown',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 213,
    name: 'Pulldown',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 214,
    name: 'Pulldown:  Parallel Grip Pulldown',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 215,
    name: 'Pullup/Chinup',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 216,
    name: 'Pullup/Chinup:  Chinup',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 217,
    name: 'Pullup/Chinup:  Parallel Close Grip Pull-up',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 218,
    name: 'Pullup/Chinup:  Parallel Grip Pull-up',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 219,
    name: 'Pullup/Chinup:  Pull-up',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 220,
    name: 'Underhand Pulldown',
    equipment: 'Cable',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 221,
    name: 'Pulldown',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 222,
    name: 'Underhand Pulldown',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 223,
    name: 'Close Grip Pulldown',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 224,
    name: 'Front Pulldown',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 225,
    name: 'Pulldown',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 226,
    name: 'Pullover',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 227,
    name: 'Chin-up',
    equipment: 'Weighted',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 228,
    name: 'Parallel Close Grip Pull-up',
    equipment: 'Weighted',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 229,
    name: 'Pull-up',
    equipment: 'Weighted',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 230,
    name: 'Archer Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 5,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 231,
    name: 'Chin-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 232,
    name: 'Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 233,
    name: 'Pull-up:  Parallel Grip',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 234,
    name: 'Archer Pull-up',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 5,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 235,
    name: 'Chin-up',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 236,
    name: 'One Arm Pull-up New!',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 5,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 237,
    name: 'Parallel Close Grip Pull-up',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 238,
    name: 'Pull-up',
    equipment: 'Body Weight',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 239,
    name: 'Chin-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 240,
    name: 'Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 241,
    name: 'Chin-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 242,
    name: 'Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 243,
    name: 'Pull-up',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 244,
    name: 'Pull-up:  Self-assisted',
    equipment: 'Other',
    targetMuscle: 'Latissimus Dorsi Teres Major Lower Trapezius Rhomboids',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Back'
  },
  {
    id: 245,
    name: 'Shrug',
    equipment: 'Barbell',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 246,
    name: 'Trap Bar Shrug',
    equipment: 'Barbell',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 247,
    name: 'Shrug',
    equipment: 'Cable',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 248,
    name: 'Shrug with Stirrups',
    equipment: 'Cable',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 249,
    name: 'Shrug',
    equipment: 'Dumbbell',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 250,
    name: 'Seated Shrug',
    equipment: 'Other',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 251,
    name: 'Shrug',
    equipment: 'Other',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 252,
    name: 'Shrug',
    equipment: 'Other',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 253,
    name: 'Gripless Shrug',
    equipment: 'Other',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 254,
    name: 'Shrug',
    equipment: 'Smith',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 255,
    name: 'Inverted Shrug',
    equipment: 'Body Weight',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 256,
    name: 'Inverted Shrug',
    equipment: 'Other',
    targetMuscle: 'Upper Trapezius Levator Scapulae Middle Trapezius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Back'
  },
  {
    id: 257,
    name: 'Seated Shoulder External Rotation',
    equipment: 'Cable',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 258,
    name: 'Seated Shoulder External Rotation:  Standing',
    equipment: 'Cable',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 259,
    name: 'Lying Shoulder External Rotation',
    equipment: 'Dumbbell',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 260,
    name: 'Upright Shoulder External Rotation (with support)',
    equipment: 'Dumbbell',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 261,
    name: 'Shoulder External Rotation',
    equipment: 'Other',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 262,
    name: 'Shoulder External Rotation',
    equipment: 'Other',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 263,
    name: 'Shoulder External Rotation',
    equipment: 'Other',
    targetMuscle: 'Infraspinatus Teres Minor',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 264,
    name: 'Standing Shoulder Internal Rotation',
    equipment: 'Cable',
    targetMuscle: 'Subscapularis',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 265,
    name: 'Shoulder Internal Rotation',
    equipment: 'Dumbbell',
    targetMuscle: 'Subscapularis',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 266,
    name: 'Shoulder Internal Rotation:  on floor',
    equipment: 'Dumbbell',
    targetMuscle: 'Subscapularis',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 267,
    name: 'Shoulder Internal Rotation',
    equipment: 'Other',
    targetMuscle: 'Subscapularis',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 268,
    name: 'Shoulder Internal Rotation​​​​​​​',
    equipment: 'Other',
    targetMuscle: 'Subscapularis',
    difficulty: 1,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 269,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 270,
    name: 'Chest Dip:  kneeling',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 271,
    name: 'Bench Press',
    equipment: 'Barbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 272,
    name: 'Bench Press:  Power Lift',
    equipment: 'Barbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 273,
    name: 'Decline Bench Press',
    equipment: 'Barbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 274,
    name: 'Flies',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 275,
    name: 'Flies:  Lying Fly',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 276,
    name: 'Flies:  Seated Fly',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 277,
    name: 'Flies:  Standing Fly',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 278,
    name: 'Presses',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 279,
    name: 'Presses:  Bench Press',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 285,
    name: 'Presses:  Decline Chest Press',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 286,
    name: 'Bench Press',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 287,
    name: 'Decline Bench Press',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 288,
    name: 'Fly',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 289,
    name: 'Pullover',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Chest'
  },
  {
    id: 290,
    name: 'Bench Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 291,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 292,
    name: 'Chest Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 293,
    name: 'Decline Chest Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 294,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 295,
    name: 'Flies',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 296,
    name: 'Flies:  Lying Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 297,
    name: 'Flies:  Pec Deck Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 298,
    name: 'Flies:  Seated Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 299,
    name: 'Presses',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 300,
    name: 'Presses:  Bench Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 306,
    name: 'Presses:  Decline Chest Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 307,
    name: 'Standing Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 308,
    name: 'Bench Press',
    equipment: 'Smith',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 309,
    name: 'Decline Bench Press',
    equipment: 'Smith',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 310,
    name: 'Chest Dip',
    equipment: 'Weighted',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 311,
    name: 'Push-up',
    equipment: 'Weighted',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 312,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 313,
    name: 'Chest Dip',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 314,
    name: 'Push-up',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 315,
    name: 'Push-up:  Archer',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 316,
    name: 'Push-up:  Incline',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 317,
    name: 'Push-up:  on knees',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 318,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 319,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 320,
    name: 'Chest Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 321,
    name: 'Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 322,
    name: 'Clap Push-up',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 323,
    name: 'Depth Push-up',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 324,
    name: 'Incline Bench Press',
    equipment: 'Barbell',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 325,
    name: 'Incline Bench Press',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 326,
    name: 'Incline Chest Press',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 327,
    name: 'Incline Fly',
    equipment: 'Cable',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 328,
    name: 'Incline Bench Press',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 329,
    name: 'Incline Fly',
    equipment: 'Dumbbell',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 330,
    name: 'Incline Chest Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 331,
    name: 'Incline Chest Press:  on Military Press Machine',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 332,
    name: 'Incline Bench Press',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 333,
    name: 'Incline Chest Press​​​​​​​',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 334,
    name: 'Incline Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 335,
    name: 'Incline Bench Press',
    equipment: 'Smith',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 336,
    name: 'Decline Push-up',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 337,
    name: 'Decline Push-up:  on stability ball',
    equipment: 'Body Weight',
    targetMuscle: 'Pectoralis Major Clavicular',
    difficulty: 4,
    emoji: '🔥',
    category: 'Chest'
  },
  {
    id: 338,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 339,
    name: 'Standing Fly',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Chest'
  },
  {
    id: 340,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 341,
    name: 'Chest Dip',
    equipment: 'Other',
    targetMuscle: 'Pectoralis Major Sternal',
    difficulty: 3,
    emoji: '💪',
    category: 'Chest'
  },
  {
    id: 342,
    name: 'Incline Shoulder Raise',
    equipment: 'Barbell',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 343,
    name: 'Incline Shoulder Raise',
    equipment: 'Cable',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 344,
    name: 'Incline Shoulder Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 345,
    name: 'Incline Shoulder Raise',
    equipment: 'Other',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 346,
    name: 'Incline Shoulder Raise',
    equipment: 'Other',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 347,
    name: 'Incline Shoulder Raise',
    equipment: 'Smith',
    targetMuscle: 'Serratus Anterior',
    difficulty: 2,
    emoji: '💪',
    category: 'Miscellaneous'
  },
  {
    id: 348,
    name: 'Push-up Plus',
    equipment: 'Body Weight',
    targetMuscle: 'Serratus Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 349,
    name: 'Bent Knee Good-morning',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 350,
    name: 'Deadlifts',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 5,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 355,
    name: ',Barbell,Yes,Basic or Auxiliary,Compound,Pull,Gluteus Maximus',
    equipment: 'Other',
    targetMuscle: 'Middle',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Miscellaneous'
  },
  {
    id: 356,
    name: 'Hip Thrust',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 357,
    name: 'Lunge',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 358,
    name: 'Lunge:  Rear Lunge',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 359,
    name: 'Single Leg Split Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 360,
    name: 'Single Leg Split Squat:  Single Leg Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 361,
    name: 'Single Leg Split Squat:  Split Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 362,
    name: 'Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 363,
    name: 'Squat:  Front Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 364,
    name: 'Squat:  Full Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 5,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 365,
    name: 'Squat:  Safety Squat',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 366,
    name: 'Step-up',
    equipment: 'Barbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 367,
    name: 'Glute Kickback',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 368,
    name: 'Rear Lunge',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 369,
    name: 'Split Squat',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 370,
    name: 'Split Squat:  Two Arms',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 371,
    name: 'Squat',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 372,
    name: 'Standing Hip Extension',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 373,
    name: 'Standing Hip Extension:  Bent-over',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 374,
    name: 'Step-up',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 375,
    name: 'Stiff-leg Deadlift',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 376,
    name: 'Stiff-leg Deadlift:  Straight-back',
    equipment: 'Cable',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 377,
    name: 'Lunge',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 378,
    name: 'Lunge:  Rear Lunge',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 379,
    name: 'Split Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 380,
    name: 'Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 381,
    name: 'Squat:  Front Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 382,
    name: 'Step-up',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 383,
    name: 'Step-up:  Step Down',
    equipment: 'Dumbbell',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 384,
    name: 'Deadlift',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 5,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 389,
    name: ',Lever (plate loaded),Yes,Basic or Auxiliary,Compound,Pull,Gluteus Maximus',
    equipment: 'Other',
    targetMuscle: 'Middle',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Miscellaneous'
  },
  {
    id: 390,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 391,
    name: 'Leg Presses:  45° Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 392,
    name: 'Leg Presses:  Lying Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 393,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 394,
    name: 'Lying Hip Extension',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 395,
    name: 'Reverse Hyper-extension',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 396,
    name: 'Single Leg Split Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 397,
    name: 'Single Leg Split Squat:  Single Leg Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 398,
    name: 'Split Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 399,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 400,
    name: 'Squat:  Front Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 401,
    name: 'Hip Extensions',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 402,
    name: 'Hip Extensions:  Bent-over',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 403,
    name: 'Hip Extensions:  Lying',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 409,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 410,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 411,
    name: 'Glute Kickback',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 412,
    name: 'Glute Kickback:  Bent-over',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 413,
    name: 'Glute Kickback:  Kneeling',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 414,
    name: 'Glute Kickback:  Standing',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 415,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 416,
    name: 'Squat:  V-Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 417,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 418,
    name: 'Leg Presses:  45° Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 419,
    name: 'Leg Presses:  Lying Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 420,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 421,
    name: 'Glute Kickback',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 422,
    name: 'Glute Kickback:  Kneeling',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 423,
    name: 'Glute Kickback:  Standing',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 424,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 425,
    name: 'Squat:  Hack Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 426,
    name: 'Deadlift',
    equipment: 'Smith',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 5,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 431,
    name: ',Smith,Yes,Basic or Auxiliary,Compound,Pull,Gluteus Maximus',
    equipment: 'Other',
    targetMuscle: 'Middle',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Miscellaneous'
  },
  {
    id: 432,
    name: 'Rear Lunge',
    equipment: 'Smith',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 433,
    name: 'Squat',
    equipment: 'Smith',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 434,
    name: 'Reverse Hyper-extension',
    equipment: 'Weighted',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 435,
    name: 'Single Leg Squat',
    equipment: 'Weighted',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 436,
    name: 'Lunge',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 437,
    name: 'Rear Lunge',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 438,
    name: 'Single Leg Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 439,
    name: 'Split Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 440,
    name: 'Split Squat:  Single Leg Split Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 441,
    name: 'Single Leg Stiff Leg Deadlift',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 442,
    name: 'Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 443,
    name: 'Step-up',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 444,
    name: 'Step-up:  Step Down',
    equipment: 'Body Weight',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 445,
    name: 'Single Leg Squat (leg wrapped)',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 446,
    name: 'Step Down',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 447,
    name: 'Hip Bridge',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 448,
    name: 'Single Leg Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 449,
    name: 'Single Leg Split Squat',
    equipment: 'Other',
    targetMuscle: 'Gluteus Maximus',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 450,
    name: 'Hip Abduction',
    equipment: 'Cable',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 451,
    name: 'Seated Hip Internal Rotation',
    equipment: 'Cable',
    targetMuscle: 'Hip Abductors',
    difficulty: 1,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 452,
    name: 'Lying Hip Abduction',
    equipment: 'Dumbbell',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 453,
    name: 'Seated Hip Abduction',
    equipment: 'Other',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 454,
    name: 'Seated Hip Abduction',
    equipment: 'Other',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 455,
    name: 'Standing Hip Abduction',
    equipment: 'Other',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 456,
    name: 'Lying Hip Abduction',
    equipment: 'Weighted',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 457,
    name: 'Twist',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 458,
    name: 'Hip Abduction',
    equipment: 'Other',
    targetMuscle: 'Hip Abductors',
    difficulty: 2,
    emoji: '🔥',
    category: 'Miscellaneous'
  },
  {
    id: 459,
    name: 'Side Bend',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 460,
    name: 'Assisted Wheel Rollout',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 461,
    name: 'Lying Leg Raise',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 462,
    name: 'Lying Leg Raise:  on bench',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 463,
    name: 'Lying Leg Raise:  Straight Leg',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 464,
    name: 'Standing Leg Raise',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 465,
    name: 'Standing Leg Raise:  Straight Leg',
    equipment: 'Cable',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 466,
    name: 'Hip Flexion',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 467,
    name: 'Lying Leg Raise',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 468,
    name: 'Vertical Leg Raise',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 469,
    name: 'Decline Sit-up',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 470,
    name: 'Hanging Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 471,
    name: 'Hanging Leg Raise:  Straight Leg',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 5,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 472,
    name: 'Incline Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 473,
    name: 'Incline Leg Raise:  arms on pads',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 474,
    name: 'Incline Straight Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 475,
    name: 'Incline Straight Leg Raise:  arms on pads',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 476,
    name: 'Lying Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 477,
    name: 'Roman Chair Sit-up',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 478,
    name: 'Seated Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 479,
    name: 'Vertical Leg Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 480,
    name: 'Vertical Leg Raise:  on Parallel Bars',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 481,
    name: 'Vertical Leg Raise:  Straight Leg',
    equipment: 'Weighted',
    targetMuscle: 'Hip Flexors',
    difficulty: 5,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 482,
    name: 'Leg Raises',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 493,
    name: ',Body Weight,Yes,Auxiliary,Isolated,Pull,Hip Flexors,Tensor Fasciae Latae',
    equipment: 'Other',
    targetMuscle: 'Obliques',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Core'
  },
  {
    id: 498,
    name: ',Body Weight,Yes,Auxiliary,Isolated,Pull,Hip Flexors,Tensor Fasciae Latae',
    equipment: 'Other',
    targetMuscle: 'Rectus Abdominis',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Core'
  },
  {
    id: 510,
    name: 'Leg Raises:  Seated Leg Raise',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 2,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 516,
    name: ',Body Weight,Yes,Auxiliary,Isolated,Pull,Hip Flexors,Tensor Fasciae Latae',
    equipment: 'Other',
    targetMuscle: 'Obliques',
    difficulty: 1,
    emoji: '🏋️‍♂️',
    category: 'Core'
  },
  {
    id: 517,
    name: 'Jack-knife on Ball',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 518,
    name: 'Roman Chair Sit-up',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 519,
    name: 'Scissor Kick',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 520,
    name: 'Wheel',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 521,
    name: 'Wheel:  Jack-Knife',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 522,
    name: 'Wheel:  Rollout',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 523,
    name: 'Wheel:  Pike',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 524,
    name: 'Discs',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 525,
    name: 'Discs:  Pike',
    equipment: 'Body Weight',
    targetMuscle: 'Hip Flexors',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 526,
    name: 'Mountain Climber',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 527,
    name: 'Pike',
    equipment: 'Other',
    targetMuscle: 'Hip Flexors',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 528,
    name: 'Lunge',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 529,
    name: 'Lunge:  Rear Lunge',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 530,
    name: 'Single Leg Split Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 531,
    name: 'Single Leg Split Squat:  Side Split Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 532,
    name: 'Single Leg Split Squat:  Single Leg Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 5,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 533,
    name: 'Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 534,
    name: 'Squat:  Front Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 535,
    name: 'Squat:  Trap Bar Squat',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 536,
    name: 'Step-up',
    equipment: 'Barbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 537,
    name: 'Rear Lunge',
    equipment: 'Cable',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 538,
    name: 'Split Squat',
    equipment: 'Cable',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 539,
    name: 'Squat',
    equipment: 'Cable',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 540,
    name: 'Step Down',
    equipment: 'Cable',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 541,
    name: 'Step-up',
    equipment: 'Cable',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 542,
    name: 'Lunge',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 543,
    name: 'Lunge:  Rear Lunge',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 544,
    name: 'Split Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 545,
    name: 'Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 546,
    name: 'Squat:  Front Squat',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 547,
    name: 'Step-up',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 548,
    name: 'Step-up:  Step Down',
    equipment: 'Dumbbell',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 549,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 550,
    name: 'Leg Presses:  45° Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 551,
    name: 'Leg Presses:  Lying Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 552,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 553,
    name: 'Single Leg Squat (plate loaded)',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 554,
    name: 'Split Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 555,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 556,
    name: 'Squat:  Barbell Machine',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 557,
    name: 'Leg Extension',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 2,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 558,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 559,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 560,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 561,
    name: 'V-Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 562,
    name: 'Leg Presses',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 563,
    name: 'Leg Presses:  45° Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 564,
    name: 'Leg Presses:  Lying Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 565,
    name: 'Leg Presses:  Seated Leg Press',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 566,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 567,
    name: 'Squat:  Hack Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 568,
    name: 'Rear Lunge',
    equipment: 'Smith',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 569,
    name: 'Squat',
    equipment: 'Smith',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 570,
    name: 'Single Leg Squat',
    equipment: 'Weighted',
    targetMuscle: 'Quadriceps',
    difficulty: 5,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 571,
    name: 'Rear Lunge',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 572,
    name: 'Lunge',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 573,
    name: 'Single Leg Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 5,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 574,
    name: 'Single Leg Squat:  Box',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 575,
    name: 'Split Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 576,
    name: 'Split Squat:  Single Leg Split Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 577,
    name: 'Squat',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 578,
    name: 'Step-up',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 579,
    name: 'Step-up:  Step-down',
    equipment: 'Body Weight',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 580,
    name: 'Single Leg Squat (leg wrapped)',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 581,
    name: 'Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 582,
    name: 'Step Down',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 583,
    name: 'Single Leg Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 5,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 584,
    name: 'Single Leg Split Squat',
    equipment: 'Other',
    targetMuscle: 'Quadriceps',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 585,
    name: 'Glute-Ham Raise',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 586,
    name: 'Good-morning',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 587,
    name: 'Hyperextension',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 588,
    name: 'Hyperextension (45°)',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 589,
    name: 'Straight-leg Deadlift',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 590,
    name: 'Straight-leg Deadlift:  Straight-back',
    equipment: 'Barbell',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 591,
    name: 'Lying Leg Curl',
    equipment: 'Cable',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 592,
    name: 'Standing Leg Curl',
    equipment: 'Cable',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 593,
    name: 'Straight-back Straight-leg Deadlift',
    equipment: 'Cable',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 594,
    name: 'Straight-back Straight-leg Deadlift',
    equipment: 'Dumbbell',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 595,
    name: 'Kneeling Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 596,
    name: 'Seated Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 597,
    name: 'Straight-back Straight-leg Deadlift',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 598,
    name: 'Bent-over Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 599,
    name: 'Kneeling Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 600,
    name: 'Lying Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 601,
    name: 'Seated Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 602,
    name: 'Standing Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 603,
    name: 'Good-morning',
    equipment: 'Smith',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 604,
    name: 'Straight-back Straight-leg Deadlift',
    equipment: 'Smith',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️‍♂️',
    category: 'Legs'
  },
  {
    id: 605,
    name: 'Glute-Ham Raise',
    equipment: 'Weighted',
    targetMuscle: 'Hamstrings',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 606,
    name: 'Hyperextension',
    equipment: 'Weighted',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 607,
    name: 'Hyperextension (45°)',
    equipment: 'Weighted',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 608,
    name: 'Hamstring Raise',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 609,
    name: 'Glute-Ham Raise',
    equipment: 'Body Weight',
    targetMuscle: 'Hamstrings',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 610,
    name: 'Glute-Ham Raise:  hands behind hips',
    equipment: 'Body Weight',
    targetMuscle: 'Hamstrings',
    difficulty: 4,
    emoji: '🏋️',
    category: 'Legs'
  },
  {
    id: 611,
    name: 'Single Leg Hanging Hamstring Bridge',
    equipment: 'Body Weight',
    targetMuscle: 'Hamstrings',
    difficulty: 4,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 612,
    name: 'Single Leg 45° Hyperextension',
    equipment: 'Body Weight',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '🦵',
    category: 'Legs'
  },
  {
    id: 613,
    name: 'Straight Hip Leg Curl (on ball)',
    equipment: 'Body Weight',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 614,
    name: 'Inverse Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 615,
    name: 'Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 2,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 616,
    name: 'Hanging Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 617,
    name: 'Straight Hip Leg Curl',
    equipment: 'Other',
    targetMuscle: 'Hamstrings',
    difficulty: 3,
    emoji: '💪',
    category: 'Legs'
  },
  {
    id: 618,
    name: 'Hip Adduction',
    equipment: 'Cable',
    targetMuscle: 'Hip Adductors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 619,
    name: 'Seated Hip Adduction',
    equipment: 'Other',
    targetMuscle: 'Hip Adductors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 620,
    name: 'Seated Hip Adduction',
    equipment: 'Other',
    targetMuscle: 'Hip Adductors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 621,
    name: 'Standing Hip Adduction',
    equipment: 'Other',
    targetMuscle: 'Hip Adductors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 622,
    name: 'Lying Hip Adduction',
    equipment: 'Weighted',
    targetMuscle: 'Hip Adductors',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 623,
    name: 'Standing Calf Raise',
    equipment: 'Barbell',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 624,
    name: 'Standing Calf Raise',
    equipment: 'Cable',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 625,
    name: 'Standing Calf Raise:  One Arm Single Leg Calf Raise',
    equipment: 'Cable',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 626,
    name: 'Standing Calf Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 627,
    name: 'Standing Calf Raise:  Single Leg',
    equipment: 'Dumbbell',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 628,
    name: '45° Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 629,
    name: 'Calf Extension',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 630,
    name: 'Seated Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 631,
    name: 'Standing Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 632,
    name: '45° Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 633,
    name: 'Calf Extension',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 634,
    name: 'Donkey Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 635,
    name: 'Seated Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 636,
    name: 'Standing Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 637,
    name: '45° Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 638,
    name: '45° Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 639,
    name: 'Donkey Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 640,
    name: 'Lying Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 641,
    name: 'Seated Calf Press',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 642,
    name: 'Standing Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 643,
    name: 'Donkey Calf Raise',
    equipment: 'Smith',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 644,
    name: 'Standing Calf Raise',
    equipment: 'Smith',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 645,
    name: 'Single Leg Calf Raise',
    equipment: 'Weighted',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 646,
    name: 'Standing Calf Raise',
    equipment: 'Body Weight',
    targetMuscle: 'Gastrocnemius',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 647,
    name: 'Standing Calf Raise:  Single Leg',
    equipment: 'Body Weight',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 648,
    name: 'Single Leg Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 649,
    name: 'Forward Angled Single Leg Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Gastrocnemius',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 650,
    name: 'Safety Barbell Seated Calf Raise',
    equipment: 'Barbell',
    targetMuscle: 'Soleus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 651,
    name: 'Seated Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Soleus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 652,
    name: 'Seated Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Soleus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 653,
    name: 'Seated Calf Raise',
    equipment: 'Smith',
    targetMuscle: 'Soleus',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 654,
    name: 'Safety Bar Reverse Calf Raise',
    equipment: 'Barbell',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 655,
    name: 'Reverse Calf Raise',
    equipment: 'Cable',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 656,
    name: 'Reverse Calf Raise:  Single Leg',
    equipment: 'Cable',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 657,
    name: 'Reverse Calf Raise',
    equipment: 'Dumbbell',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 658,
    name: 'Reverse Calf Raise:  Single Leg',
    equipment: 'Dumbbell',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  },
  {
    id: 659,
    name: '45° Reverse Calf Press',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 660,
    name: '45° Reverse Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 661,
    name: 'Reverse Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 662,
    name: 'Reverse Calf Extension',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 663,
    name: 'Reverse Calf Extension',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 664,
    name: 'Reverse Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 665,
    name: '45° Reverse Calf Press',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 666,
    name: '45° Reverse Calf Raise (plate loaded)',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 667,
    name: '45° Reverse Calf Raise (on hack press)',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 668,
    name: 'Hack Reverse Calf Raise',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 669,
    name: 'Lying Reverse Calf Press',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 670,
    name: 'Seated Reverse Calf Press',
    equipment: 'Other',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 671,
    name: 'Reverse Calf Raise',
    equipment: 'Smith',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 672,
    name: 'Reverse Calf Raise',
    equipment: 'Body Weight',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 2,
    emoji: '🏋️',
    category: 'Miscellaneous'
  },
  {
    id: 673,
    name: 'Reverse Calf Raise:  Single Leg',
    equipment: 'Body Weight',
    targetMuscle: 'Tibialis Anterior',
    difficulty: 3,
    emoji: '🦵',
    category: 'Miscellaneous'
  }
]);

  // Patch notes states
  const [expandedPatchId, setExpandedPatchId] = useState<number | null>(null);

  // Workout template states
  const [workoutTemplates, setWorkoutTemplates] = useState<any[]>([
    {
      id: 1,
      name: "Add Template",
      exercises: []
    },
    {
      id: 2,
      name: "Add Template", 
      exercises: []
    },
    {
      id: 3,
      name: "Add Template",
      exercises: []
    }
  ]);
  const [activeWorkout, setActiveWorkout] = useState<any>(null);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [workoutElapsedTime, setWorkoutElapsedTime] = useState(0);
  const [showWorkoutOverlay, setShowWorkoutOverlay] = useState(false);
  
  // Set tracking states
  const [completedSets, setCompletedSets] = useState<{[key: string]: boolean}>({});
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [popupTranslateY] = useState(new Animated.Value(Dimensions.get('window').height * 0.1));
  const [popupHeight, setPopupHeight] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Template creation states
  const [showTemplateNamePopup, setShowTemplateNamePopup] = useState(false);
  const [showTemplateCustomization, setShowTemplateCustomization] = useState(false);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [tempTemplateName, setTempTemplateName] = useState('');
  const [tempTemplateExercises, setTempTemplateExercises] = useState<any[]>([]);
  const [nextTemplateId, setNextTemplateId] = useState(4);
  const [showTemplateMenu, setShowTemplateMenu] = useState<number | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  // Insights report state
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsReport, setInsightsReport] = useState<any | null>(null);
  // Meal history for insights (aggregate of saved days; fallback to current day)
  const [mealHistory, setMealHistory] = useState<any[]>([]);
  const MEAL_HISTORY_KEY = 'himai_meal_history_v1';
  const WORKOUT_HISTORY_KEY = 'himai_workout_history_v1';

  // Load persisted histories on mount
  useEffect(() => {
    (async () => {
      try {
        const [mh, wh] = await Promise.all([
          AsyncStorage.getItem(MEAL_HISTORY_KEY),
          AsyncStorage.getItem(WORKOUT_HISTORY_KEY),
        ]);
        if (mh) {
          const parsed = JSON.parse(mh);
          if (Array.isArray(parsed)) setMealHistory(parsed);
        }
        if (wh) {
          const parsedWh = JSON.parse(wh);
          if (Array.isArray(parsedWh)) {
            // If code initializes templates elsewhere, we still merge/replace if empty
            if ((workoutHistory as any[]).length === 0) {
              setWorkoutHistory(parsedWh as any);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load persisted histories', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist meal history on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(MEAL_HISTORY_KEY, JSON.stringify(mealHistory));
      } catch (e) {
        console.warn('Failed to persist mealHistory', e);
      }
    })();
  }, [mealHistory]);

  // Persist workout history on change
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(WORKOUT_HISTORY_KEY, JSON.stringify(workoutHistory));
      } catch (e) {
        console.warn('Failed to persist workoutHistory', e);
      }
    })();
  }, [workoutHistory]);
  
  // Exercise selection states
  const [exerciseSelectionQuery, setExerciseSelectionQuery] = useState('');
  const [selectedExerciseEquipment, setSelectedExerciseEquipment] = useState('All');
  const [selectedExerciseMuscle, setSelectedExerciseMuscle] = useState('All');

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true); // true = login, false = signup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Authentication functions
  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please fill in all fields');
      return;
    }
    
    // Simple validation - in a real app, this would connect to a backend
    if (username.length < 3) {
      setAuthError('Username must be at least 3 characters');
      return;
    }
    
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    
    // Simulate successful login
    setIsAuthenticated(true);
    setAuthError('');
  };

  const handleSignup = () => {
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setAuthError('Please fill in all fields');
      return;
    }
    
    if (username.length < 3) {
      setAuthError('Username must be at least 3 characters');
      return;
    }
    
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    
    // Simulate successful signup
    setIsAuthenticated(true);
    setAuthError('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setAuthError('');
    setIsLoginMode(true);
  };

  const toggleAuthMode = () => {
    setIsLoginMode(!isLoginMode);
    setAuthError('');
    setPassword('');
    setConfirmPassword('');
  };

  // Template creation functions
  const handleCreateTemplate = (templateId: number) => {
    // Set which template we're editing
    setEditingTemplateId(templateId);
    setTempTemplateName('');
    setTempTemplateExercises([]);
    setShowTemplateNamePopup(true);
  };

  const handleEditTemplate = (template: any) => {
    // Set which template we're editing
    setEditingTemplateId(template.id);
    setTempTemplateName(template.name);
    setTempTemplateExercises([...template.exercises]);
    setShowTemplateCustomization(true);
  };

  const handleTemplateNameSubmit = () => {
    if (tempTemplateName.trim()) {
      setShowTemplateNamePopup(false);
      setShowTemplateCustomization(true);
    }
  };

  const handleAddWorkout = () => {
    setShowExerciseSelection(true);
  };

  const handleSelectExercise = (exercise: any) => {
    const newExercise = {
      id: Date.now(),
      name: exercise.name,
      sets: [
        { weight: 0, reps: 10 },
        { weight: 0, reps: 10 },
        { weight: 0, reps: 10 }
      ],
      restTime: 60
    };
    setTempTemplateExercises([...tempTemplateExercises, newExercise]);
    setShowExerciseSelection(false);
  };

  const handleRemoveExercise = (exerciseId: number) => {
    setTempTemplateExercises(tempTemplateExercises.filter(ex => ex.id !== exerciseId));
  };

  const handleSaveTemplate = () => {
    if (tempTemplateName.trim() && tempTemplateExercises.length > 0 && editingTemplateId) {
      const updatedTemplate = {
        id: editingTemplateId,
        name: tempTemplateName,
        exercises: tempTemplateExercises
      };
      
      // Update the specific template being edited
      const updatedTemplates = workoutTemplates.map(template => 
        template.id === editingTemplateId ? updatedTemplate : template
      );
      
      setWorkoutTemplates(updatedTemplates);
      setShowTemplateCustomization(false);
      setTempTemplateName('');
      setTempTemplateExercises([]);
      setEditingTemplateId(null);
    }
  };

  const handleDeleteTemplate = (templateId: number) => {
    const template = workoutTemplates.find(t => t.id === templateId);
    if (template && template.exercises.length > 0) {
      Alert.alert(
        'Delete Template',
        `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const updatedTemplates = workoutTemplates.map(t => 
                t.id === templateId 
                  ? { id: template.id, name: 'Add Template', exercises: [] }
                  : t
              );
              setWorkoutTemplates(updatedTemplates);
              setShowTemplateMenu(null);
            },
          },
        ]
      );
    }
  };

  // Shared template section component
  const renderTemplateSection = () => (
    <TouchableOpacity 
      style={styles.templateSection}
      activeOpacity={1}
      onPress={() => setShowTemplateMenu(null)}
    >
      {workoutTemplates.map((template) => (
        <View key={template.id} style={styles.templateButtonContainer}>
          <TouchableOpacity 
            style={styles.templateButton}
            onPress={(e) => {
              e.stopPropagation();
              if (template.exercises.length === 0) {
                // Empty template - start creation process
                handleCreateTemplate(template.id);
              } else {
                // Template with exercises - show popup
                setSelectedTemplate(template);
                setShowTemplatePopup(true);
              }
            }}
          >
            <Text style={styles.templateName}>{template.name}</Text>
            {template.exercises.length > 0 && (
              <Text style={styles.templateExerciseCount}>{template.exercises.length} exercises</Text>
            )}
          </TouchableOpacity>
          {template.exercises.length > 0 && (
            <TouchableOpacity 
              style={styles.templateMenuButton}
              onPress={(e) => {
                e.stopPropagation();
                setShowTemplateMenu(showTemplateMenu === template.id ? null : template.id);
              }}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#667eea" />
            </TouchableOpacity>
          )}
          {showTemplateMenu === template.id && template.exercises.length > 0 && (
            <View style={styles.templateMenuDropdown}>
              <TouchableOpacity 
                style={styles.templateMenuItem}
                onPress={() => {
                  handleEditTemplate(template);
                  setShowTemplateMenu(null);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#667eea" />
                <Text style={styles.templateMenuItemText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.templateMenuItem}
                onPress={() => {
                  handleDeleteTemplate(template.id);
                  setShowTemplateMenu(null);
                }}
              >
                <Ionicons name="trash" size={16} color="#ff4444" />
                <Text style={[styles.templateMenuItemText, { color: '#ff4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </TouchableOpacity>
  );
  const [patchNotes] = useState([
    {
      id: 1,
      title: "New Hypertrophy Research Update",
      image: "🔬",
      category: "Gym Updates",
      date: "December 15, 2024",
      version: "Patch 24.12.15",
      content: "Latest studies show that time under tension (TUT) training may be more effective for muscle growth than previously thought. New research from the Journal of Strength and Conditioning suggests 3-4 second eccentric phases optimize hypertrophy. This breakthrough research analyzed over 500 participants across 12 different studies, showing consistent results in muscle fiber recruitment and growth patterns. The study recommends implementing TUT protocols in your training routine, particularly focusing on the eccentric (lowering) phase of exercises. Researchers found that participants who maintained 3-4 second eccentric phases saw 23% greater muscle growth compared to traditional training methods. This has significant implications for how we approach strength training and muscle development."
    },
    {
      id: 2,
      title: "Exercise Form Revolution",
      image: "💪",
      category: "Gym Updates", 
      date: "December 10, 2024",
      version: "Patch 24.12.10",
      content: "Updated guidelines for deadlift form based on biomechanical analysis. New evidence suggests slight knee bend during setup reduces lower back stress while maintaining power output. The research team used motion capture technology to analyze over 1,000 deadlift repetitions across different experience levels. Key findings include: 1) A 10-15 degree knee bend during initial setup reduces lumbar spine compression by 18%, 2) Hip hinge mechanics remain the primary movement pattern, 3) Bar path optimization reduces energy expenditure by 12%. These findings challenge traditional 'straight leg' deadlift cues and provide a more nuanced approach to form that balances safety with performance. Coaches and trainers are now incorporating these biomechanical insights into their teaching methods."
    },
    {
      id: 3,
      title: "Recovery Science Breakthrough",
      image: "🧠",
      category: "Gym Updates",
      date: "December 5, 2024", 
      version: "Patch 24.12.05",
      content: "Sleep quality research reveals that 7-9 hours of sleep with consistent bedtimes is crucial for muscle protein synthesis. New tracking methods show REM sleep directly correlates with recovery rates. The study monitored 200 athletes for 6 months using advanced sleep tracking technology and muscle biopsy analysis. Results showed that participants with consistent sleep schedules (within 30 minutes of target bedtime) had 34% higher muscle protein synthesis rates. REM sleep duration was the strongest predictor of recovery, with each additional hour of REM sleep correlating to 15% faster muscle repair. The research also found that sleep quality matters more than quantity - 7 hours of high-quality sleep outperformed 9 hours of fragmented sleep. This has led to new recommendations for sleep hygiene practices specifically tailored for athletes and fitness enthusiasts."
    }
  ]);

  // Load exercises when tension detector opens
  useEffect(() => {
    if (showTensionDetector && availableExercises.length === 0) {
      loadExercises();
    }
  }, [showTensionDetector]);

  // Timer effect for active workout
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeWorkout && workoutStartTime) {
      interval = setInterval(() => {
        setWorkoutElapsedTime(Math.floor((new Date().getTime() - workoutStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeWorkout, workoutStartTime]);

  // PanResponder for draggable popup
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderMove: (evt, gestureState) => {
      // Allow free movement up and down from current position
      const screenHeight = Dimensions.get('window').height;
      const minimizedHeight = screenHeight * 0.1;
      const minimizedPosition = screenHeight - minimizedHeight;
      const maximizedPosition = screenHeight * 0.1; // Start 10% down from top for iPhone notch
      
      if (isMinimized) {
        // When minimized, move from minimized position
        popupTranslateY.setValue(minimizedPosition + gestureState.dy);
      } else {
        // When maximized, move from maximized position
        popupTranslateY.setValue(maximizedPosition + gestureState.dy);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      const screenHeight = Dimensions.get('window').height;
      const minimizedHeight = screenHeight * 0.1; // 1/10 of screen height
      const minimizedPosition = screenHeight - minimizedHeight; // Minimized at bottom
      const maximizedPosition = screenHeight * 0.1; // Maximized 10% down from top
      
      // Calculate current position based on gesture and current state
      let currentPosition;
      if (isMinimized) {
        currentPosition = minimizedPosition + gestureState.dy;
      } else {
        currentPosition = maximizedPosition + gestureState.dy;
      }
      
      // Determine target position based on movement direction and distance
      if (gestureState.dy > 150) {
        // Swipe down - go to minimized
        setIsMinimized(true);
        Animated.spring(popupTranslateY, {
          toValue: minimizedPosition,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else if (gestureState.dy < -50) {
        // Swipe up - go to maximized
        setIsMinimized(false);
        Animated.spring(popupTranslateY, {
          toValue: maximizedPosition,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      } else {
        // Small movement - snap to nearest position
        const distanceToMinimized = Math.abs(currentPosition - minimizedPosition);
        const distanceToMaximized = Math.abs(currentPosition - maximizedPosition);
        
        if (distanceToMinimized < distanceToMaximized) {
          setIsMinimized(true);
          Animated.spring(popupTranslateY, {
            toValue: minimizedPosition,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }).start();
        } else {
          setIsMinimized(false);
          Animated.spring(popupTranslateY, {
            toValue: maximizedPosition,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      }
    },
  });


  // Login Screen Component
  const renderLoginScreen = () => (
    <View style={styles.loginContainer}>
      <StatusBar style="light" />
      
      {/* HimAI Title */}
      <View style={styles.loginHeader}>
        <Text style={styles.loginTitle}>HimAI</Text>
      </View>

      {/* Login Form */}
      <View style={styles.loginForm}>
        {/* Username Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.loginInput}
            placeholder="Username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.loginInput}
            placeholder="Password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Confirm Password Input (Signup only) */}
        {!isLoginMode && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.loginInput}
              placeholder="Confirm Password"
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {/* Error Message */}
        {authError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        ) : null}

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={isLoginMode ? handleLogin : handleSignup}
        >
          <Text style={styles.loginButtonText}>
            {isLoginMode ? 'Sign In' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        {/* Toggle Mode */}
        <TouchableOpacity 
          style={styles.toggleButton}
          onPress={toggleAuthMode}
        >
          <Text style={styles.toggleButtonText}>
            {isLoginMode 
              ? "Don't have an account? Sign Up" 
              : "Already have an account? Sign In"
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // If not authenticated, show login screen
  if (!isAuthenticated) {
    return renderLoginScreen();
  }

  // Settings Menu Component
  const renderSettingsMenu = () => (
    <View style={styles.settingsOverlay}>
      <View style={styles.settingsContainer}>
        {/* Settings Header */}
        <View style={styles.settingsHeader}>
          <Text style={styles.settingsTitle}>Settings</Text>
          <TouchableOpacity 
            style={styles.settingsCloseButton}
            onPress={() => setShowSettingsMenu(false)}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Settings Content */}
        <ScrollView style={styles.settingsContent}>
          {/* User Info Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>Account</Text>
            <View style={styles.settingsItem}>
              <Ionicons name="person-outline" size={20} color="#667eea" />
              <Text style={styles.settingsItemText}>Username: {username}</Text>
            </View>
          </View>

          {/* App Settings Section */}
          <View style={styles.settingsSection}>
            <Text style={styles.settingsSectionTitle}>App Settings</Text>
            <View style={styles.settingsItem}>
              <Ionicons name="notifications-outline" size={20} color="#667eea" />
              <Text style={styles.settingsItemText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
            <View style={styles.settingsItem}>
              <Ionicons name="color-palette-outline" size={20} color="#667eea" />
              <Text style={styles.settingsItemText}>Theme</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
            <View style={styles.settingsItem}>
              <Ionicons name="fitness-outline" size={20} color="#667eea" />
              <Text style={styles.settingsItemText}>Workout Preferences</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
          </View>

          {/* Logout Section */}
          <View style={styles.settingsSection}>
            <TouchableOpacity 
              style={styles.logoutSettingsButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
              <Text style={styles.logoutSettingsText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.homeContainer}>
      <StatusBar style="light" />
      
      {/* Header with HimAI brand */}
      <View style={styles.header}>
        <Text style={styles.brandName}>HimAI</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettingsMenu(true)}>
          <Ionicons name="settings-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content based on active tab */}
      {activeTab === 'home' ? (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Text */}
          <View style={styles.heroSection}>
            <Text style={styles.heroText}>Level up all aspects of your life. Become Him.</Text>
      </View>


          {/* Template Buttons */}
          {renderTemplateSection()}

          {/* Vitality Bar */}
          <View style={styles.vitalitySection}>
            <View style={styles.vitalityHeader}>
              <Text style={styles.vitalityLabel}>Vitality</Text>
              <Text style={styles.vitalityPercentage}>{vitalityPercentage}%</Text>
            </View>
            <View style={styles.vitalityBarContainer}>
              <LinearGradient
                colors={['#ff6b6b', '#ffa726', '#66bb6a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.vitalityBar, { width: `${vitalityPercentage}%` }]}
              />
            </View>
            <Text style={styles.vitalityDefinition}>vitality - the state of being strong and active</Text>
          </View>


          {/* Bottom Buttons */}
          <View style={styles.bottomSection}>
            <TouchableOpacity style={styles.bottomButton}>
              <Ionicons name="library-outline" size={20} color="#666" />
              <Text style={styles.bottomButtonText}>recent science literature and studies</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.bottomButton}>
              <Ionicons name="document-text-outline" size={20} color="#666" />
              <Text style={styles.bottomButtonText}>view patch notes</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : activeTab === 'food' ? (
        <ScrollView 
          style={styles.foodContainer}
          contentContainerStyle={styles.foodContainerContent}
          showsVerticalScrollIndicator={true}
        >
          {/* The Catalog Title */}
          <View style={styles.catalogTitleSection}>
            <Text style={styles.catalogMainTitle}>The Catalog</Text>
          </View>
          
          {/* Catalog Header with Action Buttons */}
          <View style={styles.catalogHeader}>
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowAddFoodModal(true)}
              >
                <Text style={styles.headerButtonText}>Add Food</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setShowViewDayModal(true)}
              >
                <Text style={styles.headerButtonText}>View Day</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Personalized Recommendations Section */}
          {recommendationsAvailable && (
            <View style={styles.recommendationsSection}>
              <View style={styles.recommendationsHeader}>
                <View style={styles.recommendationsTitleContainer}>
                  <Ionicons name="sparkles" size={20} color="#667eea" />
                  <Text style={styles.recommendationsTitle}>Recommended for You</Text>
                </View>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={loadRecommendations}
                  disabled={isLoadingRecommendations}
                >
                  <Ionicons 
                    name="refresh" 
                    size={18} 
                    color={isLoadingRecommendations ? "#666" : "#667eea"} 
                  />
                </TouchableOpacity>
              </View>
              
              {isLoadingRecommendations ? (
                <View style={styles.recommendationsLoading}>
                  <Text style={styles.recommendationsLoadingText}>Loading personalized recommendations...</Text>
                </View>
              ) : foodRecommendations && foodRecommendations.recommendations.length > 0 ? (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.recommendationsScroll}
                  contentContainerStyle={styles.recommendationsContent}
                >
                  {foodRecommendations.recommendations.map((rec, index) => {
                    const food = rec.food;
                    const confidenceColor = rec.confidence === 'high' ? '#4CAF50' : 
                                          rec.confidence === 'medium' ? '#FFC107' : '#FF9800';
                    
                    return (
                      <TouchableOpacity
                        key={food.fdc_id || index}
                        style={styles.recommendationCard}
                        onPress={() => {
                          setSelectedFood(food as FoodItem);
                          setShowFoodDetails(true);
                        }}
                      >
                        <View style={styles.recommendationCardHeader}>
                          <View style={[styles.gradeBadge, { 
                            backgroundColor: food.grade === 'S' ? '#000000' : 
                                           food.grade === 'A' ? '#4CAF50' : 
                                           food.grade === 'B' ? '#FFC107' : 
                                           food.grade === 'C' ? '#FF9800' : 
                                           food.grade === 'D' ? '#F44336' : '#666666' 
                          }]}>
                            <Text style={[styles.gradeText, { color: '#FFFFFF' }]}>
                              {food.grade}
                            </Text>
                          </View>
                          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor + '20' }]}>
                            <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
                            <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                              {rec.confidence}
                            </Text>
                          </View>
                        </View>
                        
                        <Text style={styles.recommendationFoodName} numberOfLines={2}>
                          {food.name}
                        </Text>
                        
                        <View style={styles.recommendationStats}>
                          <View style={styles.recommendationStat}>
                            <Ionicons name="flame" size={14} color="#ff6b6b" />
                            <Text style={styles.recommendationStatText}>
                              {food.calories ? Math.round(food.calories) : 'N/A'} cal
                            </Text>
                          </View>
                          <View style={styles.recommendationStat}>
                            <Ionicons name="barbell" size={14} color="#4CAF50" />
                            <Text style={styles.recommendationStatText}>
                              {food.protein ? food.protein.toFixed(1) : 'N/A'}g
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.recommendationScore}>
                          <Text style={styles.recommendationScoreLabel}>Match Score</Text>
                          <View style={styles.recommendationScoreBar}>
                            <LinearGradient
                              colors={['#667eea', '#764ba2']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[styles.recommendationScoreFill, { width: `${rec.score * 100}%` }]}
                            />
                          </View>
                          <Text style={styles.recommendationScoreValue}>
                            {(rec.score * 100).toFixed(0)}%
                          </Text>
                        </View>
                        
                        <Text style={styles.recommendationReason} numberOfLines={2}>
                          {rec.reason}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.recommendationsEmpty}>
                  <Text style={styles.recommendationsEmptyText}>
                    No recommendations available. Try adjusting your goals or diet type.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Prominent Search Bar */}
          <View style={styles.foodSearchContainer}>
            <View style={styles.prominentSearchBar}>
              <Ionicons name="search" size={24} color="#666" />
              <TextInput
                style={styles.prominentSearchInput}
                placeholder="Search foods..."
                placeholderTextColor="#666"
                value={foodSearchQuery}
                onChangeText={setFoodSearchQuery}
                autoFocus={false}
              />
              {foodSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFoodSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filters */}
            <View style={styles.categoryFilters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
                {['All', 'Fruits', 'Vegetables', 'Meats', 'Grains', 'Dairy', 'Nuts'].map((category) => (
                  <TouchableOpacity 
                    key={category}
                    style={[
                      styles.categoryChip,
                      selectedCategory === category && styles.activeCategoryChip
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      selectedCategory === category && styles.activeCategoryChipText
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Food List */}
          <View style={styles.foodListContainer}>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Searching through {recentFoods.length.toLocaleString()} foods...</Text>
              </View>
            ) : filteredFoods.length > 0 ? (
              <>
                <View style={styles.resultsCounter}>
                  <Text style={styles.resultsCounterText}>
                    Showing {filteredFoods.length} of {recentFoods.length.toLocaleString()} foods
                  </Text>
                </View>
                {filteredFoods.map((food: FoodItem, index: number) => (
                  <TouchableOpacity 
                    key={food.fdc_id || index} 
                    style={styles.foodItem}
                    onPress={() => {
                      setSelectedFood(food);
                      setShowFoodDetails(true);
                    }}
                  >
                    <View style={styles.foodItemLeft}>
                      <View style={[styles.gradeBadge, { backgroundColor: food.grade === 'S' ? '#000000' : food.grade === 'A' ? '#4CAF50' : food.grade === 'B' ? '#FFC107' : food.grade === 'C' ? '#FF9800' : food.grade === 'D' ? '#F44336' : '#666666' }]}>
                        <Text style={[styles.gradeText, { color: food.grade === 'S' ? '#FFFFFF' : '#FFFFFF' }]}>{food.grade}</Text>
                      </View>
                      <View style={styles.foodItemInfo}>
                        {(() => {
                          const { mainFood, cookingMethod } = parseFoodName(food.name);
                          return (
                            <>
                              <Text style={styles.foodItemName}>{mainFood}</Text>
                              {cookingMethod && (
                                <Text style={styles.foodItemCookingMethod}>{cookingMethod}</Text>
                              )}
                              <View style={styles.foodItemStats}>
                                <Text style={styles.foodItemCalories}>
                                  {food.calories ? `${Math.round(food.calories)} cal` : 'N/A'}
                                </Text>
                                {food.nutrient_density_score && (
                                  <Text style={styles.foodItemNDS}>
                                    NDS: {food.nutrient_density_score.toFixed(1)}
                                  </Text>
                                )}
                              </View>
                            </>
                          );
                        })()}
                        {food.type && <Text style={styles.foodItemType}>{food.type}</Text>}
                      </View>
                    </View>
                    <View style={styles.foodItemRight}>
                      <Ionicons name="chevron-forward" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>No foods found</Text>
                <Text style={styles.noResultsSubtext}>Try adjusting your search or filters</Text>
              </View>
            )}
          </View>

          {/* Meal History Section */}
          <View style={styles.mealHistorySection}>
            <Text style={styles.mealHistoryTitle}>Meal History</Text>
            <View style={styles.mealHistoryContainer}>
              <Text style={styles.mealHistoryPlaceholder}>
                Your meal history will appear here
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : null}

      {/* Food Details Modal */}
      {showFoodDetails && selectedFood && (() => {
            const food = selectedFood as any; // Type assertion to handle undefined properties
            return (
            <View style={styles.foodDetailsOverlay}>
              <View style={styles.foodDetailsContainer}>
                <View style={styles.foodDetailsHeader}>
                  <Text style={styles.foodDetailsTitle}>{food.name}</Text>
                <TouchableOpacity 
                    style={styles.foodDetailsCloseButton}
                    onPress={() => setShowFoodDetails(false)}
                >
                    <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
            </View>

                {/* Nutrient Density Score Display */}
        <View style={styles.nutrientScoreContainer}>
          <View style={[styles.gradeBadge, { backgroundColor: food.grade === 'S' ? '#000000' : food.grade === 'A' ? '#4CAF50' : food.grade === 'B' ? '#FFC107' : food.grade === 'C' ? '#FF9800' : food.grade === 'D' ? '#F44336' : '#666666' }]}>
                    <Text style={[styles.gradeText, { color: food.grade === 'S' ? '#FFFFFF' : '#FFFFFF' }]}>{food.grade}</Text>
                  </View>
            {(food.nutrient_density_score || food.nutrientDensityScore) && food.grade !== 'NA' && (
              <Text style={styles.nutrientScoreText}>Nutrient Density Score: {food.nutrient_density_score || food.nutrientDensityScore}</Text>
            )}
          {food.grade === 'NA' && (
            <Text style={styles.nutrientScoreText}>No energy data available for grading</Text>
          )}
                  </View>

                <ScrollView style={styles.foodDetailsContent} showsVerticalScrollIndicator={false}>
                  {/* Basic Info */}
                  <View style={styles.foodDetailsSection}>
                    <View style={styles.foodDetailsSectionHeader}>
                      <Text style={styles.foodDetailsSectionTitle}>Basic Information</Text>
                <TouchableOpacity 
                        style={styles.addFoodButton}
                        onPress={() => {
                          setSelectedFoodForAdd(selectedFood);
                          setShowAddFoodModal(true);
                        }}
                      >
                        <Text style={styles.addFoodButtonText}>Add Food</Text>
                </TouchableOpacity>
                    </View>
                    <View style={styles.foodDetailsBasicInfo}>
                      <View style={styles.foodDetailsGradeContainer}>
                        <View style={[styles.gradeBadge, { backgroundColor: selectedFood.grade === 'S' ? '#000000' : selectedFood.grade === 'A' ? '#4CAF50' : selectedFood.grade === 'B' ? '#FFC107' : selectedFood.grade === 'C' ? '#FF9800' : '#F44336' }]}>
                          <Text style={[styles.gradeText, { color: selectedFood.grade === 'S' ? '#FFFFFF' : '#FFFFFF' }]}>{selectedFood.grade}</Text>
                </View>
                        <Text style={styles.foodDetailsGradeText}>Grade</Text>
                </View>
                      <View style={styles.foodDetailsCategoryContainer}>
                        <Text style={styles.foodDetailsCategoryText}>{food.type || food.category || 'Unknown'}</Text>
                        <Text style={styles.foodDetailsCategoryLabel}>Category</Text>
          </View>
                </View>
              </View>
              
                  {/* Macronutrients */}
                  <View style={styles.foodDetailsSection}>
                    <Text style={styles.foodDetailsSectionTitle}>Macronutrients (per 100g)</Text>
                    <View style={styles.macroNutrientItem}>
                      <Text style={styles.macroNutrientLabel}>Calories</Text>
                      <View style={styles.macroNutrientBar}>
                        <View style={[styles.macroNutrientBarFill, { width: '100%', backgroundColor: '#667eea' }]} />
                      </View>
                      <Text style={styles.macroNutrientValue}>{food.calories ? Math.round(food.calories * 100) / 100 : 'N/A'}</Text>
                    </View>
                    <View style={styles.macroNutrientItem}>
                      <Text style={styles.macroNutrientLabel}>Protein</Text>
                      <View style={styles.macroNutrientBar}>
                        <View style={[styles.macroNutrientBarFill, { width: `${Math.min(100, food.dailyValuePercentages?.protein ?? 0)}%`, backgroundColor: '#4CAF50' }]} />
                      </View>
            <Text style={styles.macroNutrientValue}>
              {food.protein !== null && food.protein !== undefined ? `${food.protein.toFixed(2)}g` : 'NA'} 
              {food.dailyValuePercentages?.protein !== null && food.dailyValuePercentages?.protein !== undefined ? ` (${Math.round(food.dailyValuePercentages.protein)}% DV)` : ''}
                    </Text>
                    </View>
                    <View style={styles.macroNutrientItem}>
                      <Text style={styles.macroNutrientLabel}>Fat</Text>
                      <View style={styles.macroNutrientBar}>
                        <View style={[styles.macroNutrientBarFill, { width: `${Math.min(100, food.dailyValuePercentages?.fat ?? 0)}%`, backgroundColor: '#FF9800' }]} />
                      </View>
            <Text style={styles.macroNutrientValue}>
              {food.fat !== null && food.fat !== undefined ? `${food.fat.toFixed(2)}g` : 'NA'} 
              {food.dailyValuePercentages?.fat !== null && food.dailyValuePercentages?.fat !== undefined ? ` (${Math.round(food.dailyValuePercentages.fat)}% DV)` : ''}
            </Text>
                    </View>
                    <View style={styles.macroNutrientItem}>
                      <Text style={styles.macroNutrientLabel}>Carbohydrates</Text>
                      <View style={styles.macroNutrientBar}>
                        <View style={[styles.macroNutrientBarFill, { width: `${Math.min(100, food.dailyValuePercentages?.carbohydrates ?? 0)}%`, backgroundColor: '#2196F3' }]} />
                      </View>
            <Text style={styles.macroNutrientValue}>
              {(selectedFood.carbohydrates || selectedFood.carbohydrate) !== null && (selectedFood.carbohydrates || selectedFood.carbohydrate) !== undefined ? `${((selectedFood.carbohydrates || selectedFood.carbohydrate) as number).toFixed(2)}g` : 'NA'} 
              {food.dailyValuePercentages?.carbohydrates !== null && food.dailyValuePercentages?.carbohydrates !== undefined ? ` (${Math.round(food.dailyValuePercentages.carbohydrates)}% DV)` : ''}
            </Text>
                    </View>
                    <View style={styles.macroNutrientItem}>
                      <Text style={styles.macroNutrientLabel}>Fiber</Text>
                      <View style={styles.macroNutrientBar}>
                        <View style={[styles.macroNutrientBarFill, { width: `${Math.min(100, food.dailyValuePercentages?.fiber ?? 0)}%`, backgroundColor: '#9C27B0' }]} />
                      </View>
            <Text style={styles.macroNutrientValue}>
              {selectedFood.fiber !== null && selectedFood.fiber !== undefined ? `${selectedFood.fiber.toFixed(2)}g` : 'NA'} 
              {food.dailyValuePercentages?.fiber !== null && food.dailyValuePercentages?.fiber !== undefined ? ` (${Math.round(food.dailyValuePercentages.fiber)}% DV)` : ''}
            </Text>
            </View>
          </View>

                  {/* Vitamins */}
                  <View style={styles.foodDetailsSection}>
                    <Text style={styles.foodDetailsSectionTitle}>Vitamins (Daily Value %)</Text>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin C</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin C, total ascorbic acid']?.amount || 0) / 90 * 100) + '%' } as any]} />
                  </View>
                      <Text style={styles.vitaminValue}>
                        {food.nutrients?.['Vitamin C, total ascorbic acid']?.amount ? Math.round((food.nutrients['Vitamin C, total ascorbic acid'].amount / 90) * 100) + '%' : 'NA'}
                      </Text>
                  </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin A</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin A, RAE']?.amount || 0) / 900 * 100) + '%' } as any]} />
                </View>
                      <Text style={styles.vitaminValue}>
                        {food.nutrients?.['Vitamin A, RAE']?.amount ? Math.round((food.nutrients['Vitamin A, RAE'].amount / 900) * 100) + '%' : 'NA'}
                      </Text>
                </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin D</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin D (D2 + D3)']?.amount || 0) / 20 * 100) + '%' } as any]} />
          </View>
                      <Text style={styles.vitaminValue}>
                        {food.nutrients?.['Vitamin D (D2 + D3)']?.amount ? Math.round((food.nutrients['Vitamin D (D2 + D3)'].amount / 20) * 100) + '%' : 'NA'}
                      </Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin E</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin E (alpha-tocopherol)']?.amount || 0) / 15 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>
                        {food.nutrients?.['Vitamin E (alpha-tocopherol)']?.amount ? Math.round((food.nutrients['Vitamin E (alpha-tocopherol)'].amount / 15) * 100) + '%' : 'NA'}
                      </Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin K</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin K (phylloquinone)']?.amount || 0) / 120 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>
                        {food.nutrients?.['Vitamin K (phylloquinone)']?.amount ? Math.round((food.nutrients['Vitamin K (phylloquinone)'].amount / 120) * 100) + '%' : 'NA'}
                      </Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Thiamin (B1)</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Thiamin']?.amount || 0) / 1.2 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Thiamin']?.amount ? Math.round((food.nutrients['Thiamin'].amount / 1.2) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Riboflavin (B2)</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Riboflavin']?.amount || 0) / 1.3 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Riboflavin']?.amount ? Math.round((food.nutrients['Riboflavin'].amount / 1.3) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Niacin (B3)</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Niacin']?.amount || 0) / 16 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Niacin']?.amount ? Math.round((food.nutrients['Niacin'].amount / 16) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin B6</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin B-6']?.amount || 0) / 1.7 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Vitamin B-6']?.amount ? Math.round((food.nutrients['Vitamin B-6'].amount / 1.7) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Folate (B9)</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Folate, total']?.amount || 0) / 400 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Folate, total']?.amount ? Math.round((food.nutrients['Folate, total'].amount / 400) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.vitaminItem}>
                      <Text style={styles.vitaminLabel}>Vitamin B12</Text>
                      <View style={styles.vitaminBar}>
                        <View style={[styles.vitaminBarFill, { width: Math.min(100, (food.nutrients?.['Vitamin B-12']?.amount || 0) / 2.4 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.vitaminValue}>{food.nutrients?.['Vitamin B-12']?.amount ? Math.round((food.nutrients['Vitamin B-12'].amount / 2.4) * 100) : 0}%</Text>
                    </View>
                  </View>

                  {/* Minerals */}
                  <View style={styles.foodDetailsSection}>
                    <Text style={styles.foodDetailsSectionTitle}>Minerals (Daily Value %)</Text>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Calcium</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Calcium, Ca']?.amount || 0) / 1000 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Calcium, Ca']?.amount ? Math.round((food.nutrients['Calcium, Ca'].amount / 1000) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Iron</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Iron, Fe']?.amount || 0) / 18 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Iron, Fe']?.amount ? Math.round((food.nutrients['Iron, Fe'].amount / 18) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Magnesium</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Magnesium, Mg']?.amount || 0) / 400 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Magnesium, Mg']?.amount ? Math.round((food.nutrients['Magnesium, Mg'].amount / 400) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Phosphorus</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Phosphorus, P']?.amount || 0) / 700 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Phosphorus, P']?.amount ? Math.round((food.nutrients['Phosphorus, P'].amount / 700) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Potassium</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Potassium, K']?.amount || 0) / 3500 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Potassium, K']?.amount ? Math.round((food.nutrients['Potassium, K'].amount / 3500) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Zinc</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Zinc, Zn']?.amount || 0) / 11 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Zinc, Zn']?.amount ? Math.round((food.nutrients['Zinc, Zn'].amount / 11) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Copper</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Copper, Cu']?.amount || 0) / 0.9 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Copper, Cu']?.amount ? Math.round((food.nutrients['Copper, Cu'].amount / 0.9) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Manganese</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Manganese, Mn']?.amount || 0) / 2.3 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Manganese, Mn']?.amount ? Math.round((food.nutrients['Manganese, Mn'].amount / 2.3) * 100) : 0}%</Text>
                    </View>
                    <View style={styles.mineralItem}>
                      <Text style={styles.mineralLabel}>Selenium</Text>
                      <View style={styles.mineralBar}>
                        <View style={[styles.mineralBarFill, { width: Math.min(100, (food.nutrients?.['Selenium, Se']?.amount || 0) / 55 * 100) + '%' } as any]} />
                      </View>
                      <Text style={styles.mineralValue}>{food.nutrients?.['Selenium, Se']?.amount ? Math.round((food.nutrients['Selenium, Se'].amount / 55) * 100) : 0}%</Text>
                    </View>
                  </View>

                  {/* Additional Nutrients */}
                  <View style={styles.foodDetailsSection}>
                    <Text style={styles.foodDetailsSectionTitle}>Additional Nutrients</Text>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Water</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.water?.toFixed(1) || 0}g</Text>
                    </View>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Ash</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.ash?.toFixed(1) || 0}g</Text>
                    </View>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Saturated Fat</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.saturatedFat?.toFixed(1) || 0}g</Text>
                    </View>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Monounsaturated Fat</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.monounsaturatedFat?.toFixed(1) || 0}g</Text>
                    </View>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Polyunsaturated Fat</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.polyunsaturatedFat?.toFixed(1) || 0}g</Text>
                    </View>
                    <View style={styles.additionalNutrientItem}>
                      <Text style={styles.additionalNutrientLabel}>Cholesterol</Text>
                      <Text style={styles.additionalNutrientValue}>{selectedFood.cholesterol?.toFixed(0) || 0}mg</Text>
                    </View>
                    {food.caffeine > 0 && (
                      <View style={styles.additionalNutrientItem}>
                        <Text style={styles.additionalNutrientLabel}>Caffeine</Text>
                        <Text style={styles.additionalNutrientValue}>{food.caffeine?.toFixed(0) || 0}mg</Text>
                      </View>
                    )}
                    {food.theobromine > 0 && (
                      <View style={styles.additionalNutrientItem}>
                        <Text style={styles.additionalNutrientLabel}>Theobromine</Text>
                        <Text style={styles.additionalNutrientValue}>{food.theobromine?.toFixed(0) || 0}mg</Text>
                      </View>
                    )}
                    {food.alcohol > 0 && (
                      <View style={styles.additionalNutrientItem}>
                        <Text style={styles.additionalNutrientLabel}>Alcohol</Text>
                        <Text style={styles.additionalNutrientValue}>{food.alcohol?.toFixed(1) || 0}g</Text>
                      </View>
                    )}
                  </View>

          </ScrollView>
          </View>
        </View>
        );
      })()}

      {/* Add Food Modal */}
      {showAddFoodModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.addFoodModalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add Food to Your Day</Text>
              <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setShowAddFoodModal(false);
                      setSelectedFoodForAdd(null);
                      setGramInput('');
                    }}
                  >
                    <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {selectedFoodForAdd ? (
                    <View>
                      <Text style={styles.selectedFoodName}>{selectedFoodForAdd.name}</Text>
                      <Text style={styles.selectedFoodInfo}>
                        {selectedFoodForAdd.calories ? `${Math.round(selectedFoodForAdd.calories)} cal` : 'N/A'} per 100g
                      </Text>
                      
                      <View style={styles.gramInputContainer}>
                        <Text style={styles.gramInputLabel}>Enter amount (grams):</Text>
                        <TextInput
                          style={styles.gramInput}
                          placeholder="100"
                          placeholderTextColor="#666"
                          value={gramInput}
                          onChangeText={setGramInput}
                          keyboardType="numeric"
                        />
                      </View>

                      {/* Real-time Nutrient Preview */}
                      {gramInput && parseFloat(gramInput) > 0 && (
                        <View style={styles.nutrientPreviewSection}>
                          <Text style={styles.nutrientPreviewTitle}>
                            Nutrient Preview ({gramInput}g)
                          </Text>
                          <View style={styles.nutrientPreviewGrid}>
                            {/* Calories */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Calories</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {Math.round((selectedFoodForAdd.calories || 0) * (parseFloat(gramInput) || 0) / 100)} cal
                              </Text>
                            </View>
                            
                            {/* Protein */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Protein</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {selectedFoodForAdd.nutrients?.['Protein']?.amount ? 
                                  ((selectedFoodForAdd.nutrients['Protein'].amount * (parseFloat(gramInput) || 0) / 100)).toFixed(1) + 'g' : 'N/A'}
                              </Text>
                            </View>
                            
                            {/* Fat */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Fat</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {selectedFoodForAdd.nutrients?.['Total lipid (fat)']?.amount ? 
                                  ((selectedFoodForAdd.nutrients['Total lipid (fat)'].amount * (parseFloat(gramInput) || 0) / 100)).toFixed(1) + 'g' : 'N/A'}
                              </Text>
                            </View>
                            
                            {/* Carbs */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Carbs</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {selectedFoodForAdd.nutrients?.['Carbohydrate, by difference']?.amount ? 
                                  ((selectedFoodForAdd.nutrients['Carbohydrate, by difference'].amount * (parseFloat(gramInput) || 0) / 100)).toFixed(1) + 'g' : 'N/A'}
                              </Text>
                            </View>
                            
                            {/* Fiber */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Fiber</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {selectedFoodForAdd.nutrients?.['Fiber, total dietary']?.amount ? 
                                  ((selectedFoodForAdd.nutrients['Fiber, total dietary'].amount * (parseFloat(gramInput) || 0) / 100)).toFixed(1) + 'g' : 'N/A'}
                              </Text>
                            </View>
                            
                            {/* Vitamin C */}
                            <View style={styles.nutrientPreviewItem}>
                              <Text style={styles.nutrientPreviewLabel}>Vitamin C</Text>
                              <Text style={styles.nutrientPreviewValue}>
                                {selectedFoodForAdd.nutrients?.['Vitamin C, total ascorbic acid']?.amount ? 
                                  ((selectedFoodForAdd.nutrients['Vitamin C, total ascorbic acid'].amount * (parseFloat(gramInput) || 0) / 100)).toFixed(1) + 'mg' : 'N/A'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}

                  <TouchableOpacity 
                        style={styles.addToDayButton}
                        onPress={() => {
                          const grams = parseFloat(gramInput) || 100;
                          const scaleFactor = grams / 100;
                          
                          // Scale all nutrients
                          const scaledNutrients: any = {};
                          if (selectedFoodForAdd.nutrients) {
                            Object.keys(selectedFoodForAdd.nutrients).forEach(nutrientName => {
                              const nutrient = selectedFoodForAdd.nutrients![nutrientName];
                              if (nutrient && nutrient.amount !== null && nutrient.amount !== undefined) {
                                scaledNutrients[nutrientName] = {
                                  ...nutrient,
                                  amount: nutrient.amount * scaleFactor
                                };
                              }
                            });
                          }

                          // Add to day
                          const foodEntry = {
                            food: selectedFoodForAdd,
                            grams: grams,
                            scaledCalories: (selectedFoodForAdd.calories || 0) * scaleFactor,
                            scaledNutrients: scaledNutrients,
                            timestamp: new Date().toISOString()
                          };

                          setDayFoods([...dayFoods, foodEntry]);
                          setDayCalories(dayCalories + foodEntry.scaledCalories);

                          // Merge nutrients
                          const newDayNutrients = { ...dayNutrients };
                          Object.keys(scaledNutrients).forEach(nutrientName => {
                            if (!newDayNutrients[nutrientName]) {
                              newDayNutrients[nutrientName] = { ...scaledNutrients[nutrientName] };
                            } else {
                              newDayNutrients[nutrientName].amount += scaledNutrients[nutrientName].amount;
                            }
                          });
                          setDayNutrients(newDayNutrients);

                          // Close modal
                          setShowAddFoodModal(false);
                          setSelectedFoodForAdd(null);
                          setGramInput('');
                          
                          Alert.alert('Success', `Added ${grams}g of ${selectedFoodForAdd.name} to your day!`);
                        }}
                      >
                        <Text style={styles.addToDayButtonText}>Add to Day</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <Text style={styles.selectFoodPrompt}>Select a food from the catalog:</Text>
                      <View style={styles.modalSearchBar}>
                        <Ionicons name="search" size={20} color="#666" />
                        <TextInput
                          style={styles.modalSearchInput}
                          placeholder="Search foods..."
                          placeholderTextColor="#666"
                          value={foodSearchQuery}
                          onChangeText={setFoodSearchQuery}
                        />
                      </View>
                      <ScrollView style={styles.modalFoodList}>
                        {filteredFoods.slice(0, 50).map((food, index) => (
                          <TouchableOpacity
                            key={food.fdc_id || index}
                            style={styles.modalFoodItem}
                            onPress={() => {
                              setSelectedFoodForAdd(food);
                              setGramInput('100');
                            }}
                          >
                            <View style={styles.modalFoodItemLeft}>
                              <View style={[styles.smallGradeBadge, { backgroundColor: food.grade === 'S' ? '#000000' : food.grade === 'A' ? '#4CAF50' : food.grade === 'B' ? '#FFC107' : food.grade === 'C' ? '#FF9800' : '#F44336' }]}>
                                <Text style={styles.smallGradeText}>{food.grade}</Text>
                              </View>
                              <Text style={styles.modalFoodItemName}>{food.name}</Text>
                            </View>
                            <Text style={styles.modalFoodItemCalories}>
                              {food.calories ? `${Math.round(food.calories)} cal` : 'N/A'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
                  )}
                </ScrollView>
          </View>
            </View>
          )}

      {/* View Day Modal */}
      {showViewDayModal && (
            <View style={styles.modalOverlay}>
              <View style={styles.viewDayModalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Your Day</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowViewDayModal(false)}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                  </View>

                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {/* Vitality Bar */}
                  <View style={styles.vitalityBarSection}>
                    <Text style={styles.vitalityBarTitle}>Vitality Bar</Text>
                    <View style={styles.vitalityBarContainer}>
                      <View 
                        style={[
                          styles.vitalityBarFill, 
                          { 
                            width: `${(() => {
                              // Calculate vitality percentage based on nutrient completeness
                              const essentialNutrients = [
                                'Protein', 'Vitamin A, RAE', 'Vitamin C, total ascorbic acid', 'Vitamin D (D2 + D3)',
                                'Vitamin E (alpha-tocopherol)', 'Vitamin K (phylloquinone)', 'Thiamin', 'Riboflavin',
                                'Niacin', 'Vitamin B-6', 'Folate, total', 'Vitamin B-12', 'Calcium, Ca', 'Iron, Fe',
                                'Magnesium, Mg', 'Phosphorus, P', 'Potassium, K', 'Zinc, Zn'
                              ];
                              
                              const dailyValues: any = {
                                'Protein': 50, 'Vitamin A, RAE': 900, 'Vitamin C, total ascorbic acid': 90,
                                'Vitamin D (D2 + D3)': 20, 'Vitamin E (alpha-tocopherol)': 15,
                                'Vitamin K (phylloquinone)': 120, 'Thiamin': 1.2, 'Riboflavin': 1.3,
                                'Niacin': 16, 'Vitamin B-6': 1.7, 'Folate, total': 400, 'Vitamin B-12': 2.4,
                                'Calcium, Ca': 1300, 'Iron, Fe': 18, 'Magnesium, Mg': 420, 'Phosphorus, P': 1250,
                                'Potassium, K': 4700, 'Zinc, Zn': 11
                              };

                              let totalPercentage = 0;
                              let nutrientCount = 0;

                              essentialNutrients.forEach(nutrient => {
                                if (dayNutrients[nutrient] && dailyValues[nutrient]) {
                                  const percentage = Math.min(100, (dayNutrients[nutrient].amount / dailyValues[nutrient]) * 100);
                                  totalPercentage += percentage;
                                  nutrientCount++;
                                }
                              });

                              return nutrientCount > 0 ? Math.round(totalPercentage / essentialNutrients.length) : 0;
                            })()}%`
                          }
                        ]} 
                      />
                  </View>
                    <Text style={styles.vitalityBarPercentage}>
                      {(() => {
                        const essentialNutrients = [
                          'Protein', 'Vitamin A, RAE', 'Vitamin C, total ascorbic acid', 'Vitamin D (D2 + D3)',
                          'Vitamin E (alpha-tocopherol)', 'Vitamin K (phylloquinone)', 'Thiamin', 'Riboflavin',
                          'Niacin', 'Vitamin B-6', 'Folate, total', 'Vitamin B-12', 'Calcium, Ca', 'Iron, Fe',
                          'Magnesium, Mg', 'Phosphorus, P', 'Potassium, K', 'Zinc, Zn'
                        ];
                        
                        const dailyValues: any = {
                          'Protein': 50, 'Vitamin A, RAE': 900, 'Vitamin C, total ascorbic acid': 90,
                          'Vitamin D (D2 + D3)': 20, 'Vitamin E (alpha-tocopherol)': 15,
                          'Vitamin K (phylloquinone)': 120, 'Thiamin': 1.2, 'Riboflavin': 1.3,
                          'Niacin': 16, 'Vitamin B-6': 1.7, 'Folate, total': 400, 'Vitamin B-12': 2.4,
                          'Calcium, Ca': 1300, 'Iron, Fe': 18, 'Magnesium, Mg': 420, 'Phosphorus, P': 1250,
                          'Potassium, K': 4700, 'Zinc, Zn': 11
                        };

                        let totalPercentage = 0;
                        let nutrientCount = 0;

                        essentialNutrients.forEach(nutrient => {
                          if (dayNutrients[nutrient] && dailyValues[nutrient]) {
                            const percentage = Math.min(100, (dayNutrients[nutrient].amount / dailyValues[nutrient]) * 100);
                            totalPercentage += percentage;
                            nutrientCount++;
                          }
                        });

                        return nutrientCount > 0 ? Math.round(totalPercentage / essentialNutrients.length) : 0;
                      })()}% Complete
                    </Text>
                </View>

                  {/* Daily Summary */}
                  <View style={styles.daySummarySection}>
                    <Text style={styles.daySummaryTitle}>Daily Summary</Text>
                    <View style={styles.daySummaryItem}>
                      <Text style={styles.daySummaryLabel}>Total Calories:</Text>
                      <Text style={styles.daySummaryValue}>{Math.round(dayCalories)} kcal</Text>
                </View>
                    <View style={styles.daySummaryItem}>
                      <Text style={styles.daySummaryLabel}>Foods Eaten:</Text>
                      <Text style={styles.daySummaryValue}>{dayFoods.length}</Text>
                    </View>
                    {/* Save Day to Meal History */}
                    <TouchableOpacity
                      style={styles.saveDayButton}
                      onPress={() => {
                        // Convert current dayNutrients to %DV snapshot and save
                        const dailyValues: any = {
                          'Protein': 50, 'Vitamin A, RAE': 900, 'Vitamin C, total ascorbic acid': 90,
                          'Vitamin D (D2 + D3)': 20, 'Vitamin E (alpha-tocopherol)': 15,
                          'Vitamin K (phylloquinone)': 120, 'Thiamin': 1.2, 'Riboflavin': 1.3,
                          'Niacin': 16, 'Vitamin B-6': 1.7, 'Folate, total': 400, 'Vitamin B-12': 2.4,
                          'Calcium, Ca': 1300, 'Iron, Fe': 18, 'Magnesium, Mg': 420, 'Phosphorus, P': 1250,
                          'Potassium, K': 4700, 'Zinc, Zn': 11, 'Fiber, total dietary': 28,
                          'Total lipid (fat)': 78, 'Carbohydrate, by difference': 275,
                          'Copper, Cu': 0.9, 'Manganese, Mn': 2.3, 'Selenium, Se': 55
                        };
                        const percent: any = {};
                        Object.keys(dayNutrients || {}).forEach(n => {
                          const dv = dailyValues[n];
                          const amt = dayNutrients[n]?.amount;
                          if (dv && amt !== undefined) {
                            percent[n] = Math.min(200, (amt / dv) * 100);
                          }
                        });
                        const todayIso = new Date().toISOString().split('T')[0];
                        const entry = { date: todayIso, nutrients: percent };
                        setMealHistory(prev => [entry, ...prev]);
                        Alert.alert('Saved', 'Day added to weekly meal history for Insights.');
                      }}
                    >
                      <Text style={styles.saveDayButtonText}>Save Day to Meal History</Text>
              </TouchableOpacity>
                  </View>

                  {/* Foods List */}
                  {dayFoods.length > 0 ? (
                    <View style={styles.dayFoodsSection}>
                      <Text style={styles.dayFoodsSectionTitle}>Foods Consumed</Text>
                      {dayFoods.map((entry, index) => (
                        <View key={index} style={styles.dayFoodItem}>
                          <View style={styles.dayFoodItemLeft}>
                            <Text style={styles.dayFoodItemName}>{entry.food.name}</Text>
                            <Text style={styles.dayFoodItemAmount}>{entry.grams}g</Text>
                          </View>
                          <Text style={styles.dayFoodItemCalories}>
                            {Math.round(entry.scaledCalories)} cal
                          </Text>
                        </View>
            ))}
          </View>
                  ) : (
                    <View style={styles.emptyDayContainer}>
                      <Text style={styles.emptyDayText}>No foods added yet</Text>
                      <Text style={styles.emptyDaySubtext}>Start adding foods to track your nutrition!</Text>
                    </View>
                  )}

                  {/* Categorized Nutrient Breakdown */}
                  {Object.keys(dayNutrients).length > 0 && (() => {
                    const dailyValues: any = {
                      'Protein': 50, 'Vitamin A, RAE': 900, 'Vitamin C, total ascorbic acid': 90,
                      'Vitamin D (D2 + D3)': 20, 'Vitamin E (alpha-tocopherol)': 15,
                      'Vitamin K (phylloquinone)': 120, 'Thiamin': 1.2, 'Riboflavin': 1.3,
                      'Niacin': 16, 'Vitamin B-6': 1.7, 'Folate, total': 400, 'Vitamin B-12': 2.4,
                      'Calcium, Ca': 1300, 'Iron, Fe': 18, 'Magnesium, Mg': 420, 'Phosphorus, P': 1250,
                      'Potassium, K': 4700, 'Zinc, Zn': 11, 'Fiber, total dietary': 28,
                      'Total lipid (fat)': 78, 'Carbohydrate, by difference': 275,
                      'Copper, Cu': 0.9, 'Manganese, Mn': 2.3, 'Selenium, Se': 55
                    };

                    const categorizeNutrient = (nutrientName: string) => {
                      const macroNutrients = ['Protein', 'Total lipid (fat)', 'Carbohydrate, by difference', 'Fiber, total dietary'];
                      const vitamins = ['Vitamin A, RAE', 'Vitamin C, total ascorbic acid', 'Vitamin D (D2 + D3)', 'Vitamin E (alpha-tocopherol)', 'Vitamin K (phylloquinone)', 'Thiamin', 'Riboflavin', 'Niacin', 'Vitamin B-6', 'Folate, total', 'Vitamin B-12'];
                      const minerals = ['Calcium, Ca', 'Iron, Fe', 'Magnesium, Mg', 'Phosphorus, P', 'Potassium, K', 'Zinc, Zn', 'Copper, Cu', 'Manganese, Mn', 'Selenium, Se'];
                      
                      if (macroNutrients.includes(nutrientName)) return 'Macronutrients';
                      if (vitamins.includes(nutrientName)) return 'Vitamins';
                      if (minerals.includes(nutrientName)) return 'Minerals';
                      return 'Miscellaneous';
                    };

                    const categories: { [key: string]: any[] } = {
                      'Macronutrients': [],
                      'Vitamins': [],
                      'Minerals': [],
                      'Miscellaneous': []
                    };

                    Object.keys(dayNutrients).forEach(nutrientName => {
                      const category = categorizeNutrient(nutrientName);
                      const nutrient = dayNutrients[nutrientName];
                      const dailyValue = dailyValues[nutrientName];
                      const percentage = dailyValue ? Math.min(100, (nutrient.amount / dailyValue) * 100) : 0;
                      
                      categories[category].push({
                        name: nutrientName,
                        nutrient,
                        percentage,
                        dailyValue
                      });
                    });

                    return (
                      <View style={styles.nutrientBreakdownSection}>
                        <Text style={styles.nutrientBreakdownTitle}>Nutrient Breakdown</Text>
                        
                        {Object.keys(categories).map(categoryName => {
                          const categoryNutrients = categories[categoryName];
                          if (categoryNutrients.length === 0) return null;

                          return (
                            <View key={categoryName} style={styles.nutrientCategorySection}>
                              <Text style={styles.nutrientCategoryTitle}>{categoryName}</Text>
                              <View style={styles.nutrientCategoryGrid}>
                                {categoryNutrients.map((item: any, index: number) => (
                                  <View key={index} style={styles.nutrientCategoryItem}>
                                    <Text style={styles.nutrientCategoryLabel}>{item.name}</Text>
                                    <View style={styles.nutrientCategoryBar}>
                                      <View 
                                        style={[
                                          styles.nutrientCategoryBarFill, 
                                          { width: `${item.percentage}%` }
                                        ]} 
                                      />
                                    </View>
                                    <Text style={styles.nutrientCategoryValue}>
                                      {item.nutrient.amount.toFixed(1)} {item.nutrient.unit}
                                      {item.dailyValue && ` (${Math.round(item.percentage)}% DV)`}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}
        </ScrollView>
          </View>
        </View>
      )}

      {/* Lifts Tab */}
      {activeTab === 'lifts' && (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Workout Templates Section */}
          {renderTemplateSection()}

          {/* Exercise Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor="#666"
                value={exerciseSearchQuery}
                onChangeText={setExerciseSearchQuery}
              />
              <TouchableOpacity onPress={() => setShowExerciseSearch(!showExerciseSearch)}>
                <Ionicons name={showExerciseSearch ? "chevron-up" : "chevron-down"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Inline Expanded Content */}
            {showExerciseSearch && (
              <>
                {/* Equipment Filter */}
                <View style={styles.exerciseFilterSectionEquipment}>
                  <Text style={styles.exerciseFilterLabel}>Equipment</Text>
                  <TouchableOpacity 
                    style={styles.dropdownButton}
                    onPress={() => setShowEquipmentDropdown(!showEquipmentDropdown)}
                  >
                    <Text style={styles.dropdownButtonText}>{selectedEquipment}</Text>
                    <Ionicons 
                      name={showEquipmentDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                  
                  {showEquipmentDropdown && (
                    <View style={styles.dropdownMenuEquipment}>
                      <ScrollView 
                        style={styles.dropdownScrollView}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                    {['All', 'Barbell', 'Body Weight', 'Cable', 'Dumbbell', 'Smith', 'Weighted', 'Other'].map((equipment) => (
                      <TouchableOpacity 
                        key={equipment}
                            style={[styles.dropdownItem, selectedEquipment === equipment && styles.activeDropdownItem]}
                            onPress={() => {
                              setSelectedEquipment(equipment);
                              setShowEquipmentDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, selectedEquipment === equipment && styles.activeDropdownItemText]}>
                          {equipment}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                    </View>
                  )}
                </View>

                {/* Target Muscle Filter */}
                <View style={styles.exerciseFilterSectionMuscle}>
                  <Text style={styles.exerciseFilterLabel}>Target Muscle</Text>
                  <TouchableOpacity 
                    style={styles.dropdownButton}
                    onPress={() => setShowMuscleDropdown(!showMuscleDropdown)}
                  >
                    <Text style={styles.dropdownButtonText}>{selectedTargetMuscle}</Text>
                    <Ionicons 
                      name={showMuscleDropdown ? "chevron-up" : "chevron-down"} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                  
                  {showMuscleDropdown && (
                    <View style={styles.dropdownMenuMuscle}>
                      <ScrollView 
                        style={styles.dropdownScrollView}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled={true}
                      >
                    {['All', 'Anterior Deltoid', 'Biceps Brachii', 'Brachialis', 'Brachioradialis', 'Gastrocnemius', 'Gluteus Maximus', 'Hamstrings', 'Hip Abductors', 'Hip Adductors', 'Hip Flexors', 'Infraspinatus', 'Lateral Deltoid', 'Latissimus Dorsi', 'Levator Scapulae', 'Lower Trapezius', 'Middle', 'Middle Trapezius', 'Obliques', 'Pectoralis Major Clavicular', 'Pectoralis Major Sternal'].map((muscle) => (
                      <TouchableOpacity 
                        key={muscle}
                            style={[styles.dropdownItem, selectedTargetMuscle === muscle && styles.activeDropdownItem]}
                            onPress={() => {
                              setSelectedTargetMuscle(muscle);
                              setShowMuscleDropdown(false);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, selectedTargetMuscle === muscle && styles.activeDropdownItemText]}>
                          {muscle}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                    </View>
                  )}
                </View>

                {/* Exercise Results */}
                <View style={styles.exerciseResults}>
                  {exercises
                    .filter(exercise => 
                      exercise.name.toLowerCase().includes(exerciseSearchQuery.toLowerCase()) &&
                      (selectedEquipment === 'All' || exercise.equipment === selectedEquipment) &&
                      (selectedTargetMuscle === 'All' || exercise.targetMuscle === selectedTargetMuscle)
                    )
                    .map((exercise) => (
                      <TouchableOpacity key={exercise.id} style={styles.exerciseItem}>
                        <View style={styles.exerciseItemLeft}>
                          <Text style={styles.exerciseEmoji}>{exercise.emoji}</Text>
                          <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                            <Text style={styles.exerciseEquipment}>{exercise.equipment}</Text>
                            <Text style={styles.exerciseTargetMuscle}>{exercise.targetMuscle}</Text>
                            <Text style={styles.exerciseDifficulty}>Difficulty: {exercise.difficulty}/5</Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={styles.addExerciseButton}
                          onPress={() => handleSelectExercise(exercise)}
                        >
                          <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                </View>
              </>
            )}
          </View>

          {/* Workout History */}
          <View style={styles.workoutHistorySection}>
            <Text style={styles.workoutHistoryTitle}>Workout History</Text>
            {workoutHistory.map((workout) => (
              <View key={workout.id} style={styles.workoutHistoryItem}>
                <View style={styles.workoutHistoryHeader}>
                  <Text style={styles.workoutHistoryDate}>{workout.date}</Text>
                  <Text style={styles.workoutHistoryTemplate}>{workout.templateName}</Text>
                </View>
                <View style={styles.workoutHistoryExercises}>
                  {workout.exercises.map((exercise: any, index: number) => (
                    <View key={index} style={styles.workoutHistoryExercise}>
                      <Text style={styles.workoutHistoryExerciseName}>{exercise.name}</Text>
                      <Text style={styles.workoutHistoryExerciseDetails}>
                        {Array.isArray(exercise.sets) 
                          ? exercise.sets.map((set: any, i: number) => `${set.weight}lbs × ${set.reps}`).join(', ')
                          : `${exercise.weight}lbs × ${exercise.reps} × ${exercise.sets}`
                        }
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Patch Tab */}
      {activeTab === 'patch' && (
        <View style={styles.patchNotesContainer}>
          {/* Patch Notes Header with Dark Gray Background */}
          <View style={styles.patchNotesHeader}>
            <Text style={styles.patchNotesTitle}>Patch Notes</Text>
          </View>
          
          {/* Patch Notes Content */}
          <ScrollView 
            style={styles.patchNotesScrollContainer}
            contentContainerStyle={styles.patchNotesScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {patchNotes.map((patch) => (
              <TouchableOpacity 
                key={patch.id} 
                style={styles.patchNoteItem}
                onPress={() => setExpandedPatchId(expandedPatchId === patch.id ? null : patch.id)}
              >
                {/* Patch Image */}
                <View style={styles.patchImageContainer}>
                  <Text style={styles.patchImage}>{patch.image}</Text>
                </View>
                
                {/* Patch Info */}
                <View style={styles.patchInfo}>
                  <View style={styles.patchMeta}>
                    <Text style={styles.patchCategory}>{patch.category}</Text>
                    <Text style={styles.patchSeparator}> | </Text>
                    <Text style={styles.patchDate}>{patch.date}</Text>
                  </View>
                  
                  <Text style={styles.patchVersion}>{patch.version}</Text>
                  
                  <Text style={styles.patchTitle}>{patch.title}</Text>
                  
                  {/* Show content only when expanded */}
                  {expandedPatchId === patch.id && (
                    <View style={styles.expandedContent}>
                      <Text style={styles.patchContent}>{patch.content}</Text>
                      <View style={styles.expandIndicator}>
                        <Ionicons name="chevron-up" size={20} color="#666" />
                        <Text style={styles.expandText}>Tap to collapse</Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Show expand indicator when collapsed */}
                  {expandedPatchId !== patch.id && (
                    <View style={styles.expandIndicator}>
                      <Ionicons name="chevron-down" size={20} color="#666" />
                      <Text style={styles.expandText}>Tap to expand</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Template Start Popup - Strong Style */}
      {showTemplatePopup && selectedTemplate && (
        <View style={styles.popupOverlay}>
          <View style={styles.strongPopupContainer}>
            {/* Header */}
            <View style={styles.strongPopupHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setShowTemplatePopup(false);
                  setSelectedTemplate(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
              
              <Text style={styles.strongPopupTitle}>{selectedTemplate.name}</Text>
              
              <TouchableOpacity style={styles.editButton}>
                <Ionicons name="create-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Exercise List */}
            <ScrollView style={styles.strongExerciseList}>
              {selectedTemplate.exercises.map((exercise: any, index: number) => (
                <View key={exercise.id} style={styles.strongExerciseItem}>
                  <View style={styles.strongExerciseInfo}>
                    <Text style={styles.strongExerciseName}>{exercise.name}</Text>
                    <Text style={styles.strongExerciseDetails}>
                      {Array.isArray(exercise.sets) 
                        ? `${exercise.sets.length} sets: ${exercise.sets.map((set: any) => `${set.weight}lbs × ${set.reps}`).join(', ')}`
                        : `${exercise.sets} sets × ${exercise.reps} reps @ ${exercise.weight}lbs`
                      }
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              ))}
            </ScrollView>
            
            {/* Action Buttons */}
            <View style={styles.strongButtonContainer}>
              <TouchableOpacity 
                style={styles.strongCancelButton}
                onPress={() => {
                  setShowTemplatePopup(false);
                  setSelectedTemplate(null);
                }}
              >
                <Text style={styles.strongCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.strongStartButton}
                onPress={() => {
                  // Deep clone the template to allow editing during workout
                  const workoutCopy = JSON.parse(JSON.stringify(selectedTemplate));
                  setActiveWorkout(workoutCopy);
                  setWorkoutStartTime(new Date());
                  setShowWorkoutOverlay(true);
                  setShowTemplatePopup(false);
                  setSelectedTemplate(null);
                  setIsMinimized(false);
                  // Clear previous workout data (but keep history!)
                  setCompletedSets({});
                  // Reset popup to maximized position (10% down from top)
                  popupTranslateY.setValue(Dimensions.get('window').height * 0.1);
                }}
              >
                <Text style={styles.strongStartButtonText}>Start Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Active Workout Screen - Swipeable Popup */}
      {activeWorkout && showWorkoutOverlay && (
        <Animated.View 
          style={[
            styles.workoutPopupOverlay,
            {
              backgroundColor: popupTranslateY.interpolate({
                inputRange: [Dimensions.get('window').height * 0.1, Dimensions.get('window').height * 0.8],
                outputRange: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.5)'],
                extrapolate: 'clamp',
              })
            }
          ]}
          pointerEvents={isMinimized ? 'box-none' : 'auto'}
        >
          <Animated.View 
            style={[
              styles.workoutPopupContainer,
              {
                transform: [{ translateY: popupTranslateY }],
                height: isMinimized ? Dimensions.get('window').height * 0.1 : Dimensions.get('window').height * 0.9, // 90% screen height when maximized
              }
            ]}
            onLayout={(event) => {
              setPopupHeight(event.nativeEvent.layout.height);
            }}
            pointerEvents="auto"
            {...panResponder.panHandlers}
          >
            {/* Swipe indicator */}
            <View style={styles.swipeIndicator}>
              <View style={styles.swipeBar} />
            </View>
            {/* Workout Header */}
            <View style={styles.workoutHeader}>
              <Text style={styles.workoutTitle}>{activeWorkout.name}</Text>
              <Text style={styles.workoutTimer}>
                {Math.floor(workoutElapsedTime / 60)}:{String(workoutElapsedTime % 60).padStart(2, '0')}
              </Text>
            </View>

            {/* Exercise List */}
            {/* Workout Progress */}
            <View style={styles.workoutProgressSection}>
              <Text style={styles.workoutProgressTitle}>Workout Progress</Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        width: `${activeWorkout ? (Object.values(completedSets).filter(Boolean).length / 
                          activeWorkout.exercises.reduce((total: number, exercise: any) => 
                            total + (Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets), 0
                          ) * 100) : 0}%` 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {activeWorkout ? `${Object.values(completedSets).filter(Boolean).length} / ${
                    activeWorkout.exercises.reduce((total: number, exercise: any) => 
                      total + (Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets), 0
                    )
                  } sets completed` : '0 / 0 sets completed'}
                </Text>
              </View>
            </View>

            <Animated.ScrollView 
              style={[
                styles.workoutScrollContainer,
                { 
                  opacity: popupTranslateY.interpolate({
                    inputRange: [Dimensions.get('window').height * 0.1, Dimensions.get('window').height * 0.8],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  })
                }
              ]}
              contentContainerStyle={styles.workoutScrollContent}
              showsVerticalScrollIndicator={false}
              pointerEvents={isMinimized ? 'none' : 'auto'}
            >
              {activeWorkout.exercises.map((exercise: any, exerciseIndex: number) => (
                <View key={exercise.id} style={styles.workoutExercise}>
                  <Text style={styles.workoutExerciseName}>{exercise.name}</Text>
                  
                  {/* Sets */}
                  {Array.isArray(exercise.sets) 
                    ? exercise.sets.map((set: any, setIndex: number) => {
                        const setKey = `${exerciseIndex}-${setIndex}`;
                        const isCompleted = completedSets[setKey] || false;
                        return (
                    <View key={setIndex} style={styles.setRow}>
                          <View style={styles.setHeader}>
                      <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                            <TouchableOpacity 
                              style={[styles.setCheckbox, isCompleted && styles.setCheckboxCompleted]}
                              onPress={() => {
                                setCompletedSets(prev => ({
                                  ...prev,
                                  [setKey]: !prev[setKey]
                                }));
                              }}
                            >
                              {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </TouchableOpacity>
                          </View>
                      <View style={styles.setInputs}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Weight</Text>
                          <TextInput 
                                style={[styles.setInput, isCompleted && styles.setInputCompleted]}
                                value={set.weight.toString()}
                                keyboardType="numeric"
                                editable={true}
                                onChangeText={(text) => {
                                  const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout));
                                  updatedWorkout.exercises[exerciseIndex].sets[setIndex].weight = parseInt(text) || 0;
                                  setActiveWorkout(updatedWorkout);
                                }}
                              />
                            </View>
                            <View style={styles.inputGroup}>
                              <Text style={styles.inputLabel}>Reps</Text>
                              <TextInput 
                                style={[styles.setInput, isCompleted && styles.setInputCompleted]}
                                value={set.reps.toString()}
                                keyboardType="numeric"
                                editable={true}
                                onChangeText={(text) => {
                                  const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout));
                                  updatedWorkout.exercises[exerciseIndex].sets[setIndex].reps = parseInt(text) || 0;
                                  setActiveWorkout(updatedWorkout);
                                }}
                              />
                            </View>
                          </View>
                        </View>
                        );
                      })
                    : Array.from({ length: exercise.sets }, (_, setIndex) => {
                        const setKey = `${exerciseIndex}-${setIndex}`;
                        const isCompleted = completedSets[setKey] || false;
                        return (
                    <View key={setIndex} style={styles.setRow}>
                      <View style={styles.setHeader}>
                        <Text style={styles.setNumber}>Set {setIndex + 1}</Text>
                        <TouchableOpacity 
                          style={[styles.setCheckbox, isCompleted && styles.setCheckboxCompleted]}
                          onPress={() => {
                            setCompletedSets(prev => ({
                              ...prev,
                              [setKey]: !prev[setKey]
                            }));
                          }}
                        >
                          {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                      <View style={styles.setInputs}>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Weight</Text>
                          <TextInput 
                            style={[styles.setInput, isCompleted && styles.setInputCompleted]}
                            value={exercise.weight.toString()}
                            keyboardType="numeric"
                            editable={true}
                            onChangeText={(text) => {
                              const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout));
                              updatedWorkout.exercises[exerciseIndex].weight = parseInt(text) || 0;
                              setActiveWorkout(updatedWorkout);
                            }}
                          />
                        </View>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Reps</Text>
                          <TextInput 
                            style={[styles.setInput, isCompleted && styles.setInputCompleted]}
                            value={exercise.reps.toString()}
                            keyboardType="numeric"
                            editable={true}
                            onChangeText={(text) => {
                              const updatedWorkout = JSON.parse(JSON.stringify(activeWorkout));
                              updatedWorkout.exercises[exerciseIndex].reps = parseInt(text) || 0;
                              setActiveWorkout(updatedWorkout);
                            }}
                          />
                        </View>
                      </View>
                    </View>
                        );
                      })
                  }
                  
                  <View style={styles.exerciseActions}>
                    <TouchableOpacity style={styles.addSetButton}>
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.addSetText}>Add Set</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.replaceExerciseButton}>
                      <Ionicons name="swap-horizontal" size={16} color="#666" />
                      <Text style={styles.replaceExerciseText}>Replace</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </Animated.ScrollView>

            {/* Workout Actions */}
            <Animated.View style={[
              styles.workoutActions,
              { 
                opacity: popupTranslateY.interpolate({
                  inputRange: [Dimensions.get('window').height * 0.1, Dimensions.get('window').height * 0.8],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                })
              }
            ]}>
              <TouchableOpacity 
                style={styles.finishWorkoutButton}
                onPress={() => {
                  // Save workout to history
                  const workoutData = {
                    id: Date.now(),
                    templateName: activeWorkout.name,
                    exercises: activeWorkout.exercises,
                    completedSets: completedSets,
                    startTime: workoutStartTime,
                    endTime: new Date(),
                    duration: workoutElapsedTime,
                    date: new Date().toISOString().split('T')[0]
                  };
                  
                  setWorkoutHistory(prev => [workoutData, ...prev]);
                  
                  // Reset workout state
                  setActiveWorkout(null);
                  setWorkoutStartTime(null);
                  setShowWorkoutOverlay(false);
                  setWorkoutElapsedTime(0);
                  setCompletedSets({});
                }}
                disabled={isMinimized}
              >
                <Text style={styles.finishWorkoutText}>Finish Workout</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Active Workout Indicator - When minimized */}
      {activeWorkout && !showWorkoutOverlay && (
        <TouchableOpacity 
          style={styles.workoutIndicator}
          onPress={() => {
            setShowWorkoutOverlay(true);
            setIsMinimized(false);
            // Reset popup to maximized position (10% down from top)
            popupTranslateY.setValue(Dimensions.get('window').height * 0.1);
          }}
        >
          <View style={styles.workoutIndicatorContent}>
            <Text style={styles.workoutIndicatorTitle}>{activeWorkout.name}</Text>
            <Text style={styles.workoutIndicatorTimer}>
              {Math.floor(workoutElapsedTime / 60)}:{String(workoutElapsedTime % 60).padStart(2, '0')}
            </Text>
          </View>
          <Ionicons name="chevron-up" size={20} color="#666" />
        </TouchableOpacity>
      )}

      {/* Template Name Popup */}
      {showTemplateNamePopup && (
        <View style={styles.templateNamePopupOverlay}>
          <View style={styles.templateNamePopup}>
            <Text style={styles.templateNamePopupTitle}>Create New Template</Text>
            <TextInput
              style={styles.templateNameInput}
              placeholder="Enter template name..."
              placeholderTextColor="#666"
              value={tempTemplateName}
              onChangeText={setTempTemplateName}
            />
            <View style={styles.templateNamePopupButtons}>
              <TouchableOpacity 
                style={styles.templateNameCancelButton}
                onPress={() => setShowTemplateNamePopup(false)}
              >
                <Text style={styles.templateNameCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.templateNameCreateButton}
                onPress={handleTemplateNameSubmit}
              >
                <Text style={styles.templateNameCreateText}>Create Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Template Customization Popup */}
      {showTemplateCustomization && (
        <View style={styles.templateCustomizationOverlay}>
          <View style={styles.templateCustomizationPopup}>
            <View style={styles.templateCustomizationHeader}>
              <Text style={styles.templateCustomizationTitle}>{tempTemplateName}</Text>
              <TouchableOpacity onPress={() => setShowTemplateCustomization(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.templateCustomizationContent}>
              {/* Exercise List - Similar to workout structure */}
              {tempTemplateExercises.map((exercise, index) => (
                <View key={exercise.id} style={styles.templateWorkoutExercise}>
                  <View style={styles.templateWorkoutExerciseHeader}>
                    <Text style={styles.templateWorkoutExerciseName}>{exercise.name}</Text>
                    <TouchableOpacity 
                      style={styles.templateWorkoutExerciseRemoveButton}
                      onPress={() => handleRemoveExercise(exercise.id)}
                    >
                      <Ionicons name="trash" size={16} color="#ff4444" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Sets */}
                  {exercise.sets.map((set: any, setIndex: number) => (
                    <View key={setIndex} style={styles.templateSetRow}>
                      <Text style={styles.templateSetNumber}>Set {setIndex + 1}</Text>
                      <View style={styles.templateSetInputs}>
                        <View style={styles.templateSetInputContainer}>
                          <Text style={styles.templateSetInputLabel}>Weight (lbs)</Text>
                          <TextInput
                            style={styles.templateSetInput}
                            placeholder="0"
                            value={set.weight.toString()}
                            onChangeText={(text) => {
                              const updatedExercises = [...tempTemplateExercises];
                              updatedExercises[index].sets[setIndex].weight = parseInt(text) || 0;
                              setTempTemplateExercises(updatedExercises);
                            }}
                          />
                        </View>
                        <View style={styles.templateSetInputContainer}>
                          <Text style={styles.templateSetInputLabel}>Reps</Text>
                          <TextInput
                            style={styles.templateSetInput}
                            placeholder="0"
                            value={set.reps.toString()}
                            onChangeText={(text) => {
                              const updatedExercises = [...tempTemplateExercises];
                              updatedExercises[index].sets[setIndex].reps = parseInt(text) || 0;
                              setTempTemplateExercises(updatedExercises);
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                  
                  {/* Add/Remove Sets Buttons */}
                  <View style={styles.templateSetButtons}>
                    <TouchableOpacity 
                      style={styles.templateSetButton}
                      onPress={() => {
                        const updatedExercises = [...tempTemplateExercises];
                        if (updatedExercises[index].sets.length > 1) {
                          updatedExercises[index].sets.pop();
                        }
                        setTempTemplateExercises(updatedExercises);
                      }}
                    >
                      <Text style={styles.templateSetButtonText}>Remove Set</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.templateSetButton}
                      onPress={() => {
                        const updatedExercises = [...tempTemplateExercises];
                        if (updatedExercises[index].sets.length < 10) {
                          updatedExercises[index].sets.push({ weight: 0, reps: 10 });
                        }
                        setTempTemplateExercises(updatedExercises);
                      }}
                    >
                      <Text style={styles.templateSetButtonText}>Add Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.templateCustomizationFooter}>
              <TouchableOpacity 
                style={styles.templateAddWorkoutButton}
                onPress={handleAddWorkout}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.templateAddWorkoutText}>Add Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.templateCustomizationSaveButton}
                onPress={handleSaveTemplate}
              >
                <Text style={styles.templateCustomizationSaveText}>Save Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Insights Header */}
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsTitle}>Insights</Text>
            <Text style={styles.insightsSubtitle}>AI-Powered Training Analysis</Text>
          </View>

          {/* Weekly Progress Report Card */}
          <View style={styles.insightsCard}>
            <View style={styles.insightsCardHeader}>
              <Text style={styles.insightsCardTitle}>Weekly Progress Report</Text>
            </View>
            <TouchableOpacity
              disabled={insightsLoading}
              style={[styles.generateReportButton, insightsLoading && { opacity: 0.6 }]}
              onPress={async () => {
                  try {
                    setInsightsLoading(true);
                    // Build payload from in-app history (last 7 entries, if available)
                    const recentWorkouts = (workoutHistory || []).slice(0, 14); // small cap
                    // Build meal history: use saved meals if available, else fallback to current day snapshot
                    const dailyValues: any = {
                      'Protein': 50, 'Vitamin A, RAE': 900, 'Vitamin C, total ascorbic acid': 90,
                      'Vitamin D (D2 + D3)': 20, 'Vitamin E (alpha-tocopherol)': 15,
                      'Vitamin K (phylloquinone)': 120, 'Thiamin': 1.2, 'Riboflavin': 1.3,
                      'Niacin': 16, 'Vitamin B-6': 1.7, 'Folate, total': 400, 'Vitamin B-12': 2.4,
                      'Calcium, Ca': 1300, 'Iron, Fe': 18, 'Magnesium, Mg': 420, 'Phosphorus, P': 1250,
                      'Potassium, K': 4700, 'Zinc, Zn': 11, 'Fiber, total dietary': 28,
                      'Total lipid (fat)': 78, 'Carbohydrate, by difference': 275,
                      'Copper, Cu': 0.9, 'Manganese, Mn': 2.3, 'Selenium, Se': 55
                    };
                    const todayIso = new Date().toISOString().split('T')[0];
                    const fallbackMeal = (() => {
                      const percent: any = {};
                      Object.keys(dayNutrients || {}).forEach(n => {
                        const dv = dailyValues[n];
                        const amt = dayNutrients[n]?.amount;
                        if (dv && amt !== undefined) {
                          percent[n] = Math.min(200, (amt / dv) * 100);
                        }
                      });
                      return { date: todayIso, nutrients: percent };
                    })();
                    const meals = (mealHistory && mealHistory.length > 0) ? mealHistory : [fallbackMeal];
                    const payload = {
                      week_start: undefined,
                      week_end: undefined,
                      favorite_exercise: undefined,
                      workout_history: recentWorkouts,
                      meal_history: meals,
                    };
                    const res = await fetch('http://169.231.213.72:8000/insights/report', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    setInsightsReport(data);
                  } catch (e) {
                    console.error('Insights report failed', e);
                  } finally {
                    setInsightsLoading(false);
                  }
                }}
            >
              <Text style={styles.generateReportButtonText}>{insightsLoading ? 'Generating…' : 'Generate Report'}</Text>
            </TouchableOpacity>

            {insightsReport && (
              <View style={styles.insightsResults}>
                {/* Small info about data sources */}
                <Text style={styles.reportSubtleText}>
                  Using {mealHistory.length > 0 ? mealHistory.length : 1} saved meal day(s) and {workoutHistory.length} workout session(s).
                </Text>
                {/* Summary */}
                <Text style={styles.reportSummaryTitle}>Summary</Text>
                <Text style={styles.reportSummaryText}>{insightsReport.summary}</Text>
                {insightsReport.ai_summary ? (
                  <Text style={styles.reportSummaryText}>{insightsReport.ai_summary}</Text>
                ) : null}
                <Text style={styles.reportSubtleText}>Favorite exercise: {insightsReport.favorite_exercise}</Text>
                <Text style={styles.reportSubtleText}>Strength change: {Number(insightsReport.strength_change_pct).toFixed(1)}%</Text>

                {/* Radar Chart */}
                {insightsReport.radar_chart ? (
                  <View style={styles.reportImageBlock}>
                    <Text style={styles.reportImageTitle}>Nutrient Coverage</Text>
                    <Image
                      source={{ uri: `data:image/png;base64,${insightsReport.radar_chart}` }}
                      style={styles.graphImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}

                {/* 3D Exercise Progress */}
                {insightsReport.exercise_3d_chart ? (
                  <View style={styles.reportImageBlock}>
                    <Text style={styles.reportImageTitle}>Exercise Progress (3D)</Text>
                    <Image
                      source={{ uri: `data:image/png;base64,${insightsReport.exercise_3d_chart}` }}
                      style={styles.graphImage}
                      resizeMode="contain"
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Tension Detector Card */}
          <TouchableOpacity 
            style={styles.tensionDetectorCard}
            onPress={() => setShowTensionDetector(true)}
          >
            <View style={styles.tensionDetectorContent}>
              <View style={styles.tensionDetectorHeader}>
                <Text style={styles.tensionDetectorTitle}>HimAI's Tension Detector</Text>
                <Text style={styles.tensionDetectorDescription}>
                  Analyze your exercise form with AI-powered pose detection
                </Text>
              </View>
              <View style={styles.tensionDetectorButton}>
                <Text style={styles.tensionDetectorButtonText}>Start</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Coming Soon Cards */}
          <View style={styles.comingSoonSection}>
            <Text style={styles.comingSoonTitle}>More Insights Coming Soon</Text>
            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonCardTitle}>📊 Progress Analytics</Text>
              <Text style={styles.comingSoonCardText}>Track your strength gains over time</Text>
            </View>
            <View style={styles.comingSoonCard}>
              <Text style={styles.comingSoonCardTitle}>🎯 Form Analysis</Text>
              <Text style={styles.comingSoonCardText}>Get real-time feedback on your technique</Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Exercise Selection Popup */}
      {showExerciseSelection && (
        <View style={styles.exerciseSelectionOverlay}>
          <View style={styles.exerciseSelectionPopup}>
            <View style={styles.exerciseSelectionHeader}>
              <Text style={styles.exerciseSelectionTitle}>Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowExerciseSelection(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.exerciseSelectionSearchContainer}>
              <View style={styles.exerciseSelectionSearchBar}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.exerciseSelectionSearchInput}
                  placeholder="Search exercises..."
                  placeholderTextColor="#666"
                  value={exerciseSelectionQuery}
                  onChangeText={setExerciseSelectionQuery}
                />
              </View>
            </View>

            {/* Equipment Filter */}
            <View style={styles.exerciseSelectionFilterSection}>
              <Text style={styles.exerciseSelectionFilterLabel}>Equipment</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseSelectionFilterScroll}>
                {['All', 'Barbell', 'Body Weight', 'Cable', 'Dumbbell', 'Smith', 'Weighted', 'Other'].map((equipment) => (
                  <TouchableOpacity 
                    key={equipment}
                    style={[styles.exerciseSelectionFilterButton, selectedExerciseEquipment === equipment && styles.activeExerciseSelectionFilterButton]}
                    onPress={() => setSelectedExerciseEquipment(equipment)}
                  >
                    <Text style={[styles.exerciseSelectionFilterButtonText, selectedExerciseEquipment === equipment && styles.activeExerciseSelectionFilterButtonText]}>
                      {equipment}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Target Muscle Filter */}
            <View style={styles.exerciseSelectionFilterSection}>
              <Text style={styles.exerciseSelectionFilterLabel}>Target Muscle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseSelectionFilterScroll}>
                {['All', 'Anterior Deltoid', 'Biceps Brachii', 'Brachialis', 'Brachioradialis', 'Gastrocnemius', 'Gluteus Maximus', 'Hamstrings', 'Hip Abductors', 'Hip Adductors', 'Hip Flexors', 'Infraspinatus', 'Lateral Deltoid', 'Latissimus Dorsi', 'Levator Scapulae', 'Lower Trapezius', 'Middle', 'Middle Trapezius', 'Obliques', 'Pectoralis Major Clavicular', 'Pectoralis Major Sternal'].map((muscle) => (
                  <TouchableOpacity 
                    key={muscle}
                    style={[styles.exerciseSelectionFilterButton, selectedExerciseMuscle === muscle && styles.activeExerciseSelectionFilterButton]}
                    onPress={() => setSelectedExerciseMuscle(muscle)}
                  >
                    <Text style={[styles.exerciseSelectionFilterButtonText, selectedExerciseMuscle === muscle && styles.activeExerciseSelectionFilterButtonText]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            <ScrollView style={styles.exerciseSelectionContent}>
              {exercises
                .filter(exercise => 
                  exercise.name.toLowerCase().includes(exerciseSelectionQuery.toLowerCase()) &&
                  (selectedExerciseEquipment === 'All' || exercise.equipment === selectedExerciseEquipment) &&
                  (selectedExerciseMuscle === 'All' || exercise.targetMuscle === selectedExerciseMuscle)
                )
                .map((exercise) => (
                  <TouchableOpacity 
                    key={exercise.id} 
                    style={styles.exerciseSelectionItem}
                    onPress={() => handleSelectExercise(exercise)}
                  >
                    <Text style={styles.exerciseSelectionEmoji}>{exercise.emoji}</Text>
                    <View style={styles.exerciseSelectionInfo}>
                      <Text style={styles.exerciseSelectionName}>{exercise.name}</Text>
                      <Text style={styles.exerciseSelectionDetails}>{exercise.equipment} • {exercise.targetMuscle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Tension Detector Modal */}
      {showTensionDetector && (
        <View style={styles.modalOverlay}>
          <View style={styles.tensionDetectorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tension Detector</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                    onPress={() => {
                      setShowTensionDetector(false);
                      setUploadedVideo(null);
                      setTensionRating(null);
                      setForceVelocityGraph(null);
                      setVelocityTimeline(null);
                      setRepComparison(null);
                      setAnalysisResults(null);
                      setIsAnalyzing(false);
                      setUploadProgress(0);
                    }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {!tensionRating ? (
                <View>
                  {/* Exercise Selection */}
                  <View style={styles.exerciseSelectionSection}>
                    <Text style={styles.exerciseSelectionTitle}>Select Exercise</Text>
                    <Text style={styles.exerciseSelectionDescription}>
                      Choose the exercise you're performing for optimal analysis
                    </Text>
                    
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScrollView}>
                      {availableExercises.map((exercise, index) => (
                        <TouchableOpacity
                          key={exercise.name}
                          style={[
                            styles.exerciseCard,
                            selectedExercise === exercise.name && styles.exerciseCardSelected
                          ]}
                          onPress={() => setSelectedExercise(exercise.name)}
                        >
                          <Text style={[
                            styles.exerciseCardTitle,
                            selectedExercise === exercise.name && styles.exerciseCardTitleSelected
                          ]}>
                            {exercise.display_name}
                          </Text>
                          <Text style={[
                            styles.exerciseCardDescription,
                            selectedExercise === exercise.name && styles.exerciseCardDescriptionSelected
                          ]}>
                            {exercise.description}
                          </Text>
                          <View style={styles.exerciseCardFooter}>
                            <Text style={[
                              styles.exerciseCardDifficulty,
                              selectedExercise === exercise.name && styles.exerciseCardDifficultySelected
                            ]}>
                              {exercise.difficulty}
                            </Text>
                            <Text style={[
                              styles.exerciseCardCategory,
                              selectedExercise === exercise.name && styles.exerciseCardCategorySelected
                            ]}>
                              {exercise.category}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Upload Section */}
                  <View style={styles.uploadSection}>
                    <View style={styles.uploadIconContainer}>
                      <Ionicons name="cloud-upload-outline" size={64} color="#667eea" />
                    </View>
                    <Text style={styles.uploadTitle}>Upload Your Exercise Video</Text>
                    <Text style={styles.uploadDescription}>
                      Record yourself performing an exercise to analyze mechanical tension
                    </Text>
                        <TouchableOpacity 
                          style={styles.uploadButton}
                          onPress={pickVideo}
                        >
                      <Ionicons name="videocam" size={20} color="#fff" />
                      <Text style={styles.uploadButtonText}>Choose Video</Text>
                    </TouchableOpacity>
                    <Text style={styles.uploadFormats}>Supported: MP4, MOV, WEBM</Text>
                    
                    {/* Selected Video Info */}
                    {uploadedVideo && (
                      <View style={styles.selectedVideoContainer}>
                        <View style={styles.selectedVideoInfo}>
                          <Ionicons name="videocam" size={20} color="#4CAF50" />
                          <Text style={styles.selectedVideoName}>{uploadedVideo.name}</Text>
                        </View>
                        <Text style={styles.selectedVideoSize}>
                          {uploadedVideo.size ? `${(uploadedVideo.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                        </Text>
                        
                        <View style={styles.analyzeButtonsContainer}>
                          <TouchableOpacity 
                            style={[styles.analyzeButton, styles.analyzeButtonPrimary]}
                            onPress={() => uploadVideo(false)}
                            disabled={isAnalyzing}
                          >
                            <Ionicons name="play-circle" size={22} color="#fff" />
                            <Text style={styles.analyzeButtonText} numberOfLines={1}>
                              {isAnalyzing ? 'Analyzing...' : 'Analyze Video'}
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={[styles.analyzeButton, styles.analyzeButtonSecondary]}
                            onPress={() => uploadVideo(true)}
                            disabled={isAnalyzing}
                          >
                            <Ionicons name="eye" size={22} color="#fff" />
                            <Text style={styles.analyzeButtonText} numberOfLines={1}>
                              Real-Time View
                            </Text>
                          </TouchableOpacity>
                        </View>
                        
                        {uploadProgress > 0 && (
                          <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                              <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                            </View>
                            <Text style={styles.progressText}>{uploadProgress}%</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Info Section */}
                  <View style={styles.tensionInfoSection}>
                    <Text style={styles.tensionInfoTitle}>How It Works</Text>
                    <View style={styles.tensionInfoItem}>
                      <View style={styles.tensionInfoNumber}>
                        <Text style={styles.tensionInfoNumberText}>1</Text>
                      </View>
                      <Text style={styles.tensionInfoText}>
                        Upload a video of yourself performing an exercise
                      </Text>
                    </View>
                    <View style={styles.tensionInfoItem}>
                      <View style={styles.tensionInfoNumber}>
                        <Text style={styles.tensionInfoNumberText}>2</Text>
                      </View>
                      <Text style={styles.tensionInfoText}>
                        AI analyzes your movement velocity and form
                      </Text>
                    </View>
                    <View style={styles.tensionInfoItem}>
                      <View style={styles.tensionInfoNumber}>
                        <Text style={styles.tensionInfoNumberText}>3</Text>
                      </View>
                      <Text style={styles.tensionInfoText}>
                        Get your Tension Rating and force-velocity graph
                      </Text>
                    </View>
                  </View>
                </View>
              ) : showRealTimeVisualization ? (
                <View style={styles.realTimeVisualizationContainer}>
                  <View style={styles.realTimeHeader}>
                    <TouchableOpacity 
                      style={styles.closeRealTimeButton}
                      onPress={() => {
                        setShowRealTimeVisualization(false);
                        setIsAnalyzing(false);
                      }}
                    >
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.realTimeTitle}>Live Analysis</Text>
                    <View style={styles.realTimeProgress}>
                      <Text style={styles.realTimeProgressText}>
                        {visualizationProgress.toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                  
                  {/* Video Frame Display */}
                  <View style={styles.frameDisplayContainer}>
                    {currentFrame ? (
                      <Image 
                        source={{ uri: currentFrame }}
                        style={styles.frameImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.framePlaceholder}>
                        <Ionicons name="videocam-outline" size={64} color="#666" />
                        <Text style={styles.framePlaceholderText}>
                          Processing video...
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Real-time Stats */}
                  <View style={styles.realTimeStatsContainer}>
                    <View style={styles.realTimeStat}>
                      <Ionicons name="pulse" size={20} color="#4CAF50" />
                      <Text style={styles.realTimeStatLabel}>Velocity</Text>
                      <Text style={styles.realTimeStatValue}>
                        {realTimeVelocity !== null ? realTimeVelocity.toFixed(2) : '--'}
                      </Text>
                    </View>
                    
                    <View style={styles.realTimeStat}>
                      <Ionicons name="repeat" size={20} color="#667eea" />
                      <Text style={styles.realTimeStatLabel}>Reps</Text>
                      <Text style={styles.realTimeStatValue}>
                        {realTimeRepCount}
                      </Text>
                    </View>
                    
                    <View style={styles.realTimeStat}>
                      <Ionicons name="trending-up" size={20} color="#ff6b6b" />
                      <Text style={styles.realTimeStatLabel}>Tension</Text>
                      <Text style={styles.realTimeStatValue}>
                        {realTimeTension !== null ? `${realTimeTension.toFixed(0)}%` : '--'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Progress Bar */}
                  <View style={styles.realTimeProgressBar}>
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.realTimeProgressFill, { width: `${visualizationProgress}%` }]}
                    />
                  </View>
                </View>
              ) : (
                <View>
                  {/* Results Section */}
                  <View style={styles.resultsSection}>
                    <Text style={styles.resultsTitle}>Analysis Complete!</Text>
                    
                    {/* Tension Rating */}
                    <View style={styles.tensionRatingCard}>
                      <Text style={styles.tensionRatingLabel}>Tension Rating</Text>
                      <View style={styles.tensionRatingCircle}>
                        <Text style={styles.tensionRatingValue}>{tensionRating}%</Text>
                      </View>
                      <Text style={styles.tensionRatingFeedback}>
                        {tensionRating >= 80 ? 'Excellent mechanical tension!' :
                         tensionRating >= 60 ? 'Good tension, room for improvement' :
                         'Focus on slower, controlled movements'}
                      </Text>
                    </View>

                        {/* Force-Velocity Graph */}
                        {forceVelocityGraph && (
                          <View style={styles.graphCard}>
                            <Text style={styles.graphTitle}>Force-Velocity Profile</Text>
                            <Image 
                              source={{ uri: forceVelocityGraph }}
                              style={styles.graphImage}
                              resizeMode="contain"
                            />
                          </View>
                        )}

                        {/* Velocity Timeline */}
                        {velocityTimeline && (
                          <View style={styles.graphCard}>
                            <Text style={styles.graphTitle}>Movement Timeline</Text>
                            <Image 
                              source={{ uri: velocityTimeline }}
                              style={styles.graphImage}
                              resizeMode="contain"
                            />
                          </View>
                        )}

                        {/* Rep Comparison */}
                        {repComparison && (
                          <View style={styles.graphCard}>
                            <Text style={styles.graphTitle}>Rep Comparison</Text>
                            <Image 
                              source={{ uri: repComparison }}
                              style={styles.graphImage}
                              resizeMode="contain"
                            />
                          </View>
                        )}

                        {/* Detailed Analysis */}
                        {analysisResults && (
                          <View style={styles.detailedAnalysisCard}>
                            <Text style={styles.detailedAnalysisTitle}>Detailed Analysis</Text>
                            
                            <View style={styles.analysisStats}>
                              <View style={styles.analysisStat}>
                                <Text style={styles.analysisStatLabel}>Reps Detected</Text>
                                <Text style={styles.analysisStatValue}>{analysisResults.rep_count}</Text>
                              </View>
                              <View style={styles.analysisStat}>
                                <Text style={styles.analysisStatLabel}>Analysis Time</Text>
                                <Text style={styles.analysisStatValue}>~{Math.round(analysisResults.rep_count * 2.5)}s</Text>
                              </View>
                            </View>

                            {/* Rep Breakdown */}
                            {analysisResults.reps && analysisResults.reps.length > 0 && (
                              <View style={styles.repBreakdown}>
                                <Text style={styles.repBreakdownTitle}>Rep-by-Rep Breakdown</Text>
                                {analysisResults.reps.slice(0, 5).map((rep: any, index: number) => (
                                  <View key={index} style={styles.repItem}>
                                    <Text style={styles.repNumber}>Rep {rep.rep_number}</Text>
                                    <View style={styles.repMetrics}>
                                      <Text style={styles.repMetric}>
                                        Duration: {rep.duration.toFixed(1)}s
                                      </Text>
                                      <Text style={styles.repMetric}>
                                        Avg Velocity: {rep.avg_velocity.toFixed(3)}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                                {analysisResults.reps.length > 5 && (
                                  <Text style={styles.moreRepsText}>
                                    +{analysisResults.reps.length - 5} more reps
                                  </Text>
                                )}
                              </View>
                            )}

                            {/* Recommendations */}
                            {analysisResults.recommendations && analysisResults.recommendations.length > 0 && (
                              <View style={styles.recommendationsCard}>
                                <Text style={styles.recommendationsTitle}>Recommendations</Text>
                                {analysisResults.recommendations.map((rec: string, index: number) => (
                                  <View key={index} style={styles.recommendationItem}>
                                    <Ionicons name="bulb" size={16} color="#FFC107" />
                                    <Text style={styles.recommendationText}>{rec}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity 
                        style={styles.shareButton}
                        onPress={shareResults}
                      >
                        <Ionicons name="share" size={20} color="#fff" />
                        <Text style={styles.shareButtonText}>Share Results</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.analyzeAnotherButton}
                        onPress={() => {
                          setTensionRating(null);
                          setForceVelocityGraph(null);
                          setVelocityTimeline(null);
                          setRepComparison(null);
                          setAnalysisResults(null);
                          setUploadedVideo(null);
                          setUploadProgress(0);
                        }}
                      >
                        <Text style={styles.analyzeAnotherButtonText}>Analyze Another Video</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {isAnalyzing && (
                <View style={styles.analyzingOverlay}>
                  <Text style={styles.analyzingText}>Analyzing your movement...</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'insights' && styles.activeNavButton]}
          onPress={() => setActiveTab('insights')}
        >
          <Ionicons 
            name="analytics" 
            size={24} 
            color={activeTab === 'insights' ? '#fff' : '#666'} 
          />
          <Text style={[styles.navLabel, activeTab === 'insights' && styles.activeNavLabel]}>
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'food' && styles.activeNavButton]}
          onPress={() => setActiveTab('food')}
        >
          <Ionicons 
            name="restaurant" 
            size={24} 
            color={activeTab === 'food' ? '#fff' : '#666'} 
          />
          <Text style={[styles.navLabel, activeTab === 'food' && styles.activeNavLabel]}>
            Food
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, styles.homeButton, activeTab === 'home' && styles.activeHomeButton]}
          onPress={() => setActiveTab('home')}
        >
          <Ionicons 
            name="home" 
            size={28} 
            color={activeTab === 'home' ? '#000' : '#666'} 
          />
          <Text style={[styles.navLabel, styles.homeLabel, activeTab === 'home' && styles.activeHomeLabel]}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'lifts' && styles.activeNavButton]}
          onPress={() => setActiveTab('lifts')}
        >
          <Ionicons 
            name="barbell" 
            size={24} 
            color={activeTab === 'lifts' ? '#fff' : '#666'} 
          />
          <Text style={[styles.navLabel, activeTab === 'lifts' && styles.activeNavLabel]}>
            Lifts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.navButton, activeTab === 'patch' && styles.activeNavButton]}
          onPress={() => setActiveTab('patch')}
        >
          <Ionicons 
            name="document-text" 
            size={24} 
            color={activeTab === 'patch' ? '#fff' : '#666'} 
          />
          <Text style={[styles.navLabel, activeTab === 'patch' && styles.activeNavLabel]}>
            Patch
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Menu */}
      {showSettingsMenu && renderSettingsMenu()}
    </View>
  );
}

const styles = StyleSheet.create({
  // Welcome screen styles
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingBottom: 50,
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
  },

  // Home screen styles
  homeContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  brandName: {
    fontSize: 16,
    color: '#666',
    fontWeight: '300',
    letterSpacing: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  
  // Hero Section
  heroSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  heroText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    lineHeight: 32,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  
  // Begin Lift Button
  beginLiftButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  beginLiftText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  
  // Template Section
  templateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  templateButton: {
    backgroundColor: '#1a1a1a',
    width: (width - 60) / 3,
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  templateText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  
  // Vitality Section
  vitalitySection: {
    marginBottom: 40,
  },
  vitalityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  vitalityLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  vitalityPercentage: {
    color: '#66bb6a',
    fontSize: 16,
    fontWeight: '400',
  },
  vitalityBarContainer_old: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 8,
  },
  vitalityBar: {
    height: '100%',
    borderRadius: 4,
  },
  vitalityDefinition: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  
  // Insights Section
  insightsSection: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 8,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#333',
  },
  insightsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 20,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  insightsButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  insightsButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '400',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  
  // Bottom Section
  bottomSection: {
    gap: 12,
  },
  bottomButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  bottomButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '300',
    flex: 1,
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#111',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingBottom: 35, // Account for home button
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  homeButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 5,
    marginTop: -10,
  },
  activeNavButton: {
    backgroundColor: '#333',
    borderRadius: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  activeHomeButton: {
    backgroundColor: '#fff',
  },
  navLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    fontWeight: '300',
  },
  homeLabel: {
    color: '#666',
  },
  activeNavLabel: {
    color: '#fff',
  },
  activeHomeLabel: {
    color: '#000',
  },

  // Food Menu Styles
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  foodVitalityContainer: {
    alignItems: 'flex-end',
  },
  foodVitalityLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  foodVitalityBarContainer: {
    width: 80,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginBottom: 4,
  },
  foodVitalityBar: {
    height: '100%',
    borderRadius: 3,
  },
  foodVitalityPercentage: {
    color: '#66bb6a',
    fontSize: 12,
    fontWeight: '400',
  },

  // Search Bar
  searchContainer: {
    marginBottom: 30,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '300',
  },

  // Filter Section
  filterSection: {
    marginBottom: 30,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  activeFilterButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  activeFilterButtonText: {
    color: '#000',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  orderButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginRight: 6,
    letterSpacing: 0.3,
  },

  // Sort Section
  sortContainer: {
    marginBottom: 20,
  },
  sortLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sortScroll: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  activeSortButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  sortButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  activeSortButtonText: {
    color: '#000',
  },

  // Recent Foods Section
  recentSection: {
    marginBottom: 20,
  },
  recentTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '300',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  filteredCount: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  foodItemLeft_old: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gradeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gradeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  foodType: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  foodItemRight_old: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutritionInfo: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  calorieText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  proteinText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.3,
  },

  // New Food Section Styles
  foodContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  foodContainerContent: {
    paddingBottom: 100, // Extra padding at bottom for better scrolling
  },
  catalogHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  catalogTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  backendIndicator: {
    fontSize: 16,
    color: '#4CAF50',
    marginLeft: 8,
  },
  categoryFilters: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  categoryScrollView: {
    flexGrow: 0,
  },
  categoryChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeCategoryChip: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryChipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  activeCategoryChipText: {
    color: '#fff',
    fontWeight: '600',
  },
  foodSearchContainer: {
    margin: 20,
    marginBottom: 10,
  },
  prominentSearchBar: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 15,
  },
  prominentSearchInput: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 12,
    flex: 1,
    paddingVertical: 4,
  },
  foodSearchButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  foodSearchText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  foodDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
    maxHeight: 400,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  foodSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  foodSearchInput: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  foodSortContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterDropdownContainer: {
    flex: 1,
    position: 'relative',
  },
  filterDropdownButton: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterDropdownText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  filterDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filterDropdownItemText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '400',
  },
  activeFilterDropdownItemText: {
    color: '#667eea',
    fontWeight: '600',
  },
  sortDropdownContainer: {
    flex: 1,
    position: 'relative',
  },
  sortDropdownButton: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortDropdownText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  sortDropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  sortDropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sortDropdownItemText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '400',
  },
  activeSortDropdownItemText: {
    color: '#667eea',
    fontWeight: '600',
  },
  foodDropdownList: {
    maxHeight: 300,
  },
  foodListContainer: {
    marginTop: 10,
    minHeight: 400, // Minimum height, but can grow with content
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginVertical: 4,
    borderRadius: 8,
  },
  foodItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  foodItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  foodItemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  foodItemCookingMethod: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  foodItemStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  foodItemCalories: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  foodItemNDS: {
    color: '#FFC107',
    fontSize: 12,
    marginLeft: 8,
  },
  foodItemType: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  foodItemRight: {
    marginLeft: 12,
  },
  mealHistorySection: {
    height: '50%',
    padding: 20,
    backgroundColor: '#1a1a1a',
    marginTop: 10,
  },
  mealHistoryTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  mealHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealHistoryPlaceholder: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  foodDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  foodDropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  foodDropdownInfo: {
    marginLeft: 12,
    flex: 1,
  },
  foodDropdownName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  foodDropdownType: {
    color: '#666',
    fontSize: 12,
    fontWeight: '400',
  },
  foodDropdownCookingMethod: {
    color: '#999',
    fontSize: 11,
    fontWeight: '400',
    fontStyle: 'italic',
    marginTop: 2,
  },
  foodDropdownStats: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  foodDropdownCalories: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },
  foodDropdownNDS: {
    color: '#FFC107',
    fontSize: 12,
    fontWeight: '500',
  },
  foodDropdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Food Details Modal Styles
  foodDetailsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 2000,
  },
  foodDetailsContainer: {
    flex: 1,
    backgroundColor: '#000',
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  foodDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  nutrientScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    gap: 12,
  },
  nutrientScoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  foodDetailsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  foodDetailsCloseButton: {
    padding: 8,
  },
  foodDetailsContent: {
    flex: 1,
    padding: 20,
  },
  foodDetailsSection: {
    marginBottom: 24,
  },
  foodDetailsSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  foodDetailsBasicInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  foodDetailsGradeContainer: {
    alignItems: 'center',
  },
  foodDetailsGradeText: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  foodDetailsCategoryContainer: {
    alignItems: 'center',
  },
  foodDetailsCategoryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  foodDetailsCategoryLabel: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },

  // Nutrient Bar Styles
  macroNutrientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroNutrientLabel: {
    color: '#fff',
    fontSize: 14,
    width: 100,
  },
  macroNutrientBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    marginHorizontal: 12,
  },
  macroNutrientBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroNutrientValue: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    width: 60,
    textAlign: 'right',
  },
  vitaminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vitaminLabel: {
    color: '#fff',
    fontSize: 14,
    width: 100,
  },
  vitaminBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  vitaminBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  vitaminValue: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  mineralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  mineralLabel: {
    color: '#fff',
    fontSize: 14,
    width: 100,
  },
  mineralBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  mineralBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FF9800',
  },
  mineralValue: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
  },
  additionalNutrientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  additionalNutrientLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    flex: 1,
  },
  additionalNutrientValue: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  completeNutrientsList: {
    maxHeight: 300,
    marginTop: 10,
  },
  completeNutrientItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  completeNutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completeNutrientName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  completeNutrientValue: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '400',
  },
  completeNutrientBar: {
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    overflow: 'hidden',
  },
  completeNutrientBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '500',
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  noResultsSubtext: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
  },
  resultsCounter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultsCounterText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Lifts Menu Styles
  browseLiftsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 20,
    marginBottom: 30,
  },
  browseLiftsTitle: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  becomeHimSubtitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '300',
    letterSpacing: 0.3,
  },

  // Category Section
  categorySection: {
    marginBottom: 20,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
    marginRight: 8,
  },
  activeCategoryButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  categoryButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  activeCategoryButtonText: {
    color: '#000',
  },

  // Exercise Catalog
  exerciseCatalog: {
    marginBottom: 20,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  exerciseCategory: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  exerciseItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseDifficulty: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginRight: 12,
    letterSpacing: 0.3,
  },
  addExerciseButton: {
    backgroundColor: '#667eea',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Exercise search styles
  exerciseFilterSection: {
    marginBottom: 15,
    marginTop: 15,
    position: 'relative',
    zIndex: 1,
  },
  exerciseFilterSectionEquipment: {
    marginBottom: 15,
    marginTop: 15,
    position: 'relative',
    zIndex: 10,
  },
  exerciseFilterSectionMuscle: {
    marginBottom: 15,
    marginTop: 15,
    position: 'relative',
    zIndex: 5,
  },
  exerciseFilterLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseFilterScroll: {
    flexDirection: 'row',
  },
  exerciseFilterButton: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeExerciseFilterButton: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  exerciseFilterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  activeExerciseFilterButtonText: {
    color: '#fff',
  },
  
  // Dropdown styles
  dropdownButton: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownMenu: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownMenuEquipment: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1001,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownMenuMuscle: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 4,
    maxHeight: 200,
    zIndex: 1000,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  activeDropdownItem: {
    backgroundColor: '#667eea',
  },
  dropdownItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
  },
  activeDropdownItemText: {
    color: '#fff',
    fontWeight: '600',
  },
  exerciseResults: {
    marginTop: 10,
  },
  exerciseEquipment: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  exerciseTargetMuscle: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  
  // Workout history styles
  workoutHistorySection: {
    marginTop: 30,
  },
  workoutHistoryTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  workoutHistoryItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  workoutHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  workoutHistoryDate: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  workoutHistoryTemplate: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutHistoryExercises: {
    gap: 8,
  },
  workoutHistoryExercise: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 10,
    borderRadius: 8,
  },
  workoutHistoryExerciseName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  workoutHistoryExerciseDetails: {
    color: '#999',
    fontSize: 12,
  },

  // Template creation popup styles
  templateNamePopupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  templateNamePopup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    borderWidth: 1,
    borderColor: '#333',
  },
  templateNamePopupTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  templateNameInput: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  templateNamePopupButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  templateNameCancelButton: {
    flex: 1,
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  templateNameCancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  templateNameCreateButton: {
    flex: 1,
    backgroundColor: '#667eea',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  templateNameCreateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Template customization popup styles
  templateCustomizationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  templateCustomizationPopup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    height: '80%',
    borderWidth: 1,
    borderColor: '#333',
  },
  templateCustomizationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  templateCustomizationTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  templateCustomizationContent: {
    flex: 1,
    padding: 20,
  },
  templateCustomizationSubtitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  templateExerciseList: {
    gap: 10,
  },
  templateExerciseItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  templateExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  templateExerciseInputs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  templateExerciseInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    textAlign: 'center',
  },
  templateExerciseRemoveButton: {
    alignSelf: 'flex-end',
    padding: 5,
  },
  templateCustomizationFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  templateCustomizationSaveButton: {
    backgroundColor: '#667eea',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  templateCustomizationSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Template exercise catalog styles
  templateExerciseCatalog: {
    marginBottom: 20,
  },
  templateExerciseCatalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  templateExerciseCatalogEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  templateExerciseCatalogInfo: {
    flex: 1,
  },
  templateExerciseCatalogName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  templateExerciseCatalogDetails: {
    color: '#999',
    fontSize: 12,
  },
  templateExerciseCatalogAddButton: {
    backgroundColor: '#667eea',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Template button container and delete button styles
  templateButtonContainer: {
    position: 'relative',
  },
  templateActionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  templateEditButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  templateMenuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  templateMenuDropdown: {
    position: 'absolute',
    top: 40,
    right: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 8,
    minWidth: 120,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  templateMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  templateMenuItemText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },

  // Template workout exercise styles (similar to actual workout)
  templateWorkoutExercise: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  templateWorkoutExerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  templateWorkoutExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  templateWorkoutExerciseRemoveButton: {
    padding: 5,
  },
  templateSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateSetNumber: {
    color: '#999',
    fontSize: 14,
    width: 60,
  },
  templateSetInputs: {
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  templateSetInputContainer: {
    flex: 1,
  },
  templateSetInputLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  templateSetInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 8,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
    textAlign: 'center',
  },
  templateSetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  templateSetButton: {
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  templateSetButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Template footer styles
  templateAddWorkoutButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  templateAddWorkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Exercise selection popup styles
  exerciseSelectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1002,
  },
  exerciseSelectionPopup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '90%',
    height: '70%',
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  exerciseSelectionContent: {
    flex: 1,
    padding: 20,
  },
  exerciseSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 15,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseSelectionEmoji: {
    fontSize: 24,
    marginRight: 15,
  },
  exerciseSelectionInfo: {
    flex: 1,
  },
  exerciseSelectionName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseSelectionDetails: {
    color: '#999',
    fontSize: 12,
  },

  // Exercise selection search and filter styles
  exerciseSelectionSearchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  exerciseSelectionSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  exerciseSelectionSearchInput: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    marginLeft: 10,
  },
  exerciseSelectionFilterSection: {
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  exerciseSelectionFilterLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseSelectionFilterScroll: {
    flexDirection: 'row',
  },
  exerciseSelectionFilterButton: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  activeExerciseSelectionFilterButton: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  exerciseSelectionFilterButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  activeExerciseSelectionFilterButtonText: {
    color: '#fff',
  },

  // Login Screen Styles
  loginContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loginHeader: {
    marginBottom: 60,
  },
  loginTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  loginForm: {
    width: '100%',
    maxWidth: 300,
  },
  inputContainer: {
    marginBottom: 20,
  },
  loginInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  errorContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  toggleButton: {
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  logoutButton: {
    padding: 8,
  },

  // Patch Notes Styles
  patchNotesContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  patchNotesHeader: {
    backgroundColor: '#333333',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  patchNotesTitle: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  patchNotesScrollContainer: {
    flex: 1,
  },
  patchNotesScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  patchNoteItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  patchImageContainer: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    alignItems: 'center',
  },
  patchImage: {
    fontSize: 48,
  },
  patchInfo: {
    padding: 20,
  },
  patchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  patchCategory: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  patchSeparator: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  patchDate: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  patchVersion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  patchTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  patchContent: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  expandedContent: {
    marginTop: 12,
  },
  expandIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  expandText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 6,
    letterSpacing: 0.3,
  },

  // Workout Template Styles
  templateName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  templateExerciseCount: {
    color: '#666',
    fontSize: 10,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Template Popup Styles
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  popupContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 30,
    margin: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  popupTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  popupSubtitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: '300',
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  startLiftButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  startLiftButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Active Workout Styles
  workoutPopupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'flex-start',
  },
  workoutPopupContainer: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    width: '100%',
  },
  activeWorkoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 1000,
  },
  activeWorkoutContainer: {
    flex: 1,
    paddingTop: 60,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  workoutTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  workoutTimer: {
    color: '#66bb6a',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  workoutScrollContainer: {
    flex: 1,
  },
  workoutScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  workoutExercise: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  workoutExerciseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'column',
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  setNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  setCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  setCheckboxCompleted: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  setInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  setInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  setInputCompleted: {
    backgroundColor: '#1a2a1a',
    borderColor: '#4CAF50',
    color: '#4CAF50',
  },
  workoutProgressSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  workoutProgressTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  // Insights UI styles
  insightsCard: {
    backgroundColor: '#0f0f0f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  insightsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  insightsCardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  generateReportButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  generateReportButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  insightsResults: {
    marginTop: 4,
  },
  reportSummaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  reportSummaryText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  reportSubtleText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  reportImageBlock: {
    marginTop: 14,
  },
  reportImageTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  saveDayButton: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  saveDayButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  exerciseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  addSetButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addSetText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  replaceExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  replaceExerciseText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  workoutActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  finishWorkoutButton: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishWorkoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Strong-style Popup Styles
  strongPopupContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: width * 0.05, // 90% width (5% margin on each side)
    marginVertical: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#333',
    width: width * 0.9, // 90% of screen width
  },
  strongPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strongPopupTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  editButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strongExerciseList: {
    maxHeight: 300,
  },
  strongExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  strongExerciseInfo: {
    flex: 1,
  },
  strongExerciseName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  strongExerciseDetails: {
    color: '#666',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.3,
  },
  strongButtonContainer: {
    flexDirection: 'row',
    margin: 20,
    gap: 12,
  },
  strongCancelButton: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  strongCancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  strongStartButton: {
    flex: 2,
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  strongStartButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Workout Indicator Styles
  workoutIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 999,
  },
  workoutIndicatorContent: {
    flex: 1,
  },
  workoutIndicatorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  workoutIndicatorTimer: {
    color: '#66bb6a',
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  swipeBar: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
  },

  // Settings Menu Styles
  settingsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  settingsContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    bottom: 100,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsCloseButton: {
    padding: 4,
  },
  settingsContent: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    marginBottom: 30,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 15,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingsItemText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
  },
  logoutSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  logoutSettingsText: {
    fontSize: 16,
    color: '#ff4444',
    marginLeft: 12,
    fontWeight: '500',
  },
  settingsButton: {
    padding: 4,
  },

  // Catalog Title Section
  catalogTitleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  catalogMainTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Catalog Header Styles
  catalogTitleContainer: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Food Details Section Header
  foodDetailsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addFoodButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addFoodButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  addFoodModalContainer: {
    width: '95%',
    height: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  viewDayModalContainer: {
    width: '95%',
    height: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },

  // Add Food Modal Styles
  selectedFoodName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedFoodInfo: {
    color: '#999',
    fontSize: 14,
    marginBottom: 20,
  },
  gramInputContainer: {
    marginBottom: 20,
  },
  gramInputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  gramInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  addToDayButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addToDayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nutrientPreviewSection: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  nutrientPreviewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  nutrientPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutrientPreviewItem: {
    width: '48%',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
  },
  nutrientPreviewLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 2,
  },
  nutrientPreviewValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  selectFoodPrompt: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 15,
  },
  modalSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  modalFoodList: {
    flex: 1,
  },
  modalFoodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  modalFoodItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  smallGradeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  smallGradeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalFoodItemName: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  modalFoodItemCalories: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '500',
  },

  // View Day Modal Styles
  vitalityBarSection: {
    marginBottom: 25,
  },
  vitalityBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  vitalityBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  vitalityBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
  },
  vitalityBarPercentage: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  daySummarySection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  daySummaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  daySummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  daySummaryLabel: {
    color: '#999',
    fontSize: 14,
  },
  daySummaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dayFoodsSection: {
    marginBottom: 25,
  },
  dayFoodsSectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dayFoodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  dayFoodItemLeft: {
    flex: 1,
  },
  dayFoodItemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dayFoodItemAmount: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  dayFoodItemCalories: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyDayContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyDayText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptyDaySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  nutrientBreakdownSection: {
    marginBottom: 25,
  },
  nutrientBreakdownTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  nutrientBreakdownItem: {
    marginBottom: 15,
  },
  nutrientBreakdownLabel: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 6,
  },
  nutrientBreakdownBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  nutrientBreakdownBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  nutrientBreakdownValue: {
    color: '#999',
    fontSize: 12,
  },
  
  // Categorized Nutrient Styles
  nutrientCategorySection: {
    marginBottom: 20,
  },
  nutrientCategoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  nutrientCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutrientCategoryItem: {
    width: '48%',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  nutrientCategoryLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  nutrientCategoryBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  nutrientCategoryBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3,
  },
  nutrientCategoryValue: {
    color: '#999',
    fontSize: 10,
  },

  // Insights Tab Styles
  insightsHeader: {
    padding: 20,
    marginBottom: 10,
  },
  insightsTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 5,
  },
  insightsSubtitle: {
    color: '#999',
    fontSize: 14,
  },

  // Tension Detector Card Styles
  tensionDetectorCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  tensionDetectorContent: {
    flexDirection: 'column',
  },
  tensionDetectorHeader: {
    marginBottom: 15,
  },
  tensionDetectorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  tensionDetectorDescription: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  tensionDetectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  tensionDetectorButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },

  // Coming Soon Section
  comingSoonSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  comingSoonTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  comingSoonCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  comingSoonCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  comingSoonCardText: {
    color: '#999',
    fontSize: 14,
  },

  // Tension Detector Modal Styles
  tensionDetectorModal: {
    width: '95%',
    height: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },

  // Upload Section Styles
  uploadSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 20,
  },
  uploadIconContainer: {
    marginBottom: 20,
  },
  uploadTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  uploadDescription: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 10,
    marginBottom: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadFormats: {
    color: '#666',
    fontSize: 12,
  },

  // Tension Info Section
  tensionInfoSection: {
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  tensionInfoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  tensionInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  tensionInfoNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tensionInfoNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tensionInfoText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },

  // Results Section Styles
  resultsSection: {
    padding: 20,
  },
  resultsTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  tensionRatingCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  tensionRatingLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 15,
  },
  tensionRatingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  tensionRatingValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  tensionRatingFeedback: {
    color: '#ddd',
    fontSize: 14,
    textAlign: 'center',
  },
  graphCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  graphTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  graphPlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  graphPlaceholderText: {
    color: '#666',
    fontSize: 14,
    marginTop: 10,
  },
  analyzeAnotherButton: {
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyzeAnotherButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Video Upload Styles
  selectedVideoContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectedVideoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedVideoName: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  selectedVideoSize: {
    color: '#999',
    fontSize: 12,
    marginBottom: 12,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
    minHeight: 50,
    minWidth: 140,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  analyzeButtonsContainer: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  analyzeButtonPrimary: {
    width: '100%',
    backgroundColor: '#4CAF50',
  },
  analyzeButtonSecondary: {
    width: '100%',
    backgroundColor: '#764ba2',
  },
  progressContainer: {
    marginTop: 8,
  },
  
  // Real-time Visualization Styles
  realTimeVisualizationContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  realTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeRealTimeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  realTimeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  realTimeProgress: {
    minWidth: 50,
    alignItems: 'flex-end',
  },
  realTimeProgressText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  frameDisplayContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  frameImage: {
    width: '100%',
    height: '100%',
  },
  framePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  framePlaceholderText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  realTimeStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  realTimeStat: {
    alignItems: 'center',
    flex: 1,
  },
  realTimeStatLabel: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  realTimeStatValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  realTimeProgressBar: {
    height: 4,
    backgroundColor: '#333',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  realTimeProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Graph Display Styles
  graphImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },

  // Detailed Analysis Styles
  detailedAnalysisCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  detailedAnalysisTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  analysisStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  analysisStat: {
    alignItems: 'center',
  },
  analysisStatLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  analysisStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  // Rep Breakdown Styles
  repBreakdown: {
    marginBottom: 20,
  },
  repBreakdownTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  repItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  repNumber: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  repMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repMetric: {
    color: '#ddd',
    fontSize: 12,
  },
  moreRepsText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Recommendations Styles
  recommendationsSection: {
    backgroundColor: '#0a0a0a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  recommendationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  refreshButton: {
    padding: 6,
  },
  recommendationsScroll: {
    marginHorizontal: -16,
  },
  recommendationsContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recommendationsLoading: {
    padding: 20,
    alignItems: 'center',
  },
  recommendationsLoadingText: {
    color: '#666',
    fontSize: 14,
  },
  recommendationsEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  recommendationsEmptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  recommendationCard: {
    width: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 12,
  },
  recommendationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  recommendationFoodName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  recommendationStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  recommendationStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendationStatText: {
    color: '#999',
    fontSize: 12,
  },
  recommendationScore: {
    marginBottom: 12,
  },
  recommendationScoreLabel: {
    color: '#666',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendationScoreBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  recommendationScoreFill: {
    height: '100%',
    borderRadius: 2,
  },
  recommendationScoreValue: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationReason: {
    color: '#999',
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  recommendationsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    color: '#ddd',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },

  // Action Buttons Styles
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Exercise Selection Styles
  exerciseSelectionSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  exerciseSelectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseSelectionDescription: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  exerciseScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  exerciseCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 200,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  exerciseCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3d1a',
  },
  exerciseCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseCardTitleSelected: {
    color: '#4CAF50',
  },
  exerciseCardDescription: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  exerciseCardDescriptionSelected: {
    color: '#66bb6a',
  },
  exerciseCardDifficulty: {
    color: '#FFC107',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  exerciseCardDifficultySelected: {
    color: '#FFD54F',
  },
  exerciseCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  exerciseCardCategory: {
    color: '#666',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  exerciseCardCategorySelected: {
    color: '#81c784',
  },
});
