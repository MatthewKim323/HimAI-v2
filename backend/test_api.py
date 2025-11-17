#!/usr/bin/env python3
"""
Test script for HimAI Backend API
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{API_BASE_URL}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data['message']}")
            print(f"   Foods loaded: {data['foods_loaded']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_search_foods():
    """Test the food search endpoint"""
    print("\n🔍 Testing food search...")
    try:
        response = requests.get(f"{API_BASE_URL}/foods/search?query=apple&limit=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Search successful: {data['returned_count']} foods found")
            if data['foods']:
                print(f"   First food: {data['foods'][0]['name']}")
            return True
        else:
            print(f"❌ Search failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Search error: {e}")
        return False

def test_database_stats():
    """Test the database stats endpoint"""
    print("\n🔍 Testing database stats...")
    try:
        response = requests.get(f"{API_BASE_URL}/foods/stats")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Stats retrieved: {data['total_foods']} total foods")
            print(f"   Grade distribution: {data['grade_distribution']}")
            return True
        else:
            print(f"❌ Stats failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 HimAI Backend API Test Suite")
    print("=" * 50)
    
    # Wait a moment for server to be ready
    time.sleep(2)
    
    tests = [
        test_health_check,
        test_search_foods,
        test_database_stats
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Backend is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the server logs.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
