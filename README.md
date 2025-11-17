# HimAI - AI-Powered Fitness & Nutrition Tracker

A React Native mobile application with Python FastAPI backend for tracking workouts, nutrition, and analyzing exercise form using computer vision.

## 🎥 Demo

Watch the app in action: [YouTube Demo](https://youtu.be/gDu1nD6-Ch4)

## Features

- **Food Catalog & Nutrition Tracking**: 411+ USDA Foundation Foods with complete nutrient profiles (70+ nutrients per food), Nutrient Density Scoring (NDS) with tier grading system (S, A, B, C, D), smart search with autocomplete and filtering, multiple serving sizes, and meal history tracking.
- **Personalized Food Recommendations**: AI-powered Neural Collaborative Filtering (NCF) model that provides personalized food recommendations based on user goals (calorie/protein targets), diet type preferences, recent meal history, and nutrient profiles. Features confidence scoring, match scores, and explainable recommendations with refreshable variety.
- **Workout Management**: Custom workout templates with exercise selection, set tracking with checkmarks, progressive overload tracking, workout history with complete session logs, and exercise catalog with 22+ supported exercises.
- **Mechanical Tension Detector**: Video analysis using MediaPipe pose detection, rep counting with concentric-eccentric pattern detection, tension rating (0-100%) based on force-velocity relationship, force-velocity graphs, exercise-specific analysis for 22+ exercises, and rep-by-rep breakdown with velocity metrics.
- **AI-Generated Insights**: Weekly progress reports with AI summaries, micronutrient coverage radar chart, 3D exercise progress charts, strength change analysis, and personalized recommendations using LangChain + OpenAI.

## Tech Stack

**Frontend**: React Native (Expo SDK 54), TypeScript, Expo Router, AsyncStorage, Expo Image Picker, Expo Sharing

**Backend**: Python 3.9+, FastAPI, TensorFlow/Keras, MediaPipe, OpenCV, Matplotlib, LangChain, OpenAI, Pandas, NumPy, Scikit-learn

## Prerequisites

Before you begin, ensure you have the following dependencies installed:

1. **General**
   - Git: for cloning the repository

2. **Backend Dependencies**
   - Python 3.9 or later
   - pip: Python package installer

3. **Frontend Dependencies**
   - Node.js: version 18.x or later
   - npm: usually installed with Node.js
   - Expo CLI: `npm install -g expo-cli`

4. **Mobile Testing**
   - Expo Go app (iOS/Android) for testing on physical devices
   - iOS Simulator (for Mac) or Android Studio (for Android) for emulator testing

## Setup and Installation

### Clone the Repository

```bash
git clone <repository-url>
cd HimAI
```

### Configure Environment Variables

Copy the example environment file and add your API key (optional, for AI summaries):

```bash
cd backend
cp env.example .env
```

Now, open the `.env` file and add your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
```

### Install Dependencies

**Backend:**

```bash
cd backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Note: TensorFlow is required for food recommendations
# If you encounter issues on Apple Silicon (M1/M2), you may need:
# pip install tensorflow-macos tensorflow-metal
```

**Frontend:**

```bash
# From project root
npm install
```

### Run the Application

**Start Backend:**

```bash
cd backend
python3 main.py
```

The backend API will be running at `http://localhost:8000`

**Train Food Recommendation Model (First Time):**

Before using food recommendations, you need to train the ML model:

```bash
cd backend
python ml_models/train_food_recommender.py
```

This will:
- Generate training data from the food catalog
- Train a Neural Collaborative Filtering model
- Save the model weights and preprocessors
- Typically takes 5-10 minutes depending on your hardware

The model will be saved to `backend/models/food_recommender.h5` and will be automatically loaded when the backend starts.

**Start Frontend:**

```bash
# From project root
npm start
# or
npx expo start
```

Scan the QR code with Expo Go app (iOS/Android) or press `i` for iOS simulator / `a` for Android emulator.

**Note:** For mobile device connectivity, update `API_BASE_URL` in `services/api.ts` to your machine's local IP address (e.g., `http://192.168.1.100:8000`).

## Usage

1. Open the app on your mobile device using Expo Go or in a simulator.
2. Navigate to the **Food** tab to:
   - Browse and search the food catalog
   - View personalized food recommendations (if ML model is trained)
   - Click on any food item to view its complete nutrient profile and add it to your daily intake
   - Track your meal history
3. Navigate to the **Lifts** tab to create workout templates and track your workouts.
4. Navigate to the **Insights** tab to:
   - Upload exercise videos for tension analysis
   - Generate weekly progress reports with AI summaries
   - View nutrient coverage and exercise progress charts

## Project Architecture

The application is composed of two main parts:

- **Frontend**: A React Native (Expo) application that provides the user interface for food tracking, workout management, video analysis, and insights visualization.
- **Backend**: A FastAPI server that handles food data processing, machine learning-based food recommendations, video analysis using MediaPipe, workout history management, and AI-powered insights generation.

The backend processes USDA food data, trains and serves a Neural Collaborative Filtering model for personalized food recommendations, performs pose detection and velocity analysis on exercise videos, and generates progress reports using LangChain and OpenAI.

## API Endpoints

**Food Catalog:**
- `GET /foods` - List all foods
- `GET /foods/search?q={query}` - Search foods by name
- `GET /foods/{id}` - Get food details with full nutrient profile

**Food Recommendations (ML):**
- `GET /foods/recommend?user_id={id}&calorie_goal={goal}&protein_goal={goal}&diet_type={type}&limit={n}` - Get personalized food recommendations
- `GET /foods/recommend/health` - Check if recommendation system is available

**Tension Detector:**
- `POST /tension/analyze` - Analyze exercise video
- `GET /tension/exercises` - List supported exercises
- `GET /tension/exercises/{exercise_name}` - Get exercise details

**Insights:**
- `POST /insights/report` - Generate weekly progress report

## Troubleshooting

**Backend won't start:**
- Ensure Python 3.9+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify port 8000 is not in use

**Frontend can't connect to backend:**
- Check that backend is running on `http://localhost:8000`
- Update `API_BASE_URL` in `services/api.ts` to your machine's local IP
- Ensure mobile device and computer are on the same WiFi network

**Video analysis fails:**
- Ensure video is in supported format (MP4, MOV, WEBM)
- Check video duration (max 60 seconds recommended)
- Verify MediaPipe is properly installed: `pip install mediapipe`

**Food recommendations not available:**
- Ensure the ML model has been trained: `python backend/ml_models/train_food_recommender.py`
- Check that `backend/models/food_recommender.h5` exists
- Verify TensorFlow is installed: `pip install tensorflow==2.15.0`
- On Apple Silicon (M1/M2), you may need: `pip install tensorflow-macos tensorflow-metal`
- Check backend logs for model loading errors
- The recommendation system will gracefully degrade if TensorFlow is unavailable (backend will still run)
