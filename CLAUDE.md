# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

Slack Bolt フレームワークを使用したPython製のSlack Botアプリケーションです。日本語と英語のバイリンガル対応で、Socket Modeによるリアルタイム通信を実装しています。

## 必須コマンド

### 開発セットアップ
```bash
# 依存関係のインストール
pip install -r requirements.txt

# 設定の検証（環境変数と依存関係をチェック）
python check_config.py

# ボットの起動
python app.py
# または起動スクリプトを使用
./start_bot.sh
```

### ボットの実行
- 直接実行: `python app.py`
- スクリプト経由: `./start_bot.sh` (仮想環境の有効化と依存関係のインストールを処理)

## アーキテクチャ概要

### コアコンポーネント
- **app.py**: Slack Boltフレームワークを使用したメインボットアプリケーション
  - Socket Modeアダプターでボットを初期化
  - メッセージイベントとアプリメンションを処理
  - コマンドを適切なハンドラーにルーティング
  
- **check_config.py**: 設定検証ユーティリティ
  - 環境変数のフォーマットを検証
  - 依存関係のインストールをチェック
  - トークン形式の検証（ボット用: xoxb-、アプリ用: xapp-）

- **start_bot.sh**: 適切な環境セットアップを保証する起動スクリプト

### イベントフロー
1. SlackとのSocket Mode接続を確立
2. ボットがイベント（メッセージ、メンション）をリッスン
3. メッセージテキストでパターンマッチング
4. 適切なハンドラー関数を呼び出し
5. Slackチャンネルに応答を送信

### 主要パターン
- すべてのメッセージハンドラーは正規表現パターンで `@app.message()` デコレーターを使用
- 正規表現の選択によるバイリンガルサポート（例: `help|ヘルプ|助けて`）
- try-exceptブロックとロギングによるエラーハンドリング
- 絵文字リアクションを含む一貫した応答フォーマット

## 重要な注意事項

## ロギング
* ライブラリ: vibelogger
* 使い方: https://github.com/fladdict/vibe-logger
* vibeloggerはコーディングエージェント用に高度な構造化データを出力するロガーです。
* ログにはvibeloggerを可能な限り利用し、ログからAIが自律的に何が起きてるかを把握できるようにする
* vibeloggerにはステップ、プロセス、コンテキスト情報、TODOなど様々な情報を構造化して記録できます。
* デバッグ時には./logsの出力を参照する

# 📘 VibeLogger 運用ガイド（Node.js）

## ✅ 目的（Why）
- ClaudeなどのLLMが理解しやすい**構造化ログ**を残すため
- エラー分析・改善提案を**AIに任せる**ため
- チーム開発で**判断の可視化**・意図の共有を行うため

---

```typescript
// utils/logger.ts
import { createFileLogger } from "vibelogger";
export const logger = createFileLogger("my_project");
```

## 🧾 ログ出力テンプレート（How）

```typescript
import { logger } from "./utils/logger";

await logger.info(
  "operation_name",                // 操作ID
  "何が起きたか",                   // message
  {
    context: { key: "value" },     // 任意の詳細情報
    human_note: "AI向けの補足",     // Claude用メモ
    correlation_id: "req-1234"     // リクエスト単位で統一
  }
);
```

## 📌 使うタイミング（When）

| シーン | operation名例 | context例 |
|--------|---------------|-----------|
| API開始 | `get_user_start` | `{ user_id }` |
| 成功時 | `get_user_success` | `{ resultCount: 3 }` |
| 失敗時 | `get_user_error` | `{ error_code, stack }` |
| 外部API呼び出し | `call_payment_api` | `{ url, status }` |
| バリデーション | `invalid_input_detected` | `{ field: "email" }` |

## 📂 保存先・出力形式

- ログは `./logs/my_project/` に JSON 形式で保存されます
- Claude へログファイル全体 or 必要箇所を貼るだけで分析可能

# 📘 VibeLogger 運用ガイド（Python）

## ✅ 目的（Why）
- ClaudeなどのLLMが読みやすい**構造化ログ**を記録する
- エラーや処理の流れを**AIで自己分析・改善**する
- ログに**意図や判断理由を含めて共有**する

---

## 🛠 インストール & セットアップ

```bash
pip install vibelogger
```

```python
# utils/logger.py
from vibelogger import create_file_logger
logger = create_file_logger("my_project")
```

## 🧾 ログ出力テンプレート（How）

```python
from utils.logger import logger

logger.info(
    operation="fetch_user_data",             # 処理名
    message="ユーザーデータの取得開始",       # 人向け説明
    context={"user_id": "abc123"},           # 状況や変数
    human_note="この部分はClaudeで改善案を検討して"  # Claude用の補足
)
```

## 📌 使うタイミング（When）

| シーン | operation名例 | context例 |
|--------|---------------|-----------|
| 処理開始 | `train_model_start` | `{ model: "XGBoost", step: 1 }` |
| 成功時 | `train_model_success` | `{ accuracy: 0.89 }` |
| 例外発生 | `train_model_failed` | `{ error: str(e) }` |
| API呼び出し | `call_openai_api` | `{ endpoint, tokens }` |
| 条件分岐 | `invalid_input_detected` | `{ input_field: "email" }` |

## 📂 保存先・出力形式

- ログは `./logs/my_project/` に JSON形式で保存されます
- 実行ごとに `vibe_YYYYMMDD_HHMMSS.json` ファイルが生成
- Claude へログファイルをそのまま貼れば分析できます

### セキュリティ設定
- ボットは.envファイルに2つのトークンが必要:
  - `SLACK_BOT_TOKEN`: Bot User OAuthトークン
  - `SLACK_APP_TOKEN`: Socket Mode用のアプリレベルトークン
- **警告**: 現在の.envファイルには実際のトークンが含まれており、.gitignoreに追加すべきです

### Slack アプリ要件
- Socket Modeを有効にする必要があります
- 必要なOAuthスコープ: chat:write, app_mentions:read, channels:history, im:history, mpim:history
- イベントサブスクリプション: message.channels, message.im, message.mpim, app_mention

### 仮想環境
`slack-mcp-bot/` ディレクトリにはPython仮想環境が含まれています。依存関係を変更する際は、この環境との互換性を確保してください。

### テストとトラブルシューティング
- `test_mcp_direct.js`: MCPサーバーの接続確認用ユーティリティ
  - 使用方法: `node test_mcp_direct.js`
  - MCPツールの動作確認やトラブルシューティングに使用
- 機能を追加する際は、pytestまたはunittestを使用したテストの実装を検討してください

### ボットの拡張
新しいコマンドを追加する方法:
1. app.pyに新しい `@app.message()` ハンドラーを追加
2. 多言語サポートのために正規表現パターンを使用
3. 既存のエラーハンドリングパターンに従う
4. helpハンドラー内のヘルプメッセージを更新

## 要件定義

### 目的
NotionやGoogle Driveなど様々な情報源に散乱した情報を、Slack上から統一的に検索・編集できるAIエージェントボットを構築する。

### 主要機能要件

#### 1. 情報検索機能
- **Notion検索**: ページ内容、データベース、コメントの検索
- **Google Drive検索**: ドキュメント、スプレッドシート、プレゼンテーションの検索
- **横断検索**: 複数のプラットフォームにまたがる統合検索
- **自然言語クエリ**: 「先週のミーティングメモを探して」のような自然な質問に対応

#### 2. 情報編集機能
- **Notion編集**: ページ内容の更新、データベースエントリの追加・修正
- **Google Drive編集**: ドキュメントへの追記、スプレッドシートのセル更新
- **権限管理**: 編集権限の確認と適切なエラーハンドリング

#### 3. AIエージェント機能
- **コンテキスト理解**: 過去の会話履歴を考慮した応答
- **タスク分解**: 複雑な要求を適切なMCPサーバー呼び出しに分解
- **要約・分析**: 検索結果の要約や複数ドキュメントの横断分析
- **推奨機能**: 関連する情報の提案

### 技術要件

#### 1. コアテクノロジー
- **AIフレームワーク**: Mastra（MCPサーバー統合とAIエージェント構築）
- **LLMモデル**: Google Gemini
- **MCPサーバー**: 
  - 公式Notion MCPサーバー
  - 公式Google Drive MCPサーバー
- **Slackインテグレーション**: 既存のSlack Bolt（Socket Mode）

#### 2. システム要件
- **Python版**: 3.8以上（既存環境との互換性）
- **非同期処理**: MCPサーバー呼び出しの並列実行
- **エラー処理**: タイムアウト、API制限、権限エラーの適切な処理
- **ロギング**: 監査とデバッグのための詳細なログ

### 非機能要件

#### 1. パフォーマンス
- **応答時間**: 単純な検索は5秒以内、複雑な検索は15秒以内
- **同時実行**: 複数ユーザーからの同時リクエストに対応
- **キャッシング**: 頻繁にアクセスされる情報のキャッシュ

#### 2. セキュリティ
- **認証**: OAuth 2.0によるNotion/Google認証
- **権限管理**: ユーザーごとのアクセス権限管理
- **データ保護**: トークンの安全な保管（環境変数、シークレット管理）
- **監査ログ**: すべての操作の記録

#### 3. ユーザビリティ
- **自然な対話**: 技術的な知識なしで使用可能
- **エラーメッセージ**: 分かりやすいエラー説明と解決策の提示
- **ヘルプ機能**: コマンドと使用例の充実したドキュメント

### 制約事項
- **API制限**: 各サービスのAPI利用制限への対応
- **データサイズ**: 大容量ファイルの処理制限
- **リアルタイム性**: MCPサーバー経由のため若干の遅延あり

### 将来の拡張性
- **MCPサーバー追加**: 他のサービス（Slack、GitHub等）の追加
- **LLMモデル切替**: OpenAI、Claude等への切替可能な設計
- **機能拡張**: ワークフロー自動化、定期レポート生成等

## 実装方針

### フェーズ1: ローカル開発環境
- **認証**: 環境変数（.env）にトークン・APIキーを直接設定
- **MCPサーバー**: ローカルで起動、将来的にCloudFlareへデプロイ
- **ユーザー**: 単一ユーザー（開発者本人）での動作確認

### フェーズ2: 本番環境（将来）
- **MCPサーバー**: CloudFlareにデプロイしてリモートMCPサーバー化
- **認証**: 適切な認証フローの実装
- **マルチユーザー**: 複数ユーザー対応

### アーキテクチャ設計

#### システム構成
```
Slack Client
    ↓
Slack Bot (Python + Bolt)
    ↓
Mastra Bridge (Node.js subprocess)
    ↓
MCP Servers
    ├── Notion MCP Server
    └── Google Drive MCP Server
    ↓
External APIs (Notion, Google)
```

#### コンポーネント詳細

1. **Slack Bot Layer**
   - 既存のapp.pyを拡張
   - メッセージハンドラーでAIエージェント機能を統合
   - スレッドコンテキストの管理

2. **Mastra Bridge**
   - Node.jsサブプロセスとして実行
   - PythonからのIPC通信（stdin/stdout）
   - MCPサーバーとの通信を抽象化
   - 性能問題時はLangChainへの切り替えも検討

3. **Context Management**
   - Slackスレッド単位でコンテキスト保持
   - インメモリストレージ（初期実装）
   - 永続化は将来的にRedis等で実装

4. **Error Handling**
   - API制限エラーの検出と通知
   - 長時間処理の事前通知
   - タイムアウト処理

### 実装優先順位

1. **Phase 1: 基本機能**
   - Mastra Bridgeの実装
   - MCPサーバーとの基本的な通信
   - 単純な検索クエリの処理

2. **Phase 2: AI機能強化**
   - Geminiとの統合
   - 自然言語処理の実装
   - コンテキスト管理

3. **Phase 3: UX改善**
   - エラーメッセージの改善
   - 処理状況の表示
   - ヘルプ機能の充実

### 技術スタック詳細

#### Python側
```
slack-bolt==1.18.0  # 既存
python-dotenv==1.0.0  # 既存
google-generativeai  # Gemini API
redis  # 将来的なコンテキスト管理用
asyncio  # 非同期処理
```

#### Node.js側（Mastra Bridge）
```
@mastra/core  # Mastraフレームワーク
@modelcontextprotocol/sdk  # MCP SDK
typescript  # 型安全性
```

### 環境変数設定
```env
# 既存
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# 追加
GEMINI_API_KEY=...
NOTION_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# MCP設定
MCP_NOTION_SERVER_PATH=/path/to/notion-mcp
MCP_GDRIVE_SERVER_PATH=/path/to/gdrive-mcp

# エージェントサーバー設定
AGENT_PORT=3001
```

## 現在の実装状況

### 完了済みタスク ✅

1. **基本環境のセットアップ**
   - Node.js環境の構築（package.json, tsconfig.json）
   - Mastra Agentの実装（src/agent/index.ts）
   - Python-Node.js通信ブリッジ（mastra_bridge.py）

2. **Slack統合**
   - 検索コマンドハンドラー（「検索」「探して」「調べて」）
   - メンション時の自動検索機能
   - エラーハンドリングとスレッド対応

3. **MCP統合**
   - Notion MCPサーバーの接続とツール検証
   - Gemini LLMとMCPツールの統合
   - ツールスキーマ検証とフィルタリング機能

4. **スレッド機能**
   - スレッド内記憶機能（thread_memory.py）
   - メンションなしでのスレッド応答
   - 会話コンテキストの管理（最大20メッセージ、24時間保持）

5. **コードリファクタリング**
   - 重複コードの統一と不要ファイルの削除
   - エラーハンドリングの一貫性向上
   - ログメッセージの統一

6. **アーキテクチャ実装**
   ```
   Slack Client
       ↓
   Slack Bot (app.py) + Thread Memory
       ↓
   Mastra Bridge (mastra_bridge.py)
       ↓ HTTP通信
   Mastra Agent (src/agent/index.ts)
       ↓
   MCP Servers (Notion) ✅
       ↓
   External APIs (Notion)
   ```

### 今後の改善点 🔄

1. **Google Drive統合**
   - Google Drive MCPサーバーの追加
   - 複数プラットフォーム横断検索

2. **パフォーマンス最適化**
   - 検索結果のキャッシング
   - 長時間処理の最適化

3. **ユーザビリティ向上**
   - よりリッチな検索結果表示
   - インタラクティブなボタン操作

## 次のステップ

### 1. 依存関係のインストール
```bash
# Node.js依存関係
npm install

# Python依存関係
pip install -r requirements.txt
```

### 2. MCPサーバーの設定
Notion MCPサーバーのGitHubリポジトリからインストールし、環境変数に設定を追加

### 3. 動作確認
```bash
# 環境変数の確認
python check_config.py

# ボットの起動
python app.py
```

## 技術的な考慮事項

### Python-Node.js間通信
- JSON-RPCプロトコルでの通信
- 非同期処理によるブロッキング回避
- エラーハンドリングとリトライ機構

### パフォーマンス最適化
- 接続プーリング
- 結果のキャッシング
- 並列クエリの実行

### セキュリティ
- トークンの安全な管理
- プロセス間通信のセキュリティ
- ログのサニタイズ