#!/bin/bash

# Slack Bot起動スクリプト

echo "🚀 Starting Slack Bot..."

# 環境変数ファイルの確認
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with your Slack tokens:"
    echo "SLACK_BOT_TOKEN=xoxb-your-bot-token"
    echo "SLACK_APP_TOKEN=xapp-your-app-token"
    exit 1
fi

# 依存関係の確認
if [ ! -f requirements.txt ]; then
    echo "❌ requirements.txt not found!"
    exit 1
fi

# 仮想環境のアクティベート（存在する場合）
if [ -d "slack-mcp-bot" ]; then
    echo "📦 Activating virtual environment..."
    source slack-mcp-bot/bin/activate
fi

# 依存関係のインストール
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Botの起動
echo "🤖 Starting Slack Bot..."
python app.py 