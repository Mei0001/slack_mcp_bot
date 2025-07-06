import os
import re
import logging
import atexit
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv
from mastra_bridge import mastra_bridge
from thread_memory import thread_memory

# 環境変数の読み込み
load_dotenv(override=True)

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Slackアプリの初期化
app = App(token=os.environ.get("SLACK_BOT_TOKEN"))

# 「hello」メッセージに応答
@app.message("hello")
def message_hello(message, say):
    """ユーザーが「hello」と送信した時の応答処理"""
    user_id = message['user']
    say(f"Hello <@{user_id}>! 👋 How can I help you today?")
    logger.info(f"Responded to hello message from user {user_id}")

# ヘルプメッセージ
@app.message(re.compile(r"(help|ヘルプ|助けて)"))
def handle_help_message(message, say):
    """ヘルプ関連のメッセージに応答"""
    help_text = """
🤖 *Bot Help Menu*

*基本コマンド:*
• `hello` - ボットに挨拶
• `@botname` - ボットをメンション  
• `help` - このヘルプメッセージを表示
• `time` - 現在時刻を表示
• `search` / `検索` - AI アシスタントで情報検索
• `joke` - ランダムなジョーク

*🏢 Notion アカウント管理:*
• `アカウント一覧` / `account list` - 登録済みNotionアカウントを表示
• `アカウント追加` / `add account` - 新しいNotionアカウントを追加
• `切り替え [アカウント名]` / `switch to [account]` - アカウントを切り替え
• `work:検索クエリ` - 仕事用アカウントで検索
• `personal:検索クエリ` - 個人用アカウントで検索

*🔧 MCP管理 (Slash Commands):*
• `/mcp` - MCPサーバーの状態確認と認証管理
• `/mcp status` - 現在の認証状態とサーバー接続を確認
• `/mcp auth` - 新しいNotionアカウントの認証を開始
• `/mcp accounts` - 登録済みアカウントの管理

*💡 ヒント:*
• 複数のNotionワークスペースを使い分けることができます
• アカウントごとに異なる権限やアクセス範囲を設定可能
• 自動的にコンテキストに応じたアカウントが選択されます
• Slash Commandsを使用すると、より直感的にMCP機能を利用できます

お問い合わせは開発チームまで。
    """
    say(help_text)
    logger.info(f"Help message sent to user {message['user']}")

# 時間表示機能
@app.message(re.compile(r"(time|時間|時刻)"))
def handle_time_message(message, say):
    """時間関連のメッセージに応答"""
    from datetime import datetime
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    say(f"🕐 Current time: {current_time}")
    logger.info(f"Time request from user {message['user']}")

# ジョーク機能
@app.message(re.compile(r"(joke|ジョーク|冗談)"))
def handle_joke_message(message, say):
    """ジョーク関連のメッセージに応答"""
    jokes = [
        "Why don't scientists trust atoms? Because they make up everything! 😄",
        "What do you call a fake noodle? An impasta! 🍝",
        "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
        "Why don't eggs tell jokes? They'd crack each other up! 🥚",
        "What do you call a bear with no teeth? A gummy bear! 🐻"
    ]
    import random
    joke = random.choice(jokes)
    say(f"😄 Here's a joke for you:\n{joke}")
    logger.info(f"Joke request from user {message['user']}")

# 挨拶機能の拡張
@app.message(re.compile(r"(good morning|おはよう|おはようございます)"))
def handle_good_morning(message, say):
    """おはようメッセージに応答"""
    user_id = message['user']
    say(f"おはようございます <@{user_id}>! 🌅 今日も一日頑張りましょう！")
    logger.info(f"Good morning message from user {user_id}")

@app.message(re.compile(r"(good night|おやすみ|おやすみなさい)"))
def handle_good_night(message, say):
    """おやすみメッセージに応答"""
    user_id = message['user']
    say(f"おやすみなさい <@{user_id}>! 🌙 良い夢を！")
    logger.info(f"Good night message from user {user_id}")

# エラーハンドリング
@app.error
def global_error_handler(error, body, logger):
    """グローバルエラーハンドラー"""
    logger.exception(f"Error: {error}")
    logger.info(f"Request body: {body}")

# Mastraエージェントを呼び出す共通関数
def process_message_with_mastra(message_text, thread_ts, say, user_id=None):
    """Mastraエージェントでメッセージを処理する共通関数（マルチテナント対応）"""
    # 処理中メッセージを送信（スレッド内で返信）
    try:
        say("メッセージを処理しています... 💭", thread_ts=thread_ts)
        logger.info(f"[Slack] Processing message for user {user_id}: {message_text[:50]}... (thread: {thread_ts})")
    except Exception as e:
        logger.error(f"[Slack] Failed to send processing message: {e}")
        say("メッセージを処理しています... 💭")
    
    try:
        # スレッドの会話履歴を取得
        context = thread_memory.get_context(thread_ts)
        
        # ユーザーメッセージをスレッド記憶に追加
        if user_id:
            thread_memory.add_message(thread_ts, "user", message_text, user_id)
        
        # コンテキストを含めたメッセージを作成
        if context:
            full_message = f"過去の会話:\n{context}\n\n現在の質問: {message_text}"
        else:
            full_message = message_text
        
        # Mastraエージェントで処理（マルチテナント対応）
        result = mastra_bridge.search(full_message, thread_id=thread_ts, slack_user_id=user_id)
        
        if "error" in result:
            error_msg = f"❌ エラーが発生しました: {result['error']}"
            try:
                say(error_msg, thread_ts=thread_ts)
                logger.info(f"[Slack] Error message sent to thread {thread_ts}")
            except Exception as e:
                logger.error(f"[Slack] Failed to send error message to thread: {e}")
                say(error_msg)  # フォールバック
            logger.error(f"[Slack] Error: {result['error']}")
        else:
            response = result.get('response', 'No response')
            try:
                say(response, thread_ts=thread_ts)
                logger.info(f"[Slack] Response sent to thread {thread_ts}: {len(response)} chars")
                
                # ボットの応答をスレッド記憶に追加
                thread_memory.add_message(thread_ts, "assistant", response)
                
                # OAuth認証が必要な場合の処理
                if result.get('requiresAuth'):
                    auth_url = result.get('authUrl')
                    if auth_url:
                        say(f"🔗 認証URL: {auth_url}", thread_ts=thread_ts)
                        
            except Exception as e:
                logger.error(f"[Slack] Failed to send response to thread {thread_ts}: {e}")
                say(response)  # フォールバック
                    
    except Exception as e:
        logger.error(f"[Slack] Processing error: {e}")
        error_msg = f"❌ 処理中にエラーが発生しました: {str(e)}"
        say(error_msg, thread_ts=thread_ts)

# 検索機能（Mastraエージェント統合）
@app.message(re.compile(r"(search|検索|探して|調べて)"))
def handle_search_message(message, say):
    """検索関連のメッセージをMastraエージェントで処理"""
    user_id = message['user']
    text = message['text']
    thread_ts = message.get('thread_ts', message['ts'])
    
    process_message_with_mastra(text, thread_ts, say, user_id)
    logger.info(f"Search request from user {user_id}")

# メンションされた時の検索処理
@app.event("app_mention")
def handle_app_mention_events(body, say, logger):
    """ボットがメンションされた時の応答処理（Mastra統合版）"""
    event = body["event"]
    user_id = event["user"]
    text = event["text"]
    # スレッド内のメンションの場合はthread_ts、そうでなければ新しいスレッドとしてtsを使用
    thread_ts = event.get('thread_ts', event['ts'])
    
    mention_text = text.split(">", 1)[1].strip() if ">" in text else ""
    
    if mention_text:
        # メンションされた場合は全てMastraエージェントで処理
        process_message_with_mastra(mention_text, thread_ts, say, user_id)
    else:
        # メンションだけで内容がない場合
        say("こんにちは！何かお手伝いできることはありますか？ 💬", thread_ts=thread_ts)
        
        try:
            # 挨拶メッセージとして処理
            thread_memory.add_message(thread_ts, "user", "挨拶", user_id)
            greeting_message = "ユーザーが挨拶をしてきました。友好的に応答してください。"
            result = mastra_bridge.search(greeting_message, thread_id=thread_ts, slack_user_id=user_id)
            if "error" not in result:
                response = result.get('response', '')
                if response:
                    say(response, thread_ts=thread_ts)
                    thread_memory.add_message(thread_ts, "assistant", response)
        except Exception as e:
            logger.error(f"Greeting error: {e}")
    
    logger.info(f"Responded to mention from user {user_id}")

# Notionアカウント管理機能
@app.message(re.compile(r"^(account|アカウント|accounts)\s*(list|一覧|リスト)?$", re.IGNORECASE))
def handle_account_list(message, say):
    """Notionアカウント一覧を表示"""
    user_id = message['user']
    thread_ts = message.get('thread_ts', message['ts'])
    
    logger.info(f"Account list request from user {user_id}")
    say("🔍 アカウント情報を取得しています...", thread_ts=thread_ts)
    
    try:
        result = mastra_bridge.get_accounts(user_id)
        
        if "error" in result:
            say(f"❌ エラー: {result['error']}", thread_ts=thread_ts)
        else:
            accounts = result.get('accounts', [])
            if not accounts:
                say("📋 Notionアカウントが登録されていません。\n\n「アカウント追加」で新しいアカウントを追加してください。", thread_ts=thread_ts)
            else:
                account_text = f"🏢 *登録済みNotionアカウント* ({len(accounts)}個)\n\n"
                for account in accounts:
                    status = "✅" if account.get('isActive') else "⚪"
                    account_text += f"{status} *{account.get('name', 'Unknown')}*\n"
                    account_text += f"   📧 {account.get('email', 'N/A')}\n"
                    account_text += f"   🏢 {account.get('workspace', 'N/A')}\n\n"
                
                say(account_text, thread_ts=thread_ts)
    except Exception as e:
        logger.error(f"Account list error: {e}")
        say(f"❌ アカウント一覧の取得中にエラーが発生しました: {str(e)}", thread_ts=thread_ts)

@app.message(re.compile(r"^(add account|アカウント追加|新しいアカウント)$", re.IGNORECASE))
def handle_add_account(message, say):
    """新しいNotionアカウントを追加"""
    user_id = message['user']
    thread_ts = message.get('thread_ts', message['ts'])
    
    logger.info(f"Add account request from user {user_id}")
    
    # アカウント追加リクエストをMastraエージェントに送信
    process_message_with_mastra("アカウント追加", thread_ts, say, user_id)

@app.message(re.compile(r"^(switch|切り替え|change)\s+(to\s+)?(.+)$", re.IGNORECASE))
def handle_switch_account(message, say):
    """Notionアカウントを切り替え"""
    user_id = message['user']
    thread_ts = message.get('thread_ts', message['ts'])
    text = message['text']
    
    logger.info(f"Switch account request from user {user_id}: {text}")
    
    # アカウント切り替えリクエストをMastraエージェントに送信
    process_message_with_mastra(text, thread_ts, say, user_id)

# MCP管理のためのSlash Commands

def create_mcp_status_blocks(user_id, status_data):
    """MCPサーバー状態表示用のBlock Kit UIを作成"""
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "🔧 MCP サーバー管理",
                "emoji": True
            }
        },
        {
            "type": "divider"
        }
    ]
    
    # サーバー接続状態
    server_status = "🟢 接続中" if status_data.get('server_connected') else "🔴 未接続"
    blocks.append({
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": f"*サーバー状態:* {server_status}\n*エージェントポート:* {status_data.get('agent_port', 'N/A')}"
        }
    })
    
    # 認証状態セクション
    accounts = status_data.get('accounts', [])
    if accounts:
        account_text = "\n".join([
            f"{'✅' if acc.get('isActive') else '⚪'} *{acc.get('name', 'Unknown')}* ({acc.get('workspace', 'N/A')})"
            for acc in accounts
        ])
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn", 
                "text": f"*認証済みアカウント ({len(accounts)}個):*\n{account_text}"
            }
        })
    else:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*認証済みアカウント:* なし"
            }
        })
    
    # アクションボタン
    buttons = []
    
    if not accounts:
        # 認証されていない場合
        buttons.append({
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": "🔐 Notion認証を開始",
                "emoji": True
            },
            "style": "primary",
            "action_id": "mcp_start_auth",
            "value": user_id
        })
    else:
        # 認証済みの場合
        buttons.extend([
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "➕ アカウント追加",
                    "emoji": True
                },
                "style": "primary", 
                "action_id": "mcp_add_account",
                "value": user_id
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "⚙️ アカウント管理",
                    "emoji": True
                },
                "action_id": "mcp_manage_accounts", 
                "value": user_id
            }
        ])
    
    # リフレッシュボタン
    buttons.append({
        "type": "button",
        "text": {
            "type": "plain_text",
            "text": "🔄 更新",
            "emoji": True
        },
        "action_id": "mcp_refresh_status",
        "value": user_id
    })
    
    blocks.append({
        "type": "actions",
        "elements": buttons
    })
    
    return blocks

def get_mcp_status(user_id):
    """MCPサーバーと認証状態を取得"""
    try:
        # Mastraブリッジの状態確認
        server_connected = mastra_bridge.is_running()
        agent_port = os.environ.get("AGENT_PORT", "3001")
        
        # アカウント情報を取得
        accounts_result = mastra_bridge.get_accounts(user_id)
        accounts = accounts_result.get('accounts', []) if 'error' not in accounts_result else []
        
        return {
            'server_connected': server_connected,
            'agent_port': agent_port,
            'accounts': accounts,
            'error': None
        }
    except Exception as e:
        logger.error(f"Error getting MCP status: {e}")
        return {
            'server_connected': False,
            'agent_port': os.environ.get("AGENT_PORT", "3001"),
            'accounts': [],
            'error': str(e)
        }

@app.command("/mcp")
def handle_mcp_command(ack, respond, command, logger):
    """MCPサーバー管理用のSlash Command"""
    ack()
    
    user_id = command['user_id']
    text = command.get('text', '').strip()
    
    logger.info(f"MCP command from user {user_id}: /{command['command']} {text}")
    
    # サブコマンドの処理
    if text == "status" or text == "":
        # MCPサーバー状態を表示
        status_data = get_mcp_status(user_id)
        blocks = create_mcp_status_blocks(user_id, status_data)
        
        respond({
            "blocks": blocks,
            "response_type": "ephemeral"  # ユーザーのみに表示
        })
        
    elif text == "auth":
        # 認証フロー開始
        try:
            result = mastra_bridge.search("アカウント追加", slack_user_id=user_id)
            if "error" in result:
                respond({
                    "text": f"❌ 認証開始エラー: {result['error']}",
                    "response_type": "ephemeral"
                })
            else:
                respond({
                    "text": "🔐 認証フローを開始しています...",
                    "response_type": "ephemeral"
                })
        except Exception as e:
            logger.error(f"Error starting auth flow: {e}")
            respond({
                "text": f"❌ 認証開始中にエラーが発生しました: {str(e)}",
                "response_type": "ephemeral"
            })
            
    elif text == "accounts":
        # アカウント一覧表示
        try:
            result = mastra_bridge.get_accounts(user_id)
            if "error" in result:
                respond({
                    "text": f"❌ アカウント取得エラー: {result['error']}",
                    "response_type": "ephemeral"
                })
            else:
                accounts = result.get('accounts', [])
                if not accounts:
                    respond({
                        "text": "📋 登録済みアカウントはありません。\n`/mcp auth` で認証を開始してください。",
                        "response_type": "ephemeral"
                    })
                else:
                    account_list = "\n".join([
                        f"{'✅' if acc.get('isActive') else '⚪'} *{acc.get('name', 'Unknown')}* - {acc.get('workspace', 'N/A')}"
                        for acc in accounts
                    ])
                    respond({
                        "text": f"🏢 *登録済みNotionアカウント ({len(accounts)}個):*\n{account_list}",
                        "response_type": "ephemeral"
                    })
        except Exception as e:
            logger.error(f"Error getting accounts: {e}")
            respond({
                "text": f"❌ アカウント取得中にエラーが発生しました: {str(e)}",
                "response_type": "ephemeral"
            })
    else:
        # 不明なサブコマンド
        respond({
            "text": f"❓ 不明なコマンド: `/mcp {text}`\n\n使用可能なコマンド:\n• `/mcp` または `/mcp status` - 状態確認\n• `/mcp auth` - 認証開始\n• `/mcp accounts` - アカウント一覧",
            "response_type": "ephemeral"
        })

# Interactive Buttonハンドラー
@app.action("mcp_start_auth")
def handle_mcp_start_auth(ack, body, respond, logger):
    """MCP認証開始ボタンのハンドラー"""
    ack()
    
    user_id = body['user']['id']
    logger.info(f"MCP auth start button clicked by user {user_id}")
    
    try:
        # 認証フローを開始
        result = mastra_bridge.search("アカウント追加", slack_user_id=user_id)
        
        if "error" in result:
            respond({
                "text": f"❌ 認証開始エラー: {result['error']}",
                "response_type": "ephemeral",
                "replace_original": False
            })
        else:
            respond({
                "text": "🔐 認証フローを開始しました。ブラウザで認証を完了してください。",
                "response_type": "ephemeral",
                "replace_original": False
            })
            
    except Exception as e:
        logger.error(f"Error in MCP start auth: {e}")
        respond({
            "text": f"❌ 認証開始中にエラーが発生しました: {str(e)}",
            "response_type": "ephemeral",
            "replace_original": False
        })

@app.action("mcp_add_account")
def handle_mcp_add_account(ack, body, respond, logger):
    """MCPアカウント追加ボタンのハンドラー"""
    ack()
    
    user_id = body['user']['id']
    logger.info(f"MCP add account button clicked by user {user_id}")
    
    try:
        result = mastra_bridge.search("アカウント追加", slack_user_id=user_id)
        
        if "error" in result:
            respond({
                "text": f"❌ アカウント追加エラー: {result['error']}",
                "response_type": "ephemeral",
                "replace_original": False
            })
        else:
            respond({
                "text": "➕ 新しいアカウントの追加を開始しました。ブラウザで認証を完了してください。",
                "response_type": "ephemeral",
                "replace_original": False
            })
            
    except Exception as e:
        logger.error(f"Error in MCP add account: {e}")
        respond({
            "text": f"❌ アカウント追加中にエラーが発生しました: {str(e)}",
            "response_type": "ephemeral",
            "replace_original": False
        })

@app.action("mcp_manage_accounts")
def handle_mcp_manage_accounts(ack, body, respond, logger):
    """MCPアカウント管理ボタンのハンドラー"""
    ack()
    
    user_id = body['user']['id']
    logger.info(f"MCP manage accounts button clicked by user {user_id}")
    
    try:
        result = mastra_bridge.get_accounts(user_id)
        
        if "error" in result:
            respond({
                "text": f"❌ アカウント取得エラー: {result['error']}",
                "response_type": "ephemeral",
                "replace_original": False
            })
        else:
            accounts = result.get('accounts', [])
            account_list = "\n".join([
                f"{'✅' if acc.get('isActive') else '⚪'} *{acc.get('name', 'Unknown')}* - {acc.get('workspace', 'N/A')}"
                for acc in accounts
            ])
            respond({
                "text": f"⚙️ *アカウント管理*\n\n🏢 *登録済みアカウント ({len(accounts)}個):*\n{account_list}\n\n💡 アカウントの切り替えは `切り替え [アカウント名]` コマンドを使用してください。",
                "response_type": "ephemeral",
                "replace_original": False
            })
            
    except Exception as e:
        logger.error(f"Error in MCP manage accounts: {e}")
        respond({
            "text": f"❌ アカウント管理中にエラーが発生しました: {str(e)}",
            "response_type": "ephemeral",
            "replace_original": False
        })

@app.action("mcp_refresh_status")
def handle_mcp_refresh_status(ack, body, respond, logger):
    """MCP状態更新ボタンのハンドラー"""
    ack()
    
    user_id = body['user']['id']
    logger.info(f"MCP refresh status button clicked by user {user_id}")
    
    try:
        # 最新の状態を取得
        status_data = get_mcp_status(user_id)
        blocks = create_mcp_status_blocks(user_id, status_data)
        
        respond({
            "blocks": blocks,
            "response_type": "ephemeral",
            "replace_original": True  # 元のメッセージを更新
        })
        
    except Exception as e:
        logger.error(f"Error refreshing MCP status: {e}")
        respond({
            "text": f"❌ 状態更新中にエラーが発生しました: {str(e)}",
            "response_type": "ephemeral",
            "replace_original": False
        })

# スレッド内でのメンションなし応答
@app.message("")
def handle_thread_messages(message, say, logger):
    """スレッド内でのメンションなしメッセージに応答"""
    # メンションチェック - メンションの場合はスキップ
    if "<@" in message.get('text', ''):
        return
    
    # スレッド内かチェック
    thread_ts = message.get('thread_ts')
    if not thread_ts:
        return
    
    # このスレッドに過去の履歴があるかチェック
    if not thread_memory.has_history(thread_ts):
        return
    
    user_id = message['user']
    text = message['text']
    
    # Mastraエージェントで処理
    process_message_with_mastra(text, thread_ts, say, user_id)
    logger.info(f"Thread message from user {user_id}")

# アプリの起動
if __name__ == "__main__":
    # Mastraエージェントサーバーを起動
    logger.info("Starting Mastra agent server...")
    if not mastra_bridge.start():
        logger.error("Failed to start Mastra agent server. Some features may not work.")
    
    # 終了時にMastraサーバーを停止
    atexit.register(mastra_bridge.stop)
    
    # Socket Modeハンドラーの作成と起動
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    logger.info("⚡️ Slack bot is starting...")
    handler.start()