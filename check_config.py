#!/usr/bin/env python3
"""
Slack Bot設定確認スクリプト
"""

import os
from dotenv import load_dotenv

def check_config():
    """設定の確認"""
    print("🔍 Checking Slack Bot configuration...")
    
    # 環境変数の読み込み
    load_dotenv()
    
    # 必要な環境変数の確認
    required_vars = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN"]
    missing_vars = []
    
    for var in required_vars:
        value = os.environ.get(var)
        if not value:
            missing_vars.append(var)
        else:
            # トークンの形式確認
            if var == "SLACK_BOT_TOKEN" and not value.startswith("xoxb-"):
                print(f"⚠️  Warning: {var} should start with 'xoxb-'")
            elif var == "SLACK_APP_TOKEN" and not value.startswith("xapp-"):
                print(f"⚠️  Warning: {var} should start with 'xapp-'")
            else:
                print(f"✅ {var}: {value[:10]}...")
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("\n📝 Please create a .env file with the following content:")
        print("SLACK_BOT_TOKEN=xoxb-your-bot-token")
        print("SLACK_APP_TOKEN=xapp-your-app-token")
        return False
    
    # 依存関係の確認
    try:
        import slack_bolt
        print("✅ slack-bolt: OK")
    except ImportError:
        print("❌ slack-bolt: Not installed")
        return False
    
    try:
        import slack_sdk
        print("✅ slack-sdk: OK")
    except ImportError:
        print("❌ slack-sdk: Not installed")
        return False
    
    try:
        import dotenv
        print("✅ python-dotenv: OK")
    except ImportError:
        print("❌ python-dotenv: Not installed")
        return False
    
    print("\n🎉 Configuration check completed successfully!")
    print("🚀 You can now start the bot with: python app.py")
    return True

if __name__ == "__main__":
    check_config() 