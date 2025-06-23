#!/usr/bin/env python3
"""Mastraエージェントのテストスクリプト"""

import requests
import json
import time

def test_health():
    """ヘルスチェック"""
    try:
        response = requests.get("http://localhost:3001/api/health")
        print(f"Health check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_search(message):
    """検索リクエストのテスト"""
    try:
        print(f"\nTesting message: '{message}'")
        payload = {
            "message": message,
            "threadId": "test-thread"
        }
        
        print("Sending request...")
        start_time = time.time()
        
        response = requests.post(
            "http://localhost:3001/api/agent/search",
            json=payload,
            timeout=60
        )
        
        elapsed_time = time.time() - start_time
        print(f"Response received in {elapsed_time:.2f} seconds")
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success! Response length: {len(result.get('response', ''))}")
            print(f"Response: {result.get('response', 'No response')[:200]}...")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.Timeout:
        print("Request timed out after 60 seconds")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("=== Mastra Agent Test ===")
    
    # ヘルスチェック
    if not test_health():
        print("Server is not running!")
        exit(1)
    
    # 簡単な挨拶をテスト
    test_search("こんにちは！調子はどう？")
    
    # 検索をテスト
    test_search("Notionで会議メモを検索して")