#!/usr/bin/env python3
"""
OAuth統合テストスクリプト
使用方法: python test_oauth_integration.py
"""

import os
import sys
import redis
import requests
import json
from dotenv import load_dotenv

# 環境変数を読み込み
load_dotenv()

def test_redis_connection():
    """Redis接続テスト"""
    try:
        redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
        redis_client.ping()
        print("✅ Redis: 接続成功")
        return True
    except Exception as e:
        print(f"❌ Redis: 接続失敗 - {e}")
        return False

def test_oauth_server():
    """OAuth Server接続テスト"""
    try:
        port = os.getenv('OAUTH_SERVER_PORT', 5001)
        response = requests.get(f'http://localhost:{port}/health', timeout=5)
        if response.status_code == 200:
            print("✅ OAuth Server: 動作中")
            return True
        else:
            print(f"❌ OAuth Server: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ OAuth Server: 接続失敗 - {e}")
        return False

def test_mastra_agent():
    """Mastra Agent接続テスト"""
    try:
        port = os.getenv('AGENT_PORT', 3001)
        response = requests.get(f'http://localhost:{port}/api/health', timeout=5)
        if response.status_code == 200:
            print("✅ Mastra Agent: 動作中")
            return True
        else:
            print(f"❌ Mastra Agent: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Mastra Agent: 接続失敗 - {e}")
        return False

def test_environment_variables():
    """環境変数の設定チェック"""
    required_vars = [
        'SLACK_BOT_TOKEN',
        'SLACK_APP_TOKEN',
        'ANTHROPIC_API_KEY'
    ]
    
    optional_vars = [
        'NOTION_OAUTH_CLIENT_ID',
        'NOTION_OAUTH_CLIENT_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'REDIS_URL',
        'OAUTH_REDIRECT_URI'
    ]
    
    print("\n🔍 環境変数チェック:")
    all_good = True
    
    for var in required_vars:
        if os.getenv(var):
            print(f"✅ {var}: 設定済み")
        else:
            print(f"❌ {var}: 未設定 (必須)")
            all_good = False
    
    for var in optional_vars:
        if os.getenv(var):
            print(f"✅ {var}: 設定済み")
        else:
            print(f"⚠️  {var}: 未設定 (オプション)")
    
    return all_good

def test_oauth_flow_simulation():
    """OAuth フロー シミュレーション"""
    try:
        from slack_ui import generate_oauth_state, generate_oauth_url
        
        # 状態生成テスト
        state = generate_oauth_state("test_user", "test_channel", "notion")
        if state:
            print("✅ OAuth State: 生成成功")
        else:
            print("❌ OAuth State: 生成失敗")
            return False
        
        # URL生成テスト
        url = generate_oauth_url("notion", state)
        if url and url.startswith("https://"):
            print("✅ OAuth URL: 生成成功")
            return True
        else:
            print("❌ OAuth URL: 生成失敗")
            return False
            
    except Exception as e:
        print(f"❌ OAuth フロー: エラー - {e}")
        return False

def main():
    """メインテスト関数"""
    print("🧪 OAuth統合テストを開始します...\n")
    
    tests = [
        ("環境変数", test_environment_variables),
        ("Redis接続", test_redis_connection),
        ("OAuth Server", test_oauth_server),
        ("Mastra Agent", test_mastra_agent),
        ("OAuth フロー", test_oauth_flow_simulation)
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}テスト:")
        result = test_func()
        results.append((test_name, result))
    
    # 結果サマリー
    print("\n" + "="*50)
    print("📊 テスト結果サマリー:")
    print("="*50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 テスト結果: {passed}/{total} 成功")
    
    if passed == total:
        print("🎉 すべてのテストが成功しました！")
        return 0
    else:
        print("⚠️  一部のテストが失敗しました。設定を確認してください。")
        return 1

if __name__ == "__main__":
    sys.exit(main())