# CLAUDE.md - Slack MCP Agent

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**Slack MCP Agent**は、Mastraフレームワークを使用したClaudeベースのAIエージェントです。Notion MCPサーバーと統合し、Slack経由で情報検索・編集機能を提供します。

### 技術スタック
- **AIフレームワーク**: Mastra (MCPサーバー統合とAIエージェント構築)
- **LLMモデル**: Anthropic Claude Sonnet 4
- **MCPサーバー**: Notion MCP Server (HTTP経由)
- **実行環境**: Node.js 20.9.0以上
- **言語**: TypeScript

## 必須コマンド

### 開発セットアップ
```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（Mastraフレームワーク）
npm run dev

# HTTPサーバー起動（Slack Bot連携用）
npm run server:dev

# 本番ビルド
npm run build

# 本番起動
npm run start
```

### サーバー起動
- **開発**: `npm run server:dev` - tsx watchでファイル変更を監視
- **本番**: `npm run server` - 直接起動

## アーキテクチャ概要

### システム構成
```
Slack Client
    ↓
Slack Bot (Python + Bolt) ← メインプロジェクト(/Users/mei/slack-bot/)
    ↓ HTTP通信
Mastra Agent (このプロジェクト)
    ↓ MCP Protocol
MCP Servers (Notion)
    ↓ REST API
External APIs (Notion)
```

### コアコンポーネント

#### 1. MCP接続 (`src/mastra/mcp.ts`)
- **Notion MCPサーバー**: HTTPプロトコルでmcp.notion.comに接続
- **ツール管理**: MCPツール・ツールセット・リソースの動的取得
- **エラーハンドリング**: 60秒タイムアウトと接続失敗時の適切な処理
- **将来拡張**: Google Drive MCPサーバーの追加準備済み

#### 2. AIエージェント (`src/mastra/agents/ai-assistant.ts`)
- **LLMモデル**: Anthropic Claude Sonnet 4 (claude-sonnet-4-20250514)
- **MCPツール統合**: 動的ツールロードとClaude互換性検証
- **日本語指示プロンプト**: 丁寧な日本語応答とエラー説明
- **フォールバック機能**: ツール接続失敗時の基本会話モード

#### 3. ツール検証 (`src/mastra/tool-validator.ts`)
- **スキーマ検証**: Claude/Anthropic API互換性のためのツール検証
- **フィルタリング**: 無効なツールの除外とデバッグ情報提供
- **エラー詳細**: 検証失敗時の詳細なログ出力

#### 4. HTTPサーバー (`src/server.ts`)
- **Express.js**: RESTful APIサーバー
- **エンドポイント**: `/api/agent/search` でSlack Botとの通信
- **エラーハンドリング**: MCPツールエラー時の自動フォールバック
- **ヘルスチェック**: `/api/health` で稼働状況確認

#### 5. Mastraメイン (`src/mastra/index.ts`)
- **エージェント初期化**: AIアシスタントの非同期初期化
- **ストレージ**: LibSQLStore（メモリ内、永続化時は file: に変更）
- **ログ**: Pinoロガーでinfo レベル出力

## 環境変数設定

### 必須環境変数
```env
# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key

# サーバー設定
AGENT_PORT=3001  # デフォルト3001

# Notion認証（MCPサーバー側で処理）
NOTION_API_KEY=your_notion_api_key
```

### 将来の拡張用（現在コメントアウト）
```env
# Google Drive MCP Server用
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret  
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
```

## ディレクトリ構造

```
slack-mcp-agent/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── ai-assistant.ts     # Claude AIエージェント
│   │   ├── mcp.ts                  # MCP接続設定
│   │   ├── tool-validator.ts       # ツール検証
│   │   └── index.ts               # Mastraエントリーポイント
│   └── server.ts                   # HTTP APIサーバー
├── package.json                    # 依存関係とスクリプト
├── tsconfig.json                   # TypeScript設定
└── CLAUDE.md                       # このファイル
```

## APIエンドポイント

### POST /api/agent/search
Slack Botからのチャットリクエストを処理

**リクエスト:**
```json
{
  "message": "ユーザーからのメッセージ",
  "threadId": "スレッドID（オプション）",
  "context": "前の会話履歴（オプション）"
}
```

**レスポンス:**
```json
{
  "response": "AIエージェントからの応答",
  "threadId": "処理されたスレッドID",
  "timestamp": "2024-07-06T12:00:00.000Z",
  "warning": "警告メッセージ（あれば）"
}
```

### GET /api/health
サーバー稼働状況の確認

**レスポンス:**
```json
{
  "status": "ok",
  "service": "Mastra AI Assistant", 
  "timestamp": "2024-07-06T12:00:00.000Z"
}
```

## 機能詳細

### 現在実装済み
- **Notion検索**: ページ内容、データベース、ユーザー情報の検索
- **Notion編集**: ページの更新、データベースエントリの作成・編集
- **自然言語処理**: Claude Sonnet 4による高品質な日本語応答
- **エラーハンドリング**: 段階的フォールバックとわかりやすいエラーメッセージ
- **スレッド管理**: threadIdによる会話コンテキストの管理

### 今後の拡張計画
- **Google Drive統合**: Google Drive MCPサーバーの追加
- **複数プラットフォーム横断検索**: Notion + Google Drive統合検索
- **キャッシング機能**: 頻繁にアクセスされる情報のキャッシュ
- **ワークフロー自動化**: 定期レポート生成等

## 開発ガイドライン

### コード規約
1. **TypeScript**: 厳密な型チェックを使用
2. **エラーハンドリング**: すべての非同期処理にtry-catchを実装
3. **ログ出力**: コンソールログでデバッグ情報を適切に出力
4. **日本語対応**: UI文字列とエラーメッセージは日本語で提供

### ファイル編集時の注意点
- **MCPツール**: `src/mastra/mcp.ts`でサーバー設定を管理
- **エージェント**: `src/mastra/agents/ai-assistant.ts`で指示プロンプトを調整
- **API**: `src/server.ts`でSlack Bot連携エンドポイントを管理
- **環境変数**: `.env`ファイルで認証情報を設定

### テストとデバッグ
```bash
# ヘルスチェック
curl http://localhost:3001/api/health

# チャット機能テスト
curl -X POST http://localhost:3001/api/agent/search \
  -H "Content-Type: application/json" \
  -d '{"message": "Notionのページを検索して"}'
```

## トラブルシューティング

### よくあるエラー

#### 1. MCPサーバー接続エラー
```
[MCP] Failed to load tools: Error connecting to MCP server
```
**解決策**: 
- Notion MCPサーバーの稼働状況確認
- `NOTION_API_KEY`環境変数の設定確認
- ネットワーク接続確認

#### 2. Claude API接続エラー
```
[Agent] ERROR: Anthropic API key not found!
```
**解決策**: 
- `ANTHROPIC_API_KEY`環境変数の設定確認
- APIキーの有効性確認
- レート制限の状況確認

#### 3. ツール検証エラー
```
[Agent] All MCP tools failed validation
```
**解決策**: 
- MCPツールスキーマの確認
- Claude互換性問題の調査
- フォールバックモードでの動作確認

### デバッグ手順
1. **ログ確認**: コンソール出力で詳細なエラー情報を確認
2. **ヘルスチェック**: `/api/health`エンドポイントでサーバー状態確認
3. **段階的テスト**: MCPツールなしでの基本動作確認
4. **環境変数**: `.env`ファイルの設定値確認

## 関連ドキュメント

- **メインプロジェクト**: `/Users/mei/slack-bot/CLAUDE.md`
- **Mastraドキュメント**: https://docs.mastra.ai/
- **MCP仕様**: https://modelcontextprotocol.io/
- **Claude API**: https://docs.anthropic.com/

## 重要な注意事項

### セキュリティ
- **APIキー**: 環境変数で管理、リポジトリにコミットしない
- **ログ**: 機密情報をログ出力しない
- **通信**: HTTPS/TLS暗号化通信の使用

### パフォーマンス
- **タイムアウト**: MCPサーバー通信は60秒でタイムアウト
- **メモリ使用**: ストレージはメモリ内、永続化時は設定変更必要
- **同時接続**: 複数リクエストの並列処理対応

### 将来の拡張
- **MCPサーバー追加**: `src/mastra/mcp.ts`でサーバー設定追加
- **新機能**: エージェント指示プロンプトの調整で機能拡張
- **UI改善**: エラーメッセージとレスポンス形式の改良