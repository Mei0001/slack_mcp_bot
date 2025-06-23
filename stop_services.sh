#!/bin/bash

# 色付きログの設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Slack MCP Bot 停止スクリプト ===${NC}"

# Node.jsプロセスを停止
echo -e "${YELLOW}Node.js Mastraエージェントサーバーを停止中...${NC}"
pkill -f "tsx src/agent/index.ts" 2>/dev/null || true

# Pythonプロセスを停止
echo -e "${YELLOW}Slackボットを停止中...${NC}"
pkill -f "python app.py" 2>/dev/null || true

# ポート3001を使用中のプロセスを強制停止
echo -e "${YELLOW}ポート3001のプロセスを停止中...${NC}"
if lsof -ti:3001 > /dev/null 2>&1; then
    kill -9 $(lsof -ti:3001) 2>/dev/null || true
    echo -e "${GREEN}✓ ポート3001のプロセスを停止しました${NC}"
else
    echo -e "${GREEN}✓ ポート3001は使用されていません${NC}"
fi

sleep 2

# 確認
if lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "${RED}✗ ポート3001がまだ使用中です${NC}"
    echo -e "${YELLOW}手動で以下のコマンドを実行してください:${NC}"
    echo "sudo kill -9 \$(lsof -ti:3001)"
else
    echo -e "${GREEN}✓ すべてのプロセスが正常に停止しました${NC}"
fi