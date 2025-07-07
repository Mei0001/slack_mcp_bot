#!/bin/bash

# OAuth統合開発環境起動スクリプト
echo "🚀 OAuth統合開発環境を起動します..."

# 必須サービスの確認
echo "🔍 必須サービスの確認中..."

# Redis確認
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redisサーバーが起動していません"
    echo "💡 Redisを起動してください:"
    echo "   brew services start redis"
    echo "   または: redis-server"
    read -p "Redisを起動しましたか？ (y/n): " redis_ready
    if [ "$redis_ready" != "y" ]; then
        echo "❌ Redis起動後に再実行してください"
        exit 1
    fi
fi

echo "✅ Redis: 起動中"

# OAuth Server起動（バックグラウンド）
echo "📡 OAuth Server起動中..."
python oauth_server.py &
OAUTH_PID=$!
echo "OAuth Server PID: $OAUTH_PID"

# 少し待機
sleep 3

# OAuth Serverの起動確認
if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ OAuth Server: 起動成功"
else
    echo "❌ OAuth Server: 起動失敗"
    kill $OAUTH_PID 2>/dev/null
    exit 1
fi

# Mastra Agent起動（バックグラウンド）
echo "🤖 Mastra Agent起動中..."
cd slack-mcp-agent
npm run server:dev &
AGENT_PID=$!
echo "Mastra Agent PID: $AGENT_PID"
cd ..

# 少し待機
sleep 5

# Mastra Agentの起動確認
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Mastra Agent: 起動成功"
else
    echo "❌ Mastra Agent: 起動失敗"
    kill $OAUTH_PID $AGENT_PID 2>/dev/null
    exit 1
fi

# Slack Bot起動
echo "💬 Slack Bot起動中..."
python app.py &
BOT_PID=$!

echo ""
echo "🎉 すべてのサービスが起動しました！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📡 OAuth Server:   http://localhost:5001"
echo "🤖 Mastra Agent:   http://localhost:3001"
echo "💬 Slack Bot:      起動中"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 使用方法:"
echo "1. Slackで '/mcp' と入力"
echo "2. 'Notion' ボタンをクリック"
echo "3. OAuth認証フローを完了"
echo "4. '検索 [キーワード]' または '@bot [質問]' で使用"
echo ""
echo "🛑 停止するには Ctrl+C を押してください"

# シグナルハンドリング
cleanup() {
    echo ""
    echo "🛑 サービスを停止中..."
    kill $OAUTH_PID $AGENT_PID $BOT_PID 2>/dev/null
    echo "✅ すべてのサービスが停止しました"
    exit 0
}

trap cleanup INT TERM

# プロセスの監視
wait $BOT_PID