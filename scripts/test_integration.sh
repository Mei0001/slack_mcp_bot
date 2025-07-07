#!/bin/bash

# OAuth統合テストスクリプト
# 使用方法: ./scripts/test_integration.sh

set -e

echo "🧪 OAuth統合テストを開始します..."

# ディレクトリ移動
cd "$(dirname "$0")/.."

# 環境変数チェック
if [ ! -f .env ]; then
    echo "❌ .envファイルが見つかりません"
    echo "💡 .env.exampleを参考に.envファイルを作成してください"
    exit 1
fi

# Python依存関係のインストール
echo "📦 Python依存関係をインストール中..."
pip install -r requirements.txt

# Node.js依存関係のインストール
echo "📦 Node.js依存関係をインストール中..."
cd slack-mcp-agent
npm install
cd ..

# Redis起動チェック
echo "🔍 Redisサーバーの状態を確認中..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redisサーバーが起動していません"
    echo "💡 Redisを起動してください: redis-server"
    echo "   または、Docker: docker run -d -p 6379:6379 redis:alpine"
fi

# OAuth Serverを起動（バックグラウンド）
echo "🚀 OAuth Serverを起動中..."
python oauth_server.py &
OAUTH_PID=$!
sleep 3

# Mastra Agentを起動（バックグラウンド）
echo "🚀 Mastra Agentを起動中..."
cd slack-mcp-agent
npm run server &
AGENT_PID=$!
cd ..
sleep 5

# 統合テストを実行
echo "🧪 統合テストを実行中..."
python test_oauth_integration.py
TEST_RESULT=$?

# バックグラウンドプロセスを終了
echo "🛑 テストサーバーを停止中..."
kill $OAUTH_PID 2>/dev/null || true
kill $AGENT_PID 2>/dev/null || true

# 結果を表示
if [ $TEST_RESULT -eq 0 ]; then
    echo "🎉 すべてのテストが成功しました！"
    echo "✅ OAuth統合の準備が完了しています"
else
    echo "❌ テストが失敗しました"
    echo "💡 エラーメッセージを確認して設定を見直してください"
fi

exit $TEST_RESULT