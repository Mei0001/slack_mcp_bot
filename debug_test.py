#!/usr/bin/env python3
"""詳細なデバッグ情報を含むテスト"""

import requests
import json

def test_simple_message():
    """シンプルなメッセージのテスト"""
    print("=== Simple Message Test ===")
    
    payload = {
        "message": "こんにちは",
        "threadId": "test"
    }
    
    try:
        response = requests.post(
            "http://localhost:3001/api/agent/search",
            json=payload,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nSuccess!")
            print(f"Response text: {data.get('response', 'No response')}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_simple_message()