#!/usr/bin/env python3
"""
Test script to verify Gemini API functionality
"""

import google.generativeai as genai
import os
import sys

def test_gemini_api():
    """Test the Gemini API with your key"""
    
    # Set up the API key
    api_key = "AIzaSyC2RqFc-JViNGLpEgggguo8WXvC8xCIbjw"
    genai.configure(api_key=api_key)
    
    print("Testing Gemini API...")
    
    try:
        # Test with gemini-2.0-flash-exp model
        print("1. Testing gemini-2.0-flash-exp model...")
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        response = model.generate_content(
            "Say hello and confirm you're working",
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=50,
            )
        )
        
        if response and response.text:
            print(f"✅ gemini-2.0-flash-exp works: {response.text}")
        else:
            print("❌ gemini-2.0-flash-exp returned empty response")
            
    except Exception as e:
        print(f"❌ gemini-2.0-flash-exp failed: {e}")
        
        # Try fallback models
        fallback_models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
        
        for model_name in fallback_models:
            try:
                print(f"2. Testing fallback model: {model_name}...")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content("Say hello briefly")
                
                if response and response.text:
                    print(f"✅ {model_name} works: {response.text}")
                    return model_name
                else:
                    print(f"❌ {model_name} returned empty response")
                    
            except Exception as e:
                print(f"❌ {model_name} failed: {e}")
                continue
    
    return "gemini-2.0-flash-exp"  # Default

if __name__ == "__main__":
    working_model = test_gemini_api()
    print(f"\n🎯 Recommended model to use: {working_model}")
