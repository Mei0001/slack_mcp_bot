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
load_dotenv()

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

Available commands:
• `hello` - Say hello to the bot
• `@botname` - Mention the bot for assistance  
• `help` - Show this help message
• `time` - Get current time
• `search` / `検索` - Search for information using AI assistant
• `joke` - Get a random joke

For more information, please contact the development team.
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
    """Mastraエージェントでメッセージを処理する共通関数"""
    # 処理中メッセージを送信
    say("メッセージを処理しています... 💭", thread_ts=thread_ts)
    logger.info(f"[Slack] Processing message: {message_text[:50]}...")
    
    try:
        # スレッドの会話履歴を取得
        context = thread_memory.get_context(thread_ts)
        
        # ユーザーメッセージをスレッド記憶に追加
        if user_id:
            thread_memory.add_message(thread_ts, "user", message_text, user_id)
        
        # 新しいサーバーAPIに対応したペイロードを作成
        payload = {
            "message": message_text,
            "threadId": thread_ts,
            "context": context if context else None
        }
        
        # Mastraエージェントで処理
        result = mastra_bridge.search_with_payload(payload)
        
        if "error" in result:
            error_msg = f"❌ エラーが発生しました: {result['error']}"
            say(error_msg, thread_ts=thread_ts)
            logger.error(f"[Slack] Error: {result['error']}")
        else:
            response = result.get('response', 'No response')
            
            # 警告がある場合は追加
            warning = result.get('warning')
            if warning:
                response = f"⚠️ {warning}\n\n{response}"
            
            say(response, thread_ts=thread_ts)
            
            # ボットの応答をスレッド記憶に追加
            thread_memory.add_message(thread_ts, "assistant", response)
            
            logger.info(f"[Slack] Response sent: {len(response)} chars")
            
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
            result = mastra_bridge.search(greeting_message, thread_id=thread_ts)
            if "error" not in result:
                response = result.get('response', '')
                if response:
                    say(response, thread_ts=thread_ts)
                    thread_memory.add_message(thread_ts, "assistant", response)
        except Exception as e:
            logger.error(f"Greeting error: {e}")
    
    logger.info(f"Responded to mention from user {user_id}")

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