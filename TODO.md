# TODO: Slack MCP OAuth統合の実装

## プロジェクト概要

画像UXフローに基づくSlack Bot用のMCPサーバーOAuth認証機能の実装

### 目標
- `/mcp`コマンドでMCPサーバー一覧表示
- インタラクティブな認証フロー
- 各ユーザーごとのトークン管理
- シームレスなMCPツール利用

## Phase 1: 基盤となるOAuthインフラの構築

### 1.1 依存関係の追加
- [ ] `requirements.txt`にRedisとFlaskの追加
  ```
  redis==4.5.4
  flask==2.3.3
  requests==2.31.0
  ```

### 1.2 Redisサーバーのセットアップ
- [ ] Redisのインストール（macOS: `brew install redis`）
- [ ] Redis設定ファイルの作成（`config/redis.conf`）
- [ ] 起動スクリプトへのRedis追加（`start_bot.sh`）

### 1.3 OAuth設定マネージャーの作成
- [ ] `oauth/config.py` - OAuth設定管理クラス
  ```python
  class OAuthConfig:
      SERVERS = {
          "notion": {
              "auth_url": "https://mcp.notion.com/authorize",
              "client_id": "Z8uuTVGoB1edIkdR",
              "redirect_uri": "http://localhost:62307/callback",
              "scope": "read,write"
          }
      }
  ```

### 1.4 トークン管理システム
- [ ] `oauth/token_manager.py` - Redis使用のトークン管理
  - [ ] `save_token(server, user_id, token_data)`
  - [ ] `get_token(server, user_id)`
  - [ ] `is_authenticated(server, user_id)`
  - [ ] `clear_token(server, user_id)`

## Phase 2: OAuth認証サーバーの実装

### 2.1 OAuth認証ハンドラー
- [ ] `oauth/oauth_handler.py` - Flaskベースの認証サーバー
  - [ ] `/authorize/<server_name>` - OAuth URL生成エンドポイント
  - [ ] `/callback` - OAuth認証後のコールバック処理
  - [ ] State parameter生成と検証
  - [ ] トークン交換処理

### 2.2 セキュリティ対応
- [ ] CSRF攻撃対策（state parameter）
- [ ] OAuth状態の有効期限管理（5分）
- [ ] エラーハンドリングと適切なレスポンス

### 2.3 成功ページの実装
- [ ] 認証成功時のHTMLページ
- [ ] ユーザーフレンドリーなメッセージ
- [ ] Slackに戻るための誘導

## Phase 3: Slackコマンドとインタラクションの実装

### 3.1 `/mcp`コマンドの実装
- [ ] `app.py`に新しいスラッシュコマンド追加
  ```python
  @app.command("/mcp")
  async def handle_mcp_command(ack, command, client):
  ```
- [ ] サブコマンドのパース（`auth`, `list`, `status`等）
- [ ] ヘルプメッセージの表示

### 3.2 MCPサーバー一覧UI
- [ ] `slack_ui/mcp_ui.py` - Slack Block Kit UI
  - [ ] `show_mcp_servers_list()` - サーバー一覧表示
  - [ ] 各サーバーの接続・認証状態表示
  - [ ] インタラクティブボタンの実装

### 3.3 MCPサーバー詳細UI
- [ ] `show_mcp_server_details()` - 詳細情報表示
  - [ ] サーバー情報（URL、機能、ツール数）
  - [ ] 認証ボタン（未認証時）
  - [ ] 管理ボタン（認証済み時：再認証、クリア等）

### 3.4 インタラクションハンドラー
- [ ] ボタンクリック処理
  - [ ] `auth_mcp_{server}` - 認証開始
  - [ ] `view_tools_{server}` - ツール一覧表示
  - [ ] `reauth_mcp_{server}` - 再認証
  - [ ] `clear_auth_{server}` - 認証クリア

## Phase 4: MCP統合とバックエンド処理

### 4.1 認証付きMCPクライアント
- [ ] `slack-mcp-agent/src/mastra/mcp.ts`の修正
  - [ ] 認証トークンを使用した接続設定
  - [ ] ユーザーごとのMCPクライアント管理
  - [ ] 動的なサーバー接続・切断

### 4.2 MCP状態管理
- [ ] `mcp/status_manager.py` - MCP接続状態管理
  - [ ] サーバー接続状態の監視
  - [ ] ツール取得とキャッシング
  - [ ] エラー状態の検出と通知

### 4.3 Node.js-Python間の認証情報共有
- [ ] `mastra_bridge.py`の修正
  - [ ] トークン情報をNode.jsに渡す機能
  - [ ] 認証状態の同期
  - [ ] エラー時のフォールバック処理

## Phase 5: ユーザーエクスペリエンスの向上

### 5.1 エラーハンドリング
- [ ] OAuth認証エラーの適切な処理
- [ ] MCP接続エラーの表示
- [ ] ユーザーフレンドリーなエラーメッセージ

### 5.2 通知システム
- [ ] 認証成功時のSlack通知
- [ ] トークン期限切れ時の通知
- [ ] サーバー接続状態変更時の通知

### 5.3 ヘルプとドキュメント
- [ ] `/mcp help`コマンドの実装
- [ ] 各機能の使用方法説明
- [ ] トラブルシューティングガイド

## Phase 6: テストとデバッグ

### 6.1 ユニットテスト
- [ ] `tests/test_oauth.py` - OAuth機能のテスト
- [ ] `tests/test_mcp_ui.py` - Slack UI機能のテスト
- [ ] `tests/test_token_manager.py` - トークン管理のテスト

### 6.2 統合テスト
- [ ] 認証フロー全体のテスト
- [ ] MCPサーバーとの連携テスト
- [ ] エラー状況での動作テスト

### 6.3 セキュリティテスト
- [ ] CSRF攻撃のテスト
- [ ] トークン漏洩のテスト
- [ ] 権限境界のテスト

## Phase 7: デプロイメントと運用

### 7.1 設定ファイルの更新
- [ ] `.env.example`にOAuth設定を追加
- [ ] `start_bot.sh`にRedisとOAuthサーバー起動を追加
- [ ] `check_config.py`にRedisとOAuth設定チェックを追加

### 7.2 ドキュメント更新
- [ ] `CLAUDE.md`にOAuth機能の説明を追加
- [ ] READMEにセットアップ手順を追加
- [ ] API仕様書の更新

### 7.3 モニタリング
- [ ] OAuth認証成功/失敗のログ
- [ ] MCP接続状態のメトリクス
- [ ] パフォーマンス監視

## ファイル構造（実装後）

```
/Users/mei/slack-bot/
├── app.py                          # 既存 + /mcpコマンド追加
├── oauth/
│   ├── __init__.py
│   ├── config.py                   # OAuth設定管理
│   ├── oauth_handler.py            # Flask認証サーバー
│   └── token_manager.py            # Redis使用のトークン管理
├── slack_ui/
│   ├── __init__.py
│   └── mcp_ui.py                   # MCPサーバー用UI
├── mcp/
│   ├── __init__.py
│   └── status_manager.py           # MCP状態管理
├── config/
│   └── redis.conf                  # Redis設定
├── tests/
│   ├── test_oauth.py
│   ├── test_mcp_ui.py
│   └── test_token_manager.py
├── requirements.txt                # 依存関係追加
├── start_bot.sh                    # 起動スクリプト更新
└── TODO.md                         # このファイル
```

## 環境変数追加

```env
# OAuth関連
OAUTH_CALLBACK_URL=http://localhost:62307/callback
OAUTH_SECRET_KEY=your_secret_key_here

# Redis関連
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# MCP OAuth設定
NOTION_OAUTH_CLIENT_ID=Z8uuTVGoB1edIkdR
NOTION_OAUTH_CLIENT_SECRET=your_notion_oauth_secret
```

## 実装優先度

### 高優先度（MVP）
1. Phase 1: 基盤となるOAuthインフラの構築
2. Phase 2: OAuth認証サーバーの実装
3. Phase 3: Slackコマンドとインタラクションの実装

### 中優先度
4. Phase 4: MCP統合とバックエンド処理
5. Phase 5: ユーザーエクスペリエンスの向上

### 低優先度（リリース後）
6. Phase 6: テストとデバッグ
7. Phase 7: デプロイメントと運用

## 推定工数

- **Phase 1-3（MVP）**: 2-3日
- **Phase 4-5（完全版）**: 2-3日
- **Phase 6-7（品質向上）**: 1-2日

**合計**: 5-8日（1人での実装想定）

## 実装上の注意点

### セキュリティ
- OAuth stateパラメーターの適切な管理
- トークンの暗号化保存
- HTTPS必須（本番環境）

### パフォーマンス
- Redisの接続プーリング
- MCP接続のキャッシング
- 非同期処理の活用

### 運用
- ログレベルの適切な設定
- メトリクス収集
- エラー監視とアラート

この実装により、画像で示されたUXフローを完全に再現し、ユーザーフレンドリーなMCP認証機能を提供できます。