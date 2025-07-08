# 🌐 Notion MCP HTTP Server

Notion MCPサーバーをHTTP API として公開し、Cloudflare Workersでの実行を可能にするプロジェクトです。

## 📋 概要

このプロジェクトは、従来のコマンドライン実行が必要なNotion MCPサーバーを、HTTP APIとして提供します。これにより、Cloudflare WorkersなどのWebプラットフォームでの実行が可能になります。

### 🏗️ アーキテクチャ

```
Slack Bot → Node.js Agent → HTTP MCP Server (Cloudflare) → Notion API
           ↳ Token渡し      ↳ ステートレス処理      ↳ 直接認証
```

## ✨ 特徴

- **🔐 セキュア認証**: トークンをリクエストボディで安全に送信
- **⚡ 高速**: HTTP/HTTPS経由の直接通信
- **🔄 リトライ機能**: 自動エラーリトライとフォールバック
- **📊 詳細ログ**: 実行時間とエラー詳細の記録
- **🌍 Cloudflare対応**: Workers環境での動作をサポート

## 🚀 セットアップ

### 1. 依存関係のインストール

```bash
cd notion-mcp-http-server
npm install
```

### 2. 環境変数の設定

```bash
# .env ファイルを作成
cat > .env << EOF
NODE_ENV=development
PORT=3002
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
EOF
```

### 3. ローカル開発サーバーの起動

```bash
# 開発モード（ホットリロード）
npm run dev

# 本番モード
npm run build
npm start
```

## 🔧 API エンドポイント

### ヘルスチェック

```bash
GET /health
```

**レスポンス例:**
```json
{
  "status": "ok",
  "service": "Notion MCP HTTP Server",
  "version": "1.0.0",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
```

### ツール一覧

```bash
GET /tools
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "mcp_notionApi_API-post-search",
        "description": "Notionワークスペース全体を検索",
        "parameters": ["query", "filter?", "sort?", "start_cursor?", "page_size?"]
      }
    ],
    "count": 12
  }
}
```

### ツール実行

```bash
POST /mcp/execute
Content-Type: application/json

{
  "tool": "mcp_notionApi_API-post-search",
  "arguments": {
    "query": "プロジェクト"
  },
  "auth": {
    "token": "secret_XXXXXXXXX",
    "version": "2022-06-28"
  }
}
```

**レスポンス例:**
```json
{
  "success": true,
  "data": {
    "results": [...],
    "next_cursor": null
  },
  "metadata": {
    "toolName": "mcp_notionApi_API-post-search",
    "executionTime": 1250,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## 🔧 Slack Bot との統合

### 段階的移行設定

既存のSlack Botで段階的にHTTP方式に移行できます：

```bash
# .env に追加
MCP_MODE=http  # 'local' または 'http'
HTTP_MCP_URL=http://localhost:3002
```

### 設定例

```typescript
// 環境変数での制御
const mcpMode = process.env.MCP_MODE || 'local';
const httpMcpUrl = process.env.HTTP_MCP_URL || 'http://localhost:3002';

if (mcpMode === 'http') {
  // HTTP MCP サーバーを使用
  console.log('Using HTTP MCP server');
} else {
  // 従来のローカルMCPを使用
  console.log('Using local MCP server');
}
```

## ☁️ Cloudflare Workers デプロイ

### 1. Wrangler CLI のインストール

```bash
npm install -g wrangler
wrangler login
```

### 2. KV ストレージの作成（オプション）

```bash
wrangler kv:namespace create "TOKEN_CACHE"
wrangler kv:namespace create "TOKEN_CACHE" --preview
```

### 3. wrangler.toml の設定

```toml
name = "notion-mcp-server"
main = "dist/worker.js"
compatibility_date = "2024-01-01"

# KV設定（取得したIDを設定）
[[kv_namespaces]]
binding = "TOKEN_CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
```

### 4. デプロイ

```bash
# ビルド
npm run build

# デプロイ
wrangler deploy

# 本番環境デプロイ
wrangler deploy --env production
```

### 5. カスタムドメインの設定（オプション）

```bash
# Cloudflareダッシュボードで設定、または
wrangler custom-domains set your-domain.com
```

## 🔐 セキュリティ

### トークン保護

- ✅ HTTPS通信で暗号化
- ✅ リクエストボディでトークン送信（ヘッダーより安全）
- ✅ 短時間キャッシュのみ（メモリ内、5分TTL）
- ✅ ログにトークンを記録しない

### CORS設定

```typescript
// 本番環境では制限
const allowedOrigins = [
  'https://your-production-domain.com',
  'http://localhost:3001' // 開発環境のみ
];
```

## 📊 モニタリング

### ログ出力例

```
[Server] 🚀 Executing MCP tool: mcp_notionApi_API-post-search
[NotionService] ✅ Tool execution completed: 1250ms
[Server] ✅ Tool execution successful: mcp_notionApi_API-post-search 1250ms
```

### Cloudflare Analytics

デプロイ後、Cloudflareダッシュボードで以下を監視：

- リクエスト数とレスポンス時間
- エラー率とステータスコード
- 地理的分布とキャッシュ効率

## 🧪 テスト

### 手動テスト

```bash
# ヘルスチェック
curl http://localhost:3002/health

# ツール一覧
curl http://localhost:3002/tools

# ツール実行（要トークン）
curl -X POST http://localhost:3002/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "mcp_notionApi_API-post-search",
    "arguments": {"query": "test"},
    "auth": {"token": "secret_XXXXX"}
  }'
```

### 統合テスト

```bash
# Slack Botとの連携テスト
MCP_MODE=http HTTP_MCP_URL=http://localhost:3002 npm run server:dev
```

## 🔧 開発

### ディレクトリ構造

```
notion-mcp-http-server/
├── src/
│   ├── types.ts           # 型定義
│   ├── notion-service.ts  # Notion API ラッパー
│   ├── server.ts          # Express サーバー
│   ├── worker.ts          # Cloudflare Workers アダプター
│   └── cloudflare-types.d.ts # CF Workers 型定義
├── dist/                  # ビルド出力
├── package.json
├── tsconfig.json
├── wrangler.toml         # Cloudflare 設定
└── README.md
```

### スクリプト

```bash
npm run dev        # 開発サーバー（ホットリロード）
npm run build      # TypeScript ビルド
npm start          # 本番サーバー起動
```

## ❓ トラブルシューティング

### よくある問題

1. **ポート衝突**
   ```bash
   Error: EADDRINUSE: address already in use :::3002
   ```
   → PORT環境変数で変更: `PORT=3003 npm run dev`

2. **Notion認証エラー**
   ```bash
   [NotionService] ❌ Tool execution failed: Unauthorized
   ```
   → トークンの有効性を確認

3. **CORS エラー**
   ```bash
   Access to fetch blocked by CORS policy
   ```
   → ALLOWED_ORIGINS環境変数を設定

### デバッグログの有効化

```bash
NODE_ENV=development npm run dev
```

## 📚 関連ドキュメント

- [Notion API Reference](https://developers.notion.com/reference)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Mastra MCP Documentation](https://docs.mastra.ai/mcp)

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照 