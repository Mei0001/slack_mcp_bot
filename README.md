# Slack MCP Bot - マルチテナント対応

Slack Boltを使用したSlack Botアプリケーションです。Mastra AIフレームワークとMCP (Model Context Protocol) を活用し、複数のNotionアカウントを管理できるマルチテナント対応のAIアシスタントボットです。

## 📊 プロジェクト状態

- **バージョン**: 1.0.0
- **最終更新**: 2025年7月6日
- **実装状況**: ✅ 本番利用可能

## 🌟 主な特徴

- **マルチテナント対応**: 1人のユーザーが複数のNotionアカウントを使い分け可能
- **OAuth 2.1 + PKCE認証**: APIキー不要でブラウザ認証によるセキュアな接続
- **スマートアカウント選択**: コンテキストに応じた自動アカウント選択
- **スレッド記憶機能**: 会話コンテキストを保持して自然な対話が可能
- **暗号化トークン管理**: AES-256-GCMによる安全なトークン保存
- **セッション管理**: 24時間の有効期限付きセッション
- **自動アカウント切り替え**: キーワードベースの賢いアカウント選択

## 🚀 クイックスタート

```bash
# リポジトリのクローン
git clone <repository-url>
cd slack-bot

# 環境設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 統合起動
./start_bot.sh
```

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
# Slack設定
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# AI設定
GEMINI_API_KEY=your-gemini-api-key

# マルチテナント設定
TOKEN_ENCRYPTION_KEY=your-32-character-encryption-key

# オプション設定
AGENT_PORT=3001
OAUTH_SERVER_PORT=3003
```

詳細な環境変数の説明は `.env.example` を参照してください。

### 2. 依存関係のインストール

```bash
# Python依存関係
pip install -r requirements.txt

# Node.js依存関係
npm install
```

### 3. 設定確認

```bash
python check_config.py
```

### 4. サービスの起動

```bash
# OAuth MCPサーバー起動（別ターミナル）
npm run oauth-server

# マルチテナントエージェント起動（別ターミナル）
npm run dev

# Slackボット起動
python app.py
```

または統合起動スクリプト:
```bash
./start_bot.sh
```

## 機能

### 基本機能
- **helloメッセージ**: ユーザーが「hello」と送信すると挨拶を返します
- **メンション応答**: ボットがメンションされると応答します
- **ヘルプ機能**: 「help」「ヘルプ」「助けて」でヘルプメッセージを表示します

### マルチテナント機能 🏢
- **アカウント管理**:
  - `アカウント一覧` / `account list` - 登録済みNotionアカウントを表示
  - `アカウント追加` / `add account` - 新しいNotionアカウントをOAuth認証で追加
  - `切り替え [アカウント名]` / `switch to [account]` - アクティブアカウントを切り替え
  
- **スマート検索**:
  - `work:検索クエリ` - 仕事用アカウントで検索
  - `personal:検索クエリ` - 個人用アカウントで検索
  - `@work 検索クエリ` - 仕事用アカウント指定（別形式）
  - `[personal] 検索クエリ` - 個人用アカウント指定（別形式）
  - 自動アカウント選択 - メッセージ内容に応じて適切なアカウントを自動選択

### AI機能
- **検索機能**: 「search」「検索」「探して」「調べて」でAIアシスタントが情報検索
- **スレッド記憶**: スレッド内の会話コンテキストを保持して自然な対話
- **時間表示**: 「time」「時間」「時刻」で現在時刻を表示
- **ジョーク機能**: 「joke」「ジョーク」「冗談」でランダムなジョークを表示
- **挨拶機能**: 
  - 「good morning」「おはよう」「おはようございます」で朝の挨拶
  - 「good night」「おやすみ」「おやすみなさい」で夜の挨拶

## 使用例

### 1. 初回セットアップ
```
User: アカウント追加
Bot: 🔐 新しいNotionアカウントの認証を開始します
     ブラウザで認証画面が開きました。
     🔗 認証URL: https://...
```

### 2. アカウント指定検索
```
User: work:会議の議事録を検索
Bot: 🏢 使用アカウント: Work Account
     🔍 検索結果: ...
```

### 3. 自動アカウント選択
```
User: プロジェクトの進捗を教えて
Bot: 🏢 使用アカウント: Work Account (キーワード: プロジェクト)
     📊 プロジェクト進捗: ...
```

## 🏗️ アーキテクチャ

```
Slack Client
    ↓
Slack Bot (app.py) + Thread Memory
    ↓
Mastra Bridge (mastra_bridge.py)
    ↓ HTTP通信 (ユーザーID付き)
Multi-Tenant Agent (src/agent/index.ts)
    ↓
MultiTenantOAuthManager
    ↓
OAuth MCP Server (tests/test_oauth_mcp_server.js)
    ↓
Notion API (OAuth 2.1 + PKCE)
```

### コンポーネント詳細

| コンポーネント | 役割 | ファイル |
|---------------|------|----------|
| **Slack Bot** | Slackインターフェース、メッセージ処理 | `app.py` |
| **Thread Memory** | スレッド記憶、会話コンテキスト管理 | `thread_memory.py` |
| **Mastra Bridge** | Python-Node.js間通信、ユーザーID管理 | `mastra_bridge.py` |
| **Multi-Tenant Agent** | AIエージェント、アカウント切り替え | `src/agent/index.ts` |
| **OAuth Manager** | マルチアカウント管理、トークン暗号化 | `src/multi_tenant_oauth_manager.ts` |
| **OAuth MCP Server** | OAuth認証、MCPプロトコル実装 | `tests/test_oauth_mcp_server.js` |

## 🔒 セキュリティ

- **トークン暗号化**: AES-256-GCMによる安全なトークン保存
- **OAuth 2.1 + PKCE**: 最新の認証標準に準拠（CSRF攻撃対策）
- **ユーザー分離**: 各SlackユーザーのデータとNotionアカウントは完全に分離
- **セッション管理**: 24時間の有効期限付きセッション、自動クリーンアップ
- **権限スコープ**: NotionアカウントごとにReadまたはRead/Write権限を管理
- **ステートレス設計**: セッション情報は暗号化してローカルファイルに保存

## 🔧 テスト

### 統合テストの実行
```bash
# 全統合テストを実行
python test_integration.py

# マルチテナントフローテスト
node tests/test_multi_tenant_flow.js

# 手動テスト用コマンド
npm run test
```

### 個別テスト
```bash
# OAuth MCPサーバーの単体テスト
node tests/test_oauth_mcp_server.js

# MCPダイレクト接続テスト
node tests/test_mcp_direct.js
```

## 🔧 トラブルシューティング

### エージェントサーバーが起動しない
```bash
# ポートが使用中の場合
lsof -i :3001
kill -9 [PID]

# 依存関係を再インストール
npm install
pip install -r requirements.txt
```

### OAuth認証が失敗する
```bash
# OAuth MCPサーバーの状態確認
curl http://localhost:3003/health

# ブラウザのキャッシュクリア
# 新しいシークレットウィンドウで認証を試行
```

### アカウントが表示されない
```bash
# データディレクトリの確認
ls -la data/oauth/

# 暗号化キーが正しく設定されているか確認
echo $TOKEN_ENCRYPTION_KEY | wc -c  # 33文字であるべき（改行含む）
```

### 一般的な問題と解決方法
```bash
# 1. 全サービス停止
pkill -f "node.*oauth"
pkill -f "tsx.*agent"

# 2. ログファイルの確認
tail -f oauth_server.log
tail -f agent.log

# 3. 設定の再確認
python check_config.py

# 4. クリーンスタート
rm -rf data/ node_modules/
npm install
./start_bot.sh
```

## コマンド一覧

| コマンド | 説明 | 実装状況 |
|---------|------|----------|
| **基本コマンド** | | |
| `hello` | ボットに挨拶 | ✅ |
| `@botname [メッセージ]` | ボットをメンション | ✅ |
| `help` / `ヘルプ` | ヘルプメッセージを表示 | ✅ |
| `time` / `時間` | 現在時刻を表示 | ✅ |
| `joke` / `ジョーク` | ランダムなジョークを表示 | ✅ |
| `good morning` / `おはよう` | 朝の挨拶 | ✅ |
| `good night` / `おやすみ` | 夜の挨拶 | ✅ |
| **アカウント管理** | | |
| `アカウント一覧` / `account list` | 登録済みNotionアカウントを表示 | ✅ |
| `アカウント追加` / `add account` | 新しいNotionアカウントを追加 | ✅ |
| `切り替え [名前]` / `switch to [name]` | アカウントを切り替え | ✅ |
| **検索コマンド** | | |
| `検索 [クエリ]` / `search [query]` | AIアシスタントで検索 | ✅ |
| `work:[クエリ]` | 仕事用アカウントで検索 | ✅ |
| `personal:[クエリ]` | 個人用アカウントで検索 | ✅ |
| `@work [クエリ]` | 仕事用アカウント指定（別形式） | ✅ |
| `[personal] [クエリ]` | 個人用アカウント指定（別形式） | ✅ |

## 📱 Slack App設定

### 1. アプリの作成
1. [Slack API](https://api.slack.com/apps)にアクセス
2. "Create New App" → "From scratch"を選択
3. App Name: `Slack MCP Bot - Multi-Tenant`
4. 使用するワークスペースを選択

### 2. OAuth & Permissions設定
**Bot Token Scopes**に以下を追加：
- `chat:write` - メッセージ送信
- `app_mentions:read` - メンション読み取り
- `channels:history` - チャンネル履歴
- `im:history` - DM履歴
- `mpim:history` - グループDM履歴

### 3. Socket Mode設定
1. "Socket Mode"ページで Socket Mode を **Enable**
2. App-Level Token を作成
   - Token Name: `socket-mode-token`
   - Scope: `connections:write`
3. 生成されたトークンを `.env` の `SLACK_APP_TOKEN` に設定

### 4. Event Subscriptions設定
1. "Event Subscriptions"で **Enable Events**
2. "Subscribe to bot events"に以下を追加：
   - `message.channels` - チャンネルメッセージ
   - `message.im` - DMメッセージ
   - `message.mpim` - グループDMメッセージ
   - `app_mention` - アプリメンション

### 5. ボットのインストール
1. "Install App"でワークスペースにインストール
2. "Bot User OAuth Token"を `.env` の `SLACK_BOT_TOKEN` に設定

### 6. 設定確認
```bash
# 設定が正しいかチェック
python check_config.py
```

### よくある問題と解決方法

| 問題 | 原因 | 解決方法 |
|------|------|----------|
| **トークンエラー** | `.env`ファイルの設定不備 | `.env.example`と比較して設定を確認 |
| **OAuth認証失敗** | MCPサーバー未起動 | `npm run oauth-server`で起動確認 |
| **アカウント表示されない** | 暗号化キー不正 | 32文字の`TOKEN_ENCRYPTION_KEY`を設定 |
| **検索機能動作しない** | エージェント未起動 | `npm run dev`でエージェント起動確認 |
| **権限エラー** | Slack App設定不備 | 上記の「Slack App設定」を再確認 |
| **ポート競合** | 既存プロセスが使用中 | `lsof -i :3001`でプロセス確認・停止 |

## 🏗️ 開発・カスタマイズ

### 新しいアカウントタイプの追加
```typescript
// src/multi_tenant_oauth_manager.ts
const accountTypes = {
  work: ['仕事', '会社', 'work', 'company'],
  personal: ['個人', 'personal', 'private'],
  // 新しいタイプを追加
  study: ['勉強', '学習', 'study', 'learning']
};
```

### 新しいSlackコマンドの追加
```python
# app.py
@app.message(re.compile(r"^your-command$", re.IGNORECASE))
def handle_your_command(message, say):
    # コマンド処理を実装
    pass
```

### MCPツールの拡張
```javascript
// tests/test_oauth_mcp_server.js
// 新しいMCPツールを追加
app.post('/mcp', (req, res) => {
  // 新しいツールの処理を追加
});
```

## 📈 パフォーマンス

- **応答時間**: 通常のメッセージ処理 < 3秒
- **OAuth認証**: 初回認証 < 30秒
- **アカウント切り替え**: < 1秒
- **メモリ使用量**: Python ~50MB, Node.js ~100MB
- **同時ユーザー**: 理論的制限なし（実際はSlack API制限による）

## 📚 関連ドキュメント

- [CLAUDE.md](./CLAUDE.md) - 開発者向け詳細仕様
- [multi_tenant_oauth_design.md](./multi_tenant_oauth_design.md) - マルチテナント設計書
- [tests/](./tests/) - テストスクリプト集
- [.env.example](./.env.example) - 環境変数テンプレート

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/新機能`)
3. 変更をコミット (`git commit -am '新機能を追加'`)
4. ブランチをプッシュ (`git push origin feature/新機能`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🆘 サポート

- 🐛 バグ報告: [Issues](../../issues)
- 💡 機能要求: [Issues](../../issues)
- 📧 お問い合わせ: 開発チームまで

---

**最終更新日**: 2025年7月6日  
**バージョン**: 1.0.0  
**メンテナンス状況**: 🟢 アクティブ
