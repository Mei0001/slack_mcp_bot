# Slack MCP Bot

Claude AIエージェントとMCPサーバーを統合したSlack Botアプリケーションです。NotionやGoogle Driveなどの外部サービスから情報を検索・管理できるAIアシスタントです。

## 概要

このボットは以下の技術を組み合わせて構築されています：

- **Slack Bolt (Python)**: Slackとの通信を担当
- **Claude AI**: Anthropic社の大規模言語モデル
- **Mastra Framework**: TypeScript製のAIエージェントフレームワーク
- **MCP (Model Context Protocol)**: 外部ツールとの統合プロトコル
- **Notion MCP Server**: Notionとの連携を可能にするサーバー

## 主な機能

### AIアシスタント機能
- **Notion検索**: ページ、データベース、コメントの自然言語検索
- **Notion編集**: ページの更新、データベースエントリの作成・編集
- **高度な対話**: Claudeによる自然で文脈を理解した応答
- **スレッド記憶**: 会話のコンテキストを保持（最大20メッセージ、24時間）

### 基本機能
- **検索コマンド**: 「検索」「探して」「調べて」で情報検索
- **メンション応答**: ボットをメンションすると自動応答
- **スレッド対応**: スレッド内での継続的な会話
- **エラーハンドリング**: 包括的なエラー処理とフォールバック

## セットアップ

### 1. 必要なAPIキーの取得

以下のAPIキーを事前に取得してください：

1. **Slack App**: [Slack API](https://api.slack.com/apps)でアプリを作成
2. **Anthropic API**: [Anthropic Console](https://console.anthropic.com/)でAPIキーを取得
3. **Notion API**: [Notion Developers](https://developers.notion.com/)で統合を作成

### 2. 環境変数の設定

`.env`ファイルを作成し、以下を設定：

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

### 3. 依存関係のインストール

```bash
# Python依存関係
pip install -r requirements.txt

# Node.js依存関係（Mastraエージェント用）
cd slack-mcp-agent
npm install
cd ..
```

### 4. 設定確認

```bash
python check_config.py
```

### 5. サービスの起動

```bash
# すべてのサービスを起動（推奨）
./start_services.sh

# または個別に起動
# 1. Mastraエージェントサーバー
cd slack-mcp-agent && npm run server &

# 2. Slack Bot
python app.py
```

## 使用方法

### 基本的なコマンド

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

# 具体的な質問
探して 今週の会議予定

# メンションでの質問
@bot Notionから完了していないタスクを取得して

# スレッドでの会話継続
（スレッド内）それらのタスクの詳細を教えて
```

### スレッド機能

- スレッド内では@メンションなしで会話可能
- 会話のコンテキストを自動的に保持
- 最大20メッセージまで記憶
- 24時間後に自動的にリセット

## アーキテクチャ

```
Slack Client
    ↓
Slack Bot (Python + Bolt)
    ↓ HTTP通信
Mastra Bridge (Python)
    ↓ HTTP通信
Mastra Agent (Node.js)
    ↓ MCP
Notion MCP Server
    ↓ API
Notion Service
```

### コンポーネント説明

1. **Slack Bot (app.py)**: Slackイベントの受信とユーザーとの対話
2. **Mastra Bridge (mastra_bridge.py)**: PythonとNode.js間の通信橋渡し
3. **Mastra Agent**: Claude AIとMCPツールを統合したエージェント
4. **Notion MCP Server**: NotionAPIとの通信を担当
5. **Thread Memory**: スレッド単位の会話コンテキスト管理

## Slack App設定

### 必要な権限 (OAuth Scopes)
- `chat:write` - メッセージの送信
- `app_mentions:read` - メンションの読み取り
- `channels:history` - チャンネル履歴の読み取り
- `im:history` - ダイレクトメッセージ履歴の読み取り
- `mpim:history` - グループDM履歴の読み取り

### イベントサブスクリプション
- `message.channels` - チャンネルメッセージ
- `message.im` - ダイレクトメッセージ
- `message.mpim` - グループDM
- `app_mention` - アプリメンション

### Socket Mode
Socket Modeを有効化してリアルタイム通信を設定してください。

## トラブルシューティング

### 設定確認

```bash
# 基本設定の確認
python check_config.py

# エージェントサーバーの状態確認
curl http://localhost:3001/api/health

# MCPツールの動作確認
cd slack-mcp-agent && npm run test:mcp
```

### よくある問題と対処法

#### 認証エラー
- **ANTHROPIC_API_KEY**: Claude APIキーが正しく設定されているか確認
- **NOTION_API_KEY**: Notion統合トークンが有効で、適切な権限があるか確認
- **Slackトークン**: ボットトークンとアプリトークンが正しいか確認

#### 接続エラー
- **エージェントサーバー**: `http://localhost:3001`にアクセス可能か確認
- **MCPサーバー**: Notion MCPサーバーが正常に起動しているか確認
- **ファイアウォール**: ローカルポート3001が開放されているか確認

#### 応答エラー
- **API制限**: Claude APIやNotion APIの利用制限を確認
- **ツール検証**: MCPツールスキーマの検証が正常に動作しているか確認
- **メモリ**: スレッドメモリが正常に動作しているか確認

### ログの確認

```bash
# Slack Botのログ
python app.py

# Mastraエージェントのログ
cd slack-mcp-agent && npm run server

# デバッグモードでの実行
export DEBUG=mastra:*
npm run server
```

### デバッグ情報

```bash
# MCPツールの詳細確認
node -e "
const { getMCPTools } = require('./slack-mcp-agent/src/mastra/mcp.js');
getMCPTools().then(tools => console.log(Object.keys(tools)));
"

# ツールスキーマの検証
node -e "
const { debugTool } = require('./slack-mcp-agent/src/mastra/tool-validator.js');
// 特定のツールの詳細を確認
"
```

## 開発情報

### 技術スタック
- **Python 3.8+**: Slack Bot本体
- **Node.js 18+**: Mastraエージェント
- **TypeScript**: エージェントとツール開発
- **Slack Bolt SDK**: Slack統合
- **Mastra Framework**: AIエージェント構築
- **MCP Protocol**: 外部ツール統合

### ディレクトリ構造
```
slack-mcp-bot/
├── app.py                    # メインのSlack Bot
├── mastra_bridge.py          # Python-Node.js通信
├── thread_memory.py          # スレッド記憶機能
├── slack-mcp-agent/          # Node.js Mastraエージェント
│   ├── src/
│   │   ├── mastra/
│   │   │   ├── agents/       # AIエージェント
│   │   │   ├── mcp.ts        # MCP設定
│   │   │   └── tool-validator.ts  # ツール検証
│   │   └── server.ts         # HTTPサーバー
├── .env                      # 環境変数
└── requirements.txt          # Python依存関係
```

## 貢献

このプロジェクトへの貢献を歓迎します：

1. Issueの報告
2. 機能の提案
3. プルリクエストの送信
4. ドキュメントの改善
