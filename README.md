# Slack MCP Bot

Claude AIエージェントとMCPサーバーを統合したSlack Botアプリケーションです。NotionやGoogle Driveなどの外部サービスから情報を検索・管理できるAIアシスタントです。

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
# Slack設定
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Anthropic Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key

# Notion設定（MCPサーバー用）
NOTION_API_KEY=your-notion-api-key

# エージェントサーバー設定
AGENT_PORT=3001
```

### 2. 依存関係のインストール

```bash
# Python依存関係
pip install -r requirements.txt

# Node.js依存関係（Mastraエージェント用）
cd slack-mcp-agent
npm install
cd ..
```

### 3. 設定確認

```bash
python check_config.py
```

### 4. サービスの起動

```bash
# すべてのサービスを起動（推奨）
./start_services.sh

# または個別に起動
# 1. Mastraエージェントサーバー
cd slack-mcp-agent && npm run server &

# 2. Slack Bot
python app.py
```

## 機能

### AIアシスタント機能
- **Notion検索**: Notionのページ、データベース、コメントを検索
- **Notion編集**: ページの更新、データベースエントリの作成・編集
- **自然言語対話**: Claudeによる高度な自然言語理解と応答
- **スレッド記憶**: 会話のコンテキストを保持（最大20メッセージ、24時間）

### 基本機能
- **検索コマンド**: 「検索」「探して」「調べて」で情報検索を開始
- **メンション応答**: ボットをメンションすると自動的に検索・応答
- **ヘルプ機能**: 「help」「ヘルプ」「助けて」でヘルプメッセージを表示
- **スレッド対応**: スレッド内では自動的に会話を継続

### 技術機能
- **MCP統合**: Model Context Protocolによる外部ツール統合
- **エラーハンドリング**: 包括的なエラー処理とフォールバック機能
- **ツール検証**: Claude API互換性のためのMCPツールスキーマ検証

## コマンド一覧

| コマンド | 説明 | 例 |
|---------|------|---|
| `検索 [クエリ]` | Notionから情報を検索 | `検索 プロジェクトの進捗` |
| `探して [クエリ]` | Notionから情報を検索 | `探して 会議資料` |
| `調べて [クエリ]` | Notionから情報を検索 | `調べて タスクリスト` |
| `@botname [質問]` | ボットをメンションして質問 | `@bot Notionのタスクを教えて` |
| `help` | ヘルプメッセージを表示 | `help` |

### 使用例

```
# 基本的な検索
検索 残っているタスク

# メンションでの質問
@bot 今週の会議予定を教えて

# スレッドでの会話継続
（スレッド内）詳細を教えて
```

## Slack App設定

1. [Slack API](https://api.slack.com/apps)でアプリを作成
2. Socket Modeを有効化
3. 必要な権限を設定：
   - `chat:write`
   - `app_mentions:read`
   - `channels:history`
   - `im:history`
   - `mpim:history`
4. イベントサブスクリプションで以下を追加：
   - `message.channels`
   - `message.im`
   - `message.mpim`
   - `app_mention`

## アーキテクチャ

```
Slack Client
    ↓
Slack Bot (Python + Bolt)
    ↓
Mastra Bridge (HTTP通信)
    ↓
Mastra Agent (Node.js)
    ↓
MCP Servers (Notion)
    ↓
External APIs (Notion API)
```

## トラブルシューティング

### 設定確認
```bash
python check_config.py
```

### サービス状態確認
```bash
# エージェントサーバーの確認
curl http://localhost:3001/api/health

# MCPツールの確認
cd slack-mcp-agent && node test_mcp_direct.js
```

### ログの確認
- **Slack Bot**: コンソールに表示されるPythonログ
- **Mastraエージェント**: Node.jsサーバーのログ
- **MCP**: MCPサーバーの接続ログ

### よくある問題

#### 認証エラー
- **ANTHROPIC_API_KEY**: Claude APIキーが正しく設定されているか確認
- **NOTION_API_KEY**: Notion統合トークンが有効か確認
- **Slackトークン**: ボットトークンとアプリトークンが正しいか確認

#### 接続エラー
- **エージェントサーバー**: `http://localhost:3001`にアクセス可能か確認
- **MCPサーバー**: Notion MCPサーバーが正常に起動しているか確認
- **ネットワーク**: ファイアウォールやプロキシ設定を確認

#### ツールエラー
- **スキーマ検証**: ツールバリデーターがMCPツールを正しく処理しているか確認
- **API制限**: Claude APIやNotion APIの利用制限に達していないか確認

### デバッグモード
```bash
# 詳細ログ有効化
export DEBUG=mastra:*
npm run server

# MCPツールの詳細確認
node -e "
const { debugTool } = require('./src/mastra/tool-validator.js');
// ツールのデバッグ情報を出力
"
```
