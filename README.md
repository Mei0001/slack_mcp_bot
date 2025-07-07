# 🤖 Slack MCP Bot with OAuth 2.0

Claude AIエージェントとMCPサーバーを統合したSlack Botアプリケーションです。OAuth 2.0認証によりユーザーごとに安全にNotionなどの外部サービスと連携し、自然言語で情報を検索・管理できるAIアシスタントです。

## ✨ 概要

このボットは以下の技術を組み合わせて構築されています：

- **🔐 OAuth 2.0認証**: ユーザーごとの安全なサービス連携
- **💬 Slack Bolt (Python)**: Slackとの通信を担当
- **🧠 Claude AI**: Anthropic社の大規模言語モデル
- **⚡ Mastra Framework**: TypeScript製のAIエージェントフレームワーク
- **🔗 MCP (Model Context Protocol)**: 外部ツールとの統合プロトコル
- **📝 Notion MCP Server**: Notionとの認証済み連携サーバー
- **🗄️ Redis**: トークン管理とセッション保存

## 🚀 主な機能

### 🔐 セキュアな認証システム
- **ユーザー別OAuth**: 各Slackユーザーが個別にNotionアカウント連携
- **自動トークン管理**: 30日TTL、暗号化保存、自動更新
- **CSRF保護**: state検証による攻撃防止
- **監査ログ**: 全認証イベントの詳細記録

### 💬 Slack統合機能
- **`/mcp`スラッシュコマンド**: 直感的なサービス連携UI
- **接続状況表示**: ワークスペース名、所有者、接続日時を表示
- **ワンクリック認証**: ブラウザベースの簡単認証フロー
- **リアルタイム状態管理**: 接続・切断のリアルタイム反映

### 🧠 AIアシスタント機能
- **自然言語検索**: 「先週のミーティングメモを探して」など自然な質問
- **Notion操作**: ページ更新、データベースエントリの作成・編集
- **文脈理解**: Claudeによる高度な文脈理解と応答
- **スレッド記憶**: 会話のコンテキストを保持（最大20メッセージ、24時間）

### 🎨 ユーザーエクスペリエンス
- **Block Kit UI**: リッチなSlackインターフェース
- **プログレス表示**: 処理状況のリアルタイム更新
- **エラーハンドリング**: 分かりやすいエラーメッセージと解決方法
- **ヘルプ機能**: コンテキストに応じたガイダンス

## 🛠️ セットアップ

### 1. 必要なAPIキーの取得

以下のAPIキーを事前に取得してください：

1. **Slack App**: [Slack API](https://api.slack.com/apps)でアプリを作成
   - Socket Modeを有効化
   - 必要なOAuth Scopesを設定
2. **Anthropic API**: [Anthropic Console](https://console.anthropic.com/)でAPIキーを取得
3. **Notion OAuth**: [Notion Developers](https://developers.notion.com/)でインテグレーションを作成
   - OAuth 2.0を有効化
   - Redirect URIを設定

### 2. システム要件

```bash
# 必要なソフトウェア
- Python 3.8+
- Node.js 18+
- Redis Server
- Git
```

### 3. インストール

```bash
# 1. リポジトリのクローン
git clone https://github.com/Mei0001/slack_mcp_bot.git
cd slack_mcp_bot

# 2. Python依存関係のインストール
pip install -r requirements.txt

# 3. Node.js依存関係のインストール
cd slack-mcp-agent
npm install
cd ..

# 4. Redisの起動（macOS例）
brew install redis
brew services start redis
```

### 4. 環境変数の設定

`.env`ファイルを作成し、以下を設定：

```env
# Slack設定
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Anthropic Claude API
ANTHROPIC_API_KEY=your-anthropic-api-key

# Notion OAuth設定
NOTION_OAUTH_CLIENT_ID=your-notion-client-id
NOTION_OAUTH_CLIENT_SECRET=your-notion-client-secret
OAUTH_REDIRECT_URI=your-redirect-uri

# Redis設定（オプション）
REDIS_URL=redis://localhost:6379

# エージェントサーバー設定
AGENT_PORT=3001
OAUTH_SERVER_PORT=5001
```

### 5. 設定確認

```bash
# 基本設定の確認
python check_config.py

# OAuth設定のテスト
python test_oauth_setup.py
```

### 6. サービスの起動

```bash
# 🎯 推奨: 全サービス一括起動
./start_all_services.sh

# または個別起動
./start_bot.sh &          # Slack Bot
python oauth_server.py &  # OAuth Server
```

## 💬 使用方法

### OAuth認証（初回のみ）

```
1. Slackで /mcp コマンドを実行
2. 「📝 Notion」ボタンをクリック
3. ブラウザでNotionアカウントにログイン
4. 自動的にSlackに戻り、連携完了
```

### 基本的なコマンド

| コマンド | 説明 | 例 |
|---------|------|---|
| `/mcp` | サービス連携管理 | サービス接続状況の確認・管理 |
| `検索 [クエリ]` | Notionから情報を検索 | `検索 プロジェクトの進捗` |
| `探して [クエリ]` | Notionから情報を検索 | `探して 会議資料` |
| `調べて [クエリ]` | Notionから情報を検索 | `調べて タスクリスト` |
| `@botname [質問]` | ボットをメンションして質問 | `@bot 今週のタスクを教えて` |
| `help` | ヘルプメッセージを表示 | `help` |

### 実用例

```
# 🔍 自然言語検索
検索 完了していないタスク
探して 今週の会議予定
調べて プロジェクトAの進捗

# 💬 自然な質問
@bot Notionから今日締切のタスクを取得して
@bot 先週のミーティングメモを要約して

# 📝 情報管理
@bot 新しいタスクを作成して：「README更新」
@bot プロジェクトBの状況をデータベースに更新して

# 🧵 スレッドでの継続会話
（スレッド内）それらのタスクの詳細を教えて
（スレッド内）優先度順に並べ直して
```

## 🏗️ アーキテクチャ

### システム構成図

```
Slack Client
    ↓
Slack Bot (app.py) + Thread Memory
    ↓ HTTP通信
Mastra Bridge (mastra_bridge.py)
    ↓ HTTP通信
Mastra Agent (Node.js + TypeScript)
    ↓ MCP Protocol
Authenticated MCP Client
    ↓ OAuth 2.0
External APIs (Notion, Google Drive)
    ↕
OAuth Server (oauth_server.py)
    ↓
Redis (Token Storage)
```

### セキュリティフロー

```
1. User triggers /mcp in Slack
2. OAuth Server generates secure state
3. User authenticates with Notion
4. OAuth Server validates & exchanges tokens
5. Encrypted tokens stored in Redis
6. MCP Client uses user-specific tokens
7. Secure API calls to external services
```

### コンポーネント説明

1. **Slack Bot (app.py)**: Slackイベント処理、UI表示、ユーザー対話
2. **OAuth Server (oauth_server.py)**: OAuth 2.0フロー、トークン管理
3. **Mastra Bridge (mastra_bridge.py)**: Python-Node.js間通信
4. **Mastra Agent**: Claude AIとMCPツールの統合エージェント
5. **Authenticated MCP**: ユーザートークンによる認証済みMCP接続
6. **Thread Memory**: スレッド単位の会話コンテキスト管理
7. **Redis Store**: セキュアなトークン保存とセッション管理

## 🔧 設定詳細

### Slack App設定

#### 必要な権限 (OAuth Scopes)
```
Bot Token Scopes:
- chat:write              # メッセージ送信
- chat:write.public       # パブリックチャンネル
- commands                # スラッシュコマンド
- app_mentions:read       # メンション読み取り
- channels:history        # チャンネル履歴
- im:history             # DM履歴
- mpim:history           # グループDM履歴
```

#### イベントサブスクリプション
```
- message.channels       # チャンネルメッセージ
- message.im            # ダイレクトメッセージ
- message.mpim          # グループDM
- app_mention           # アプリメンション
```

#### スラッシュコマンド
```
Command: /mcp
Request URL: (Socket Mode使用のため不要)
Description: MCP service connection management
```

### Notion OAuth設定

```
1. https://developers.notion.com/ でインテグレーション作成
2. OAuth 2.0を有効化
3. Redirect URIs設定:
   - Development: http://localhost:5001/oauth/callback
   - Production: https://your-domain.com/oauth/callback
4. 必要な権限:
   - Read content
   - Update content
   - Insert content
```

## 🐛 トラブルシューティング

### 認証関連

#### OAuth認証エラー
```bash
# 設定確認
python test_oauth_setup.py

# ログ確認
tail -f logs/oauth_server.log

# 一般的な問題:
- Redirect URIの不一致
- Client IDまたはSecretの誤り
- Redisサーバーの未起動
```

#### トークンエラー
```bash
# Redis確認
redis-cli ping
redis-cli keys "oauth:*"

# トークンリセット
redis-cli flushdb

# 再認証
/mcp → 切断 → 再接続
```

### 接続関連

#### サービス起動確認
```bash
# 全サービス状況確認
ps aux | grep -E "(app.py|oauth_server.py|node)"

# ポート確認
lsof -i :3001  # Mastra Agent
lsof -i :5001  # OAuth Server

# ヘルスチェック
curl http://localhost:3001/api/health
curl http://localhost:5001/health
```

#### ネットワークエラー
```bash
# DNS確認
nslookup api.notion.com

# ファイアウォール確認
# macOS
sudo pfctl -s rules

# 接続テスト
telnet api.notion.com 443
```

### 応答エラー

#### Claude API
```bash
# APIキー確認
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
     https://api.anthropic.com/v1/messages

# レート制限確認
# ログでHTTP 429エラーを確認
```

#### Notion API
```bash
# OAuth トークンテスト
curl -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28" \
     https://api.notion.com/v1/users/me
```

### デバッグモード

```bash
# 詳細ログ有効化
export DEBUG=mastra:*,mcp:*
export FLASK_DEBUG=true

# デバッグ起動
python app.py --debug
python oauth_server.py --debug
```

### ログファイル

```bash
# ログの場所
logs/
├── slack_bot.log        # Slack Bot
├── oauth_server.log     # OAuth Server
├── mastra_agent.log     # Mastra Agent
└── mcp_connections.log  # MCP接続

# リアルタイムログ監視
tail -f logs/*.log
```

## 🔒 セキュリティ

### セキュリティ機能

- **🔐 OAuth 2.0準拠**: PKCE、state検証
- **🛡️ トークン暗号化**: AES-256-GCM暗号化
- **⏰ 自動期限切れ**: 30日TTL、リフレッシュ対応
- **🚫 CSRF保護**: stateパラメータ検証
- **📊 監査ログ**: 全認証イベント記録
- **🔒 安全な保存**: Redis + 暗号化

### セキュリティ設定

```bash
# Redis セキュリティ
# redis.conf
requirepass your-redis-password
bind 127.0.0.1

# 環境変数
export OAUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)
export REDIS_PASSWORD=your-secure-password
```

### 本番環境推奨事項

1. **HTTPS必須**: 全通信の暗号化
2. **ファイアウォール**: 必要なポートのみ開放
3. **モニタリング**: 異常なアクセスの検出
4. **バックアップ**: Redis データの定期バックアップ
5. **更新管理**: 依存関係の定期更新

## 🚀 デプロイメント

### 開発環境
```bash
# 簡単起動
./start_all_services.sh
```

### 本番環境
```bash
# Docker使用例
docker-compose up -d

# Systemd サービス例
sudo systemctl enable slack-mcp-bot
sudo systemctl start slack-mcp-bot
```

## 📈 モニタリング

### メトリクス
- OAuth認証成功/失敗率
- API応答時間
- エラー率
- アクティブユーザー数

### アラート設定
```bash
# Redis接続監視
redis-cli ping || alert "Redis down"

# API応答監視
curl -f http://localhost:3001/health || alert "Agent down"
```

## 🤝 貢献

このプロジェクトへの貢献を歓迎します：

1. **Issue報告**: バグや機能要求
2. **Pull Request**: コード改善や新機能
3. **ドキュメント**: README改善やガイド追加
4. **テスト**: テストケース追加

### 開発環境セットアップ
```bash
# 開発モード起動
npm run dev          # Mastra Agent (ホットリロード)
python app.py --dev  # Slack Bot (デバッグモード)
```

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 🙏 謝辞

- [Anthropic](https://anthropic.com/) - Claude AIの提供
- [Mastra](https://mastra.ai/) - AIエージェントフレームワーク
- [Slack](https://slack.com/) - プラットフォーム統合
- [Notion](https://notion.so/) - データ管理プラットフォーム

---

**🤖 Generated with [Claude Code](https://claude.ai/code)**