#!/usr/bin/env python3
"""
OAuth設定テストスクリプト
使用方法: python test_oauth_setup.py
"""

import os
import requests
from dotenv import load_dotenv
from slack_ui import generate_oauth_state, generate_oauth_url

load_dotenv()

def test_oauth_config():
    """OAuth設定をテスト"""
    print("🧪 OAuth設定テスト開始")
    
    # 環境変数確認
    client_id = os.getenv('NOTION_OAUTH_CLIENT_ID')
    client_secret = os.getenv('NOTION_OAUTH_CLIENT_SECRET')
    redirect_uri = os.getenv('OAUTH_REDIRECT_URI')
    
    print(f"✓ Client ID: {client_id}")
    print(f"✓ Client Secret: {'*' * 20}...{client_secret[-10:] if client_secret else 'None'}")
    print(f"✓ Redirect URI: {redirect_uri}")
    
    if not all([client_id, client_secret, redirect_uri]):
        print("❌ 必要な環境変数が設定されていません")
        return False
    
    # OAuth State生成テスト
    state = generate_oauth_state("test_user", "test_channel", "notion")
    if not state:
        print("❌ OAuth State生成に失敗")
        return False
    print(f"✓ OAuth State生成成功: {state}")
    
    # OAuth URL生成テスト
    auth_url = generate_oauth_url("notion", state)
    if not auth_url:
        print("❌ OAuth URL生成に失敗")
        return False
    print(f"✓ OAuth URL生成成功:")
    print(f"  {auth_url}")
    
    # URLパラメータ確認
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(auth_url)
    params = parse_qs(parsed.query)
    
    expected_params = ['client_id', 'redirect_uri', 'response_type', 'state', 'owner']
    for param in expected_params:
        if param not in params:
            print(f"❌ 必要なパラメータ '{param}' が見つかりません")
            return False
        print(f"  ✓ {param}: {params[param][0]}")
    
    print("🎉 OAuth設定テスト完了")
    return True

def test_redirect_uri_validation():
    """Redirect URI設定の検証"""
    print("\n🔍 Redirect URI設定検証")
    
    redirect_uri = os.getenv('OAUTH_REDIRECT_URI')
    
    # ローカルサーバーが起動しているかチェック
    try:
        response = requests.get('http://localhost:5001/health', timeout=5)
        if response.status_code == 200:
            print("✅ OAuth Server: 起動中")
        else:
            print("⚠️  OAuth Server: 応答異常")
    except requests.exceptions.ConnectionError:
        print("❌ OAuth Server: 未起動")
        print("💡 先に 'python oauth_server.py' を実行してください")
        return False
    except Exception as e:
        print(f"❌ OAuth Server接続エラー: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = test_oauth_config()
    if success:
        test_redirect_uri_validation()
    
    print("\n" + "="*50)
    if success:
        print("🎯 次のステップ:")
        print("1. Notion Developerでredirect_uriを設定")
        print("2. ./start_oauth_dev.sh でOAuth環境起動")
        print("3. Slackで /mcp コマンドをテスト")
    else:
        print("❌ OAuth設定に問題があります")
        print("💡 .envファイルの設定を確認してください")