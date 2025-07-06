#!/bin/bash

echo "🚀 Slack MCP Bot - マルチテナント対応版 起動スクリプト"
echo "================================================"

# 環境変数チェック
if [ ! -f ".env" ]; then
    echo "❌ .envファイルが見つかりません"
    echo "   .env.exampleをコピーして設定してください:"
    echo "   cp .env.example .env"
    exit 1
fi

# 仮想環境をアクティブ化
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d "env" ]; then
    source env/bin/activate
elif [ -d "slack-mcp-bot" ]; then
    source slack-mcp-bot/bin/activate
else
    echo "⚠️  仮想環境が見つかりません。"
    echo "   作成中..."
    python -m venv venv
    source venv/bin/activate
fi

# 依存関係をインストール
echo "📦 依存関係をインストール中..."
pip install -r requirements.txt > /dev/null 2>&1
npm install > /dev/null 2>&1

# 設定を確認
echo "🔍 設定を確認中..."
python check_config.py

# OAuth MCPサーバーを起動（バックグラウンド）
echo "🔐 OAuth MCPサーバーを起動中..."
node tests/test_oauth_mcp_server.js > oauth_server.log 2>&1 &
OAUTH_PID=$!
sleep 3

# マルチテナントエージェントを起動（バックグラウンド）
echo "🤖 マルチテナントエージェントを起動中..."
npm run dev > agent.log 2>&1 &
AGENT_PID=$!
sleep 5

# 終了時のクリーンアップ
cleanup() {
    echo ""
    echo "🛑 サービスを停止中..."
    kill $OAUTH_PID 2>/dev/null
    kill $AGENT_PID 2>/dev/null
    echo "✅ クリーンアップ完了"
    exit 0
}

trap cleanup INT TERM

# Slackボットを起動
echo "⚡ Slackボットを起動中..."
echo ""
echo "📝 利用可能なコマンド:"
echo "   • help - ヘルプを表示"
echo "   • アカウント追加 - 新しいNotionアカウントを追加"
echo "   • アカウント一覧 - 登録済みアカウントを表示"
echo "   • work:検索クエリ - 仕事用アカウントで検索"
echo ""
echo "終了するには Ctrl+C を押してください"
echo "================================================"

# ボットを起動
python app.py 