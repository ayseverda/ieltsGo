#!/usr/bin/env python3
"""
Test the speaking module independently
"""

import sys
import asyncio
import httpx
import json

async def test_speaking_module():
    """Test the speaking module endpoints"""
    
    base_url = "http://localhost:8004"
    
    print("Testing Speaking Module...")
    
    # Test 1: Health check
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/")
            print(f"✅ Health check: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return
    
    # Test 2: AI Response endpoint
    try:
        test_text = "Hello, I want to practice speaking English."
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{base_url}/ai-response",
                json={"text": test_text},
                timeout=30.0
            )
            
            print(f"AI Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ AI Response test: {result}")
            else:
                print(f"❌ AI Response failed: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"❌ AI Response test failed: {e}")

if __name__ == "__main__":
    print("Make sure the speaking module is running on port 8004")
    asyncio.run(test_speaking_module())
