"""
Test script for Tension Detector
"""

import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_imports():
    """Test that all modules can be imported"""
    try:
        from tension_detector.pose_detector import PoseDetector
        from tension_detector.velocity_calculator import VelocityCalculator
        from tension_detector.graph_generator import GraphGenerator
        from tension_detector.tension_analyzer import TensionAnalyzer
        
        logger.info("✓ All modules imported successfully")
        return True
    except Exception as e:
        logger.error(f"✗ Import failed: {e}")
        return False

def test_initialization():
    """Test that all classes can be initialized"""
    try:
        from tension_detector.pose_detector import PoseDetector
        from tension_detector.velocity_calculator import VelocityCalculator
        from tension_detector.graph_generator import GraphGenerator
        from tension_detector.tension_analyzer import TensionAnalyzer
        
        pose_detector = PoseDetector()
        velocity_calculator = VelocityCalculator()
        graph_generator = GraphGenerator()
        tension_analyzer = TensionAnalyzer()
        
        logger.info("✓ All classes initialized successfully")
        
        # Clean up
        pose_detector.close()
        tension_analyzer.close()
        
        return True
    except Exception as e:
        logger.error(f"✗ Initialization failed: {e}")
        return False

def test_api_routes():
    """Test that API routes can be imported"""
    try:
        from routes.tension_routes import router
        
        logger.info("✓ API routes imported successfully")
        logger.info(f"  Routes: {[route.path for route in router.routes]}")
        return True
    except Exception as e:
        logger.error(f"✗ API routes import failed: {e}")
        return False

def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("Testing HimAI Tension Detector")
    logger.info("=" * 60)
    
    tests = [
        ("Module Imports", test_imports),
        ("Class Initialization", test_initialization),
        ("API Routes", test_api_routes)
    ]
    
    results = []
    for test_name, test_func in tests:
        logger.info(f"\nRunning: {test_name}")
        logger.info("-" * 60)
        result = test_func()
        results.append((test_name, result))
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("Test Summary")
    logger.info("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        logger.info(f"{test_name}: {status}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("\n🎉 All tests passed! Tension Detector is ready to use.")
        return 0
    else:
        logger.error(f"\n❌ {total - passed} test(s) failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

