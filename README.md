# Slack MCP Bot

Slack Boltを使用したSlack Botアプリケーションです。

## セットアップ

### 1. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
```

### 2. 依存関係のインストール

```bash
pip install -r requirements.txt
```

### 3. 設定確認

```bash
python check_config.py
```

### 4. Botの起動

```bash
# 直接起動
python app.py

# または起動スクリプトを使用
./start_bot.sh
```

## 機能

### 基本機能
- **helloメッセージ**: ユーザーが「hello」と送信すると挨拶を返します
- **メンション応答**: ボットがメンションされると応答します
- **ヘルプ機能**: 「help」「ヘルプ」「助けて」でヘルプメッセージを表示します

### 追加機能
- **時間表示**: 「time」「時間」「時刻」で現在時刻を表示
- **ジョーク機能**: 「joke」「ジョーク」「冗談」でランダムなジョークを表示
- **挨拶機能**: 
  - 「good morning」「おはよう」「おはようございます」で朝の挨拶
  - 「good night」「おやすみ」「おやすみなさい」で夜の挨拶

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `hello` | ボットに挨拶 |
| `@botname` | ボットをメンションしてアシスタンス |
| `help` | ヘルプメッセージを表示 |
| `time` | 現在時刻を表示 |
| `joke` | ランダムなジョークを表示 |
| `good morning` | 朝の挨拶 |
| `good night` | 夜の挨拶 |

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

## トラブルシューティング

### 設定確認
```bash
python check_config.py
```

### ログの確認
Bot起動時にログが表示されます。エラーが発生した場合は、ログを確認してください。

### よくある問題
- **トークンエラー**: `.env`ファイルのトークンが正しく設定されているか確認
- **権限エラー**: Slack Appの権限設定を確認
- **接続エラー**: インターネット接続とSocket Modeの設定を確認
