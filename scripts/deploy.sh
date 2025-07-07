#!/bin/bash

# デプロイメントスクリプト
# 使用方法: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}

echo "🚀 OAuth Slack Bot デプロイメントを開始します (環境: $ENVIRONMENT)"

# ディレクトリ移動
cd "$(dirname "$0")/.."

# 環境変数チェック
if [ ! -f .env ]; then
    echo "❌ .envファイルが見つかりません"
    echo "💡 .env.exampleを参考に.envファイルを作成してください"
    exit 1
fi

# 必須環境変数のチェック
echo "🔍 環境変数をチェック中..."
source .env

REQUIRED_VARS=(
    "SLACK_BOT_TOKEN"
    "SLACK_APP_TOKEN"
    "ANTHROPIC_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ 必須環境変数 $var が設定されていません"
        exit 1
    fi
done

echo "✅ 必須環境変数の確認完了"

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
pip install -r requirements.txt

cd slack-mcp-agent
npm install
npm run build
cd ..

# Redis起動チェック
echo "🔍 Redisサーバーの状態を確認中..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redisサーバーが起動していません"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "❌ 本番環境ではRedisが必要です"
        exit 1
    else
        echo "💡 開発環境: Redisを起動してください"
    fi
fi

# プロセス管理用の設定
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 本番環境設定を適用中..."
    
    # systemdサービスファイルを作成
    cat > slack-oauth-bot.service << EOF
[Unit]
Description=Slack OAuth Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/bin/bash -c 'python app.py'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # OAuth Serverサービスファイルを作成
    cat > slack-oauth-server.service << EOF
[Unit]
Description=Slack OAuth Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=FLASK_ENV=production
ExecStart=/bin/bash -c 'python oauth_server.py'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Mastra Agentサービスファイルを作成
    cat > slack-mastra-agent.service << EOF
[Unit]
Description=Slack Mastra Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)/slack-mcp-agent
Environment=NODE_ENV=production
ExecStart=/bin/bash -c 'npm run start'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "📋 systemdサービスファイルを作成しました:"
    echo "   - slack-oauth-bot.service"
    echo "   - slack-oauth-server.service"
    echo "   - slack-mastra-agent.service"
    echo ""
    echo "💡 サービスを有効化するには:"
    echo "   sudo cp *.service /etc/systemd/system/"
    echo "   sudo systemctl daemon-reload"
    echo "   sudo systemctl enable slack-oauth-bot slack-oauth-server slack-mastra-agent"
    echo "   sudo systemctl start slack-oauth-bot slack-oauth-server slack-mastra-agent"

else
    echo "🔧 開発環境設定を適用中..."
    
    # 開発用の起動スクリプトを作成
    cat > start_dev.sh << EOF
#!/bin/bash
echo "🚀 開発環境を起動中..."

# OAuth Server起動
echo "📡 OAuth Server起動中..."
python oauth_server.py &
OAUTH_PID=\$!

# Mastra Agent起動
echo "🤖 Mastra Agent起動中..."
cd slack-mcp-agent
npm run server:dev &
AGENT_PID=\$!
cd ..

# Slack Bot起動
echo "💬 Slack Bot起動中..."
python app.py &
BOT_PID=\$!

echo "✅ すべてのサービスが起動しました"
echo "📡 OAuth Server: http://localhost:5001"
echo "🤖 Mastra Agent: http://localhost:3001"
echo "💬 Slack Bot: 起動中"
echo ""
echo "停止するには Ctrl+C を押してください"

# シグナルハンドリング
trap 'echo "🛑 サービスを停止中..."; kill \$OAUTH_PID \$AGENT_PID \$BOT_PID 2>/dev/null; exit' INT TERM

wait
EOF

    chmod +x start_dev.sh
    echo "📋 開発用起動スクリプトを作成しました: start_dev.sh"
fi

# 統合テストを実行
echo "🧪 統合テストを実行中..."
python test_oauth_integration.py

echo "🎉 デプロイメント準備が完了しました！"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔧 本番環境: systemdサービスファイルを手動で設置してください"
else
    echo "🔧 開発環境: ./start_dev.sh で起動できます"
fi