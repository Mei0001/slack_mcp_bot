#!/usr/bin/env python3
"""
クイックテストスクリプト
プロジェクトの基本的な動作確認を行います
"""

import os
import sys
import requests
import time
import subprocess
from dotenv import load_dotenv

def test_environment():
    """環境変数のテスト"""
    print("🔍 Testing environment variables...")
    load_dotenv()
    
    required_vars = {
        'SLACK_BOT_TOKEN': 'xoxb-',
        'SLACK_APP_TOKEN': 'xapp-',
        'GEMINI_API_KEY': 'AIza',
        'NOTION_API_KEY': 'ntn_'
    }
    
    all_good = True
    for var, prefix in required_vars.items():
        value = os.environ.get(var)
        if not value:
            print(f"❌ {var}: Not set")
            all_good = False
        elif not value.startswith(prefix):
            print(f"⚠️  {var}: Wrong format (should start with {prefix})")
            all_good = False
        else:
            print(f"✅ {var}: OK")
    
    return all_good

def test_mastra_health():
    """Mastraサーバーのヘルスチェック"""
    print("\n🏥 Testing Mastra server health...")
    
    try:
        response = requests.get("http://localhost:3001/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Mastra server is running: {data}")
            return True
        else:
            print(f"❌ Mastra server returned {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Mastra server is not running")
        return False
    except Exception as e:
        print(f"❌ Error testing Mastra server: {e}")
        return False

def test_mastra_agent():
    """Mastraエージェントのテスト"""
    print("\n🤖 Testing Mastra agent...")
    
    try:
        payload = {
            "message": "こんにちは、調子はどうですか？",
            "threadId": "test-thread"
        }
        
        response = requests.post(
            "http://localhost:3001/api/agent/search",
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Agent response: {data.get('response', '')[:100]}...")
            return True
        else:
            print(f"❌ Agent returned {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing agent: {e}")
        return False

def test_python_dependencies():
    """Python依存関係のテスト"""
    print("\n📦 Testing Python dependencies...")
    
    dependencies = ['slack_bolt', 'slack_sdk', 'dotenv', 'requests']
    all_good = True
    
    for dep in dependencies:
        try:
            __import__(dep)
            print(f"✅ {dep}: OK")
        except ImportError:
            print(f"❌ {dep}: Not installed")
            all_good = False
    
    return all_good

def main():
    """メインテスト関数"""
    print("🚀 Starting quick test...\n")
    
    # 環境変数テスト
    env_ok = test_environment()
    
    # Python依存関係テスト
    deps_ok = test_python_dependencies()
    
    # Mastraサーバーテスト
    server_ok = test_mastra_health()
    
    if server_ok:
        # エージェントテスト
        agent_ok = test_mastra_agent()
    else:
        agent_ok = False
        print("\n⚠️  Mastraサーバーが起動していません。")
        print("   以下のコマンドで起動してください:")
        print("   cd slack-mcp-agent && npm run server")
    
    print(f"\n📊 Test Results:")
    print(f"   Environment: {'✅' if env_ok else '❌'}")
    print(f"   Dependencies: {'✅' if deps_ok else '❌'}")
    print(f"   Mastra Server: {'✅' if server_ok else '❌'}")
    print(f"   AI Agent: {'✅' if agent_ok else '❌'}")
    
    if all([env_ok, deps_ok, server_ok, agent_ok]):
        print("\n🎉 All tests passed! Your system is ready.")
        print("💡 Next step: Run 'python app.py' to start the Slack bot")
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
    
    return all([env_ok, deps_ok, server_ok, agent_ok])

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)