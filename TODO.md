# TODO: Notion MCP HTTP Server - Cloudflareデプロイと運用設定

## 📋 プロジェクト概要

Notion MCPサーバーをHTTP化してCloudflare Workersにデプロイし、スケーラブルなクラウドMCP環境を構築する。

### 🎯 最終目標
- CloudflareでのHTTP MCPサーバー運用
- 軽量監視・ログシステム
- 本番環境での安定稼働

---

## ✅ 完了済みタスク

### Phase 1: HTTP MCP サーバー基盤実装 (完了)
- [x] **notion-mcp-http-server プロジェクト作成**
  - [x] `package.json` - Express, Notion Client等の依存関係
  - [x] `tsconfig.json` - TypeScript設定
  - [x] `src/types.ts` - MCPRequest, MCPResponse型定義
  - [x] `src/notion-service.ts` - 12個のNotionツール対応
  - [x] `src/server.ts` - Express HTTPサーバー実装
  - [x] `README.md` - 詳細ドキュメント

### Phase 2: Cloudflare Workers対応 (完了)
- [x] **Cloudflare Workers アダプター実装**
  - [x] `src/worker.ts` - Express→Fetch API変換
  - [x] `src/cloudflare-types.d.ts` - Workers型定義
  - [x] `wrangler.toml` - Cloudflare設定ファイル
  - [x] KVストレージ連携機能（オプション）
  - [x] CORS、セキュリティヘッダー対応

### Phase 3: クライアント統合 (完了)
- [x] **HTTPクライアントライブラリ**
  - [x] `src/http-mcp-client.ts` - リトライ付きクライアント
  - [x] ヘルスチェック、ツール一覧、実行機能
  - [x] バッチ処理対応

- [x] **Slack Bot統合**
  - [x] `slack-mcp-agent/src/mastra/http-mcp-adapter.ts` - Mastra互換アダプター
  - [x] `ai-assistant.ts` 修正 - 環境変数による切り替え
  - [x] フォールバック機能（HTTP失敗時のローカルMCP復帰）

### Phase 4: セキュリティ・品質向上 (完了)
- [x] **セキュリティ実装**
  - [x] リクエストボディでのトークン送信
  - [x] HTTPS通信、CORS制限
  - [x] ログからの認証情報除外
  - [x] エラーハンドリングとサニタイズ

- [x] **パフォーマンス最適化**
  - [x] リトライ機能（指数バックオフ）
  - [x] 詳細ログと実行時間計測
  - [x] バッチ処理（最大10件並列）

---

## 🚀 残作業タスク

### Phase 5: Cloudflareデプロイ設定 [優先度: 高]

#### 5.1 Wrangler CLI設定と初期デプロイ
- [ ] **Wrangler CLIセットアップ確認**
  ```bash
  # Wranglerインストール状況確認
  wrangler --version
  
  # Cloudflareアカウント認証
  wrangler login
  
  # プロジェクト初期化（既存設定確認）
  cd notion-mcp-http-server
  wrangler whoami
  ```

- [ ] **KVストレージ作成（オプション）**
  ```bash
  # 開発環境用
  wrangler kv:namespace create "TOKEN_CACHE" --preview
  
  # 本番環境用
  wrangler kv:namespace create "TOKEN_CACHE"
  
  # wrangler.tomlに追加
  # [[kv_namespaces]]
  # binding = "TOKEN_CACHE"
  # id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  ```

#### 5.2 環境別デプロイ設定
- [ ] **開発環境デプロイテスト**
  ```bash
  # ビルドテスト
  npm run build
  
  # 開発環境デプロイ
  wrangler deploy --name notion-mcp-dev --env development
  
  # ヘルスチェック
  curl https://notion-mcp-dev.your-subdomain.workers.dev/health
  ```

- [ ] **本番環境設定**
  ```bash
  # 本番環境デプロイ
  wrangler deploy --name notion-mcp-prod --env production
  
  # 環境変数設定
  wrangler secret put ALLOWED_ORIGINS --env production
  # 値: https://your-production-domain.com
  ```

#### 5.3 カスタムドメイン設定
- [ ] **ドメイン設定（要確認）**
  ```bash
  # カスタムドメイン追加
  wrangler route put your-domain.com/mcp/* notion-mcp-prod
  
  # または Workers Route設定
  # Cloudflare Dashboard > Workers > Routes
  ```

- [ ] **SSL/TLS設定確認**
  - [ ] Full (Strict) モード設定
  - [ ] HSTS有効化
  - [ ] 最小TLSバージョン 1.2設定

#### 5.4 デプロイ後のテスト
- [ ] **機能テスト**
  ```bash
  # 本番環境でのツール一覧取得
  curl https://your-domain/tools
  
  # 実際のトークンでのツール実行テスト
  curl -X POST https://your-domain/mcp/execute \
    -H "Content-Type: application/json" \
    -d '{"tool": "mcp_notionApi_API-get-self", "arguments": {}, "auth": {"token": "secret_xxx"}}'
  ```

- [ ] **Slack Bot統合テスト**
  ```bash
  # 本番MCP URLでのBot起動
  cd slack-mcp-agent
  MCP_MODE=http HTTP_MCP_URL=https://your-domain npm run dev
  
  # Slackでの動作確認
  # - AIアシスタントへの質問
  # - Notionツールの実行確認
  ```

---

### Phase 6: 監視・ログシステム設定 [優先度: 中]

#### 6.1 Cloudflare Analytics設定
- [ ] **Workers Analytics有効化**
  - [ ] Cloudflare Dashboard > Workers > Analytics
  - [ ] リクエスト数、レスポンス時間、エラー率監視
  - [ ] CPUとメモリ使用量確認

- [ ] **カスタムメトリクス追加**
  ```typescript
  // src/worker.ts に追加
  export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
      const start = Date.now();
      
      try {
        const response = await handleRequest(request, env);
        
        // 成功メトリクス送信
        ctx.waitUntil(logMetrics('success', Date.now() - start, request.url));
        
        return response;
      } catch (error) {
        // エラーメトリクス送信
        ctx.waitUntil(logMetrics('error', Date.now() - start, request.url, error));
        throw error;
      }
    }
  }
  ```

#### 6.2 アラート設定
- [ ] **基本アラート設定**
  - [ ] レスポンス時間 > 5秒でアラート
  - [ ] エラー率 > 5%でアラート
  - [ ] リクエスト数急増でアラート

- [ ] **通知設定**
  - [ ] Slack通知（専用チャンネル）
  - [ ] Email通知（重要度高のみ）
  - [ ] 通知頻度制限（同種アラート10分間隔）

#### 6.3 ダッシュボード作成
- [ ] **Grafana設定（オプション）**
  ```bash
  # Cloudflare GraphQL APIでデータ取得
  # カスタムダッシュボード作成
  # - リクエスト数推移
  # - レスポンス時間分布
  # - エラー率とエラー種別
  # - 地域別アクセス状況
  ```

- [ ] **定期レポート設定**
  - [ ] 日次レポート（使用量、パフォーマンス）
  - [ ] 週次レポート（傾向分析、改善提案）

---

### Phase 7: 本番移行・最適化 [優先度: 中]

#### 7.1 段階的移行実行
- [ ] **移行計画実行**
  1. [ ] 開発環境でのHTTP MCP安定稼働確認（1週間）
  2. [ ] 一部ユーザーでの本番テスト（3日間）
  3. [ ] 全ユーザーでの本番移行
  4. [ ] ローカルMCPの段階的停止

- [ ] **環境変数設定更新**
  ```bash
  # slack-mcp-agent/.env
  MCP_MODE=http
  HTTP_MCP_URL=https://your-production-domain/
  
  # ローカルMCPサーバー設定コメントアウト
  # MCP_SERVER_PATH=npx -y @notionhq/notion-mcp-server
  ```

#### 7.2 パフォーマンス監視・最適化
- [ ] **初期パフォーマンス測定**
  - [ ] 平均レスポンス時間測定
  - [ ] 同時接続数上限テスト
  - [ ] メモリ使用量監視

- [ ] **最適化実装**
  - [ ] レスポンスキャッシュ（頻繁アクセスデータ）
  - [ ] 接続プール最適化
  - [ ] エラーリトライ間隔調整

#### 7.3 運用手順書作成
- [ ] **運用マニュアル作成**
  - [ ] デプロイ手順書
  - [ ] 障害対応手順書
  - [ ] 設定変更手順書
  - [ ] 監視項目チェックリスト

- [ ] **緊急時対応準備**
  - [ ] ローカルMCPへの緊急復帰手順
  - [ ] 障害時の通知フロー
  - [ ] エスカレーション基準

---

## 🔧 設定確認項目

### 環境変数チェックリスト
```bash
# slack-mcp-agent/.env
MCP_MODE=http  # 'local' から 'http' に変更済み？
HTTP_MCP_URL=https://your-domain/  # 本番URL設定済み？

# notion-mcp-http-server/.env
NODE_ENV=production  # 本番モード設定済み？
ALLOWED_ORIGINS=https://your-bot-domain.com  # CORS設定済み？
```

### Cloudflare設定チェックリスト
- [ ] Workers プランは適切？（Free/Bundled/Unbound）
- [ ] KVストレージは必要？（現在未使用だが将来のキャッシュ用）
- [ ] カスタムドメインは設定するか？
- [ ] 地域分散は必要？（現在日本のユーザーのみ）

### セキュリティチェックリスト
- [ ] HTTPS通信強制設定
- [ ] CORS オリジン制限適切？
- [ ] レート制限は必要？（将来の大量アクセス対策）
- [ ] アクセスログの保持期間設定

---

## 🎯 今後の課題・改善案

### 短期的改善（1-2週間）
- [ ] **エラー処理強化**
  - [ ] Notion API制限時の適切なリトライ
  - [ ] タイムアウト時間の最適化
  - [ ] ユーザーフレンドリーなエラーメッセージ

- [ ] **監視強化**
  - [ ] 異常なリクエストパターンの検出
  - [ ] パフォーマンス劣化の早期発見
  - [ ] 使用量トレンドの分析

### 中期的改善（1-2ヶ月）
- [ ] **機能拡張**
  - [ ] 他のMCPサーバー対応（GitHub, Google Drive等）
  - [ ] バッチ処理の最適化
  - [ ] キャッシュ機能の追加

- [ ] **運用自動化**
  - [ ] CI/CDパイプライン構築
  - [ ] 自動デプロイ設定
  - [ ] 設定変更の自動化

### 長期的改善（3-6ヶ月）
- [ ] **アーキテクチャ進化**
  - [ ] マイクロサービス化
  - [ ] GraphQL API対応
  - [ ] リアルタイム機能（WebSocket等）

---

## 📊 想定リソース・コスト

### Cloudflare Workers使用量予測
- **リクエスト数**: 約1,000/日（3人 × 10リクエスト × 30日）
- **実行時間**: 平均200ms/リクエスト
- **データ転送**: 約10MB/日

### 予想コスト（月額）
- **Workers**: $0（Free枠内）
- **KVストレージ**: $0（未使用または少量）
- **カスタムドメイン**: $0（既存ドメイン使用の場合）

**合計**: 月額 $0-5 程度

---

## 📞 サポート・ドキュメント

### 参考資料
- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/cli-wrangler/
- **Notion API**: https://developers.notion.com/

### 作業ログ・進捗管理
- [ ] 各タスクの実行日時記録
- [ ] 遭遇した問題と解決策の記録
- [ ] 設定値と変更履歴の記録

---

**次のアクション**: Phase 5.1 のWrangler CLI設定確認から開始し、段階的にCloudflareデプロイを進める。