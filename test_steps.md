# プロジェクト動作確認手順

## Step 1: 環境設定確認
```bash
cd /Users/mei/Desktop/slack-mcp-bot
python check_config.py
```

## Step 2: Mastra依存関係インストール
```bash
cd slack-mcp-agent
npm install
```

## Step 3: Mastraサーバー単体テスト
```bash
cd slack-mcp-agent
npm run server
```
→ http://localhost:3001/api/health でヘルスチェック

## Step 4: MCP接続テスト
```bash
# 別ターミナルで
curl -X POST http://localhost:3001/api/agent/search \
  -H "Content-Type: application/json" \
  -d '{"message": "Notionのユーザー情報を取得してください", "threadId": "test"}'
```

## Step 5: Slack Bot起動
```bash
cd /Users/mei/Desktop/slack-mcp-bot
python app.py
```

## Step 6: Slack経由でのテスト
Slackで以下のメッセージを送信：
1. `@botname こんにちは` - 基本動作確認
2. `@botname Notionで情報を検索して` - MCP機能確認
3. スレッド内での継続会話テスト

## トラブルシューティング

### エラー1: npm install失敗
- Node.js 20.9.0以上がインストールされているか確認
- package.jsonが破損していないか確認

### エラー2: MCP接続失敗
- .envファイルのNOTION_API_KEYが正しいか確認
- Notion APIキーの権限を確認

### エラー3: Slack接続失敗
- SlackアプリのSocket Modeが有効になっているか確認
- Slack AppのOAuthスコープが正しいか確認

## ログの確認
- Mastraサーバー: コンソール出力
- Slack Bot: app.pyのログ出力
- MCP通信: [MastraBridge]プレフィックスのログ