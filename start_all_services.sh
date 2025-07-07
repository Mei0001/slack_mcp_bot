#!/bin/bash

echo "🚀 Starting All Services..."

# 既存プロセスの停止
echo "🛑 Stopping existing processes..."
pkill -f "python app.py" 2>/dev/null
pkill -f "python oauth_server.py" 2>/dev/null
sleep 2

echo "📡 Starting OAuth Server..."
python oauth_server.py &
OAUTH_PID=$!
sleep 2

echo "🤖 Starting Slack Bot..."
./start_bot.sh &
BOT_PID=$!

echo ""
echo "✅ All services started!"
echo "📡 OAuth Server PID: $OAUTH_PID"
echo "🤖 Slack Bot PID: $BOT_PID"
echo ""
echo "🛑 To stop all services: Ctrl+C"

# プロセス監視とクリーンアップ
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $OAUTH_PID $BOT_PID 2>/dev/null
    pkill -f "python app.py" 2>/dev/null
    pkill -f "python oauth_server.py" 2>/dev/null
    exit 0
}

trap cleanup INT TERM
wait