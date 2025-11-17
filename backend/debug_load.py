#!/usr/bin/env python3
"""Debug script to test Foundation Foods loading"""

import asyncio
import sys
from pathlib import Path
sys.path.append('.')

from data_processing.usda_processor import USDAProcessor

async def main():
    print("🔍 Testing Foundation Foods loading...")
    
    processor = USDAProcessor()
    
    try:
        foods = await processor.load_and_process_data()
        print(f"✅ Successfully loaded {len(foods)} foods")
        
        if foods:
            print(f"📋 First food: {foods[0].name}")
            print(f"📊 Grade: {foods[0].grade}")
            print(f"🔥 Calories: {foods[0].calories}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
