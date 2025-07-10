#!/bin/bash

# 色付きログの設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Slack MCP Bot 起動スクリプト ===${NC}"

# 既存のプロセスを停止
echo -e "${YELLOW}[0/3] 既存のプロセスをクリーンアップ中...${NC}"
pkill -f "tsx.*server.ts" 2>/dev/null || true
pkill -f "python app.py" 2>/dev/null || true
sleep 2

# ポート3001が解放されているか確認
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}ポート3001を使用中のプロセスを停止中...${NC}"
    kill -9 $(lsof -ti:3001) 2>/dev/null || true
    sleep 2
fi

# Node.jsサーバーをバックグラウンドで起動
echo -e "${YELLOW}[1/3] Node.js Mastraエージェントサーバーを起動中...${NC}"
cd slack-mcp-agent
npm run server &
NODE_PID=$!
cd ..

# サーバーが起動するまで待機
echo -e "${YELLOW}サーバーの起動を待っています...${NC}"
for i in {1..15}; do
    sleep 1
    if curl -s http://localhost:3001/api/health > /dev/null; then
        echo -e "${GREEN}✓ Mastraエージェントサーバーが正常に起動しました (${i}秒)${NC}"
        break
    elif [ $i -eq 15 ]; then
        echo -e "${RED}✗ Mastraエージェントサーバーの起動に失敗しました${NC}"
        kill $NODE_PID 2>/dev/null
        exit 1
    fi
done

# Pythonボットを起動
echo -e "${YELLOW}[2/3] Slackボットを起動中...${NC}"
echo -e "${GREEN}ボットが起動したら、Slackでメンションしてテストしてください！${NC}"
echo -e "${YELLOW}停止するには Ctrl+C を押してください${NC}"

# 終了時のクリーンアップを設定
cleanup() {
    echo -e "\n${YELLOW}終了処理中...${NC}"
    kill $NODE_PID 2>/dev/null || true
    pkill -f "tsx.*server.ts" 2>/dev/null || true
    pkill -f "python app.py" 2>/dev/null || true
    echo -e "${GREEN}すべてのプロセスを停止しました${NC}"
}
trap cleanup EXIT INT TERM

# Pythonボットを起動
python app.py