# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

Slack Bolt フレームワークを使用したPython製のSlack Botアプリケーションです。
Mastra AI フレームワークとMCP (Model Context Protocol) を活用して、Notion等の外部サービスと連携した高度なAI機能を提供します。

## 必須コマンド

### 開発セットアップ
```bash
# Python依存関係のインストール
pip install -r requirements.txt

# Node.js依存関係のインストール
npm install

# 設定の検証（環境変数と依存関係をチェック）
python check_config.py

# ボットの起動
python app.py
```

### ボットの実行
- 直接実行: `python app.py`
- スクリプト経由: `./start_bot.sh` (仮想環境の有効化と依存関係のインストールを処理)

### マルチテナントOAuthエージェントの実行
```bash
# OAuth MCPサーバー起動（認証用）
node tests/test_oauth_mcp_server.js

# マルチテナント対応エージェント起動
npx tsx src/agent/index.ts
```

## アーキテクチャ概要

### 現在のシステム構成
```
Slack Client
    ↓
Slack Bot (app.py) + Thread Memory
    ↓
Mastra Bridge (mastra_bridge.py)
    ↓ HTTP通信
Mastra Agent (src/agent/index.ts)
    ↓
MCP Servers (Notion)
    ↓
External APIs (Notion)
```

### コアコンポーネント
- **app.py**: Slack Boltフレームワークを使用したメインボットアプリケーション
  - Socket Modeアダプターでボットを初期化
  - メッセージイベントとアプリメンションを処理
  - Mastra AI エージェントとの統合
  - バイリンガル対応（日本語・英語）
  
- **mastra_bridge.py**: Python-Node.js間通信ブリッジ
  - MastraBridgeクラスでNode.jsエージェントサーバーを管理
  - HTTP通信でMastra Agentサーバーと連携
  - 自動的なサーバー起動・停止機能

- **src/agent/index.ts**: Mastra AI エージェントサーバー
  - Google Gemini 1.5 Flashモデルを使用
  - Notion MCP サーバーとの統合
  - Express.jsベースのAPIサーバー
  - ツールスキーマ検証とフォールバック機能

- **thread_memory.py**: スレッド内記憶機能
  - 会話履歴を最大20メッセージ、24時間保持
  - スレッド単位でのコンテキスト管理
  - メンションなしでのスレッド内応答を可能にする

- **check_config.py**: 設定検証ユーティリティ
  - 環境変数のフォーマットを検証
  - 依存関係のインストールをチェック
  - トークン形式の検証（ボット用: xoxb-、アプリ用: xapp-）

### イベントフロー
1. SlackとのSocket Mode接続を確立
2. ボットがイベント（メッセージ、メンション）をリッスン
3. メッセージテキストでパターンマッチング
4. Mastra Bridge経由でAI エージェントに処理を委譲
5. スレッド記憶機能でコンテキストを管理
6. Slackチャンネルに応答を送信

### 主要パターン
- すべてのメッセージハンドラーは正規表現パターンで `@app.message()` デコレーターを使用
- 正規表現の選択によるバイリンガルサポート（例: `help|ヘルプ|助けて`）
- try-exceptブロックとロギングによるエラーハンドリング
- 絵文字リアクションを含む一貫した応答フォーマット
- スレッド内でのコンテキスト継続機能

## 重要な注意事項

### セキュリティ設定
- ボットは.envファイルに以下のトークンが必要:
  - `SLACK_BOT_TOKEN`: Bot User OAuthトークン
  - `SLACK_APP_TOKEN`: Socket Mode用のアプリレベルトークン
  - `NOTION_API_KEY`: Notion API キー
  - `GEMINI_API_KEY`: Google Gemini API キー
- **警告**: 現在の.envファイルには実際のトークンが含まれており、.gitignoreに追加すべきです

### Slack アプリ要件
- Socket Modeを有効にする必要があります
- 必要なOAuthスコープ: chat:write, app_mentions:read, channels:history, im:history, mpim:history
- イベントサブスクリプション: message.channels, message.im, message.mpim, app_mention

### 技術スタック
#### Python側
- slack-bolt==1.23.0
- slack-sdk==3.35.0
- python-dotenv==1.1.0
- requests==2.31.0

#### Node.js側
- @mastra/core (latest)
- @mastra/mcp (latest)
- @ai-sdk/google (latest)
- Express.js 4.18.2
- TypeScript 5.0.0

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
5. 必要に応じてMastraエージェントの指示を調整

## 実装状況

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

## 技術的な考慮事項

### Python-Node.js間通信
- HTTP通信でMastra Agentサーバーと連携
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
- **LLMモデル**: Google Gemini 1.5 Flash
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