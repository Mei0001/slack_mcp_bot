#!/bin/bash

# シンプルな起動スクリプト（OAuth無効化）
echo "🚀 Slack Bot（シンプルモード）を起動します..."

# .envファイルの確認
if [ ! -f .env ]; then
    echo "❌ .envファイルが見つかりません"
    exit 1
fi

# 必須環境変数の確認
source .env

if [ -z "$NOTION_API_KEY" ] || [ "$NOTION_API_KEY" = "your-notion-api-key" ]; then
    echo "❌ NOTION_API_KEYが設定されていません"
    echo "💡 既存のNotionインテグレーションのAPIキーを.envに設定してください:"
    echo "   NOTION_API_KEY=secret_xxxxx"
    exit 1
fi

echo "✅ NOTION_API_KEY: 設定済み"

# 依存関係のインストール
echo "📦 依存関係のインストール中..."
pip install -r requirements.txt

# Mastra Agentのみ起動
echo "🤖 Mastra Agent起動中..."
cd slack-mcp-agent
npm run server:dev &
AGENT_PID=$!
cd ..

# 少し待機
sleep 5

# Mastra Agentの起動確認
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Mastra Agent: 起動成功"
else
    echo "❌ Mastra Agent: 起動失敗"
    kill $AGENT_PID 2>/dev/null
    exit 1
fi

# Slack Bot起動
echo "💬 Slack Bot起動中..."
python app.py &
BOT_PID=$!

echo ""
echo "🎉 シンプルモードで起動しました！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Mastra Agent:   http://localhost:3001"
echo "💬 Slack Bot:      起動中"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 使用方法:"
echo "1. '検索 [キーワード]' で検索"
echo "2. '@bot [質問]' で質問"
echo "3. OAuthは無効化されています"
echo ""
echo "🛑 停止するには Ctrl+C を押してください"

# シグナルハンドリング
cleanup() {
    echo ""
    echo "🛑 サービスを停止中..."
    kill $AGENT_PID $BOT_PID 2>/dev/null
    echo "✅ すべてのサービスが停止しました"
    exit 0
}

trap cleanup INT TERM

# プロセスの監視
wait $BOT_PID