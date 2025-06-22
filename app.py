import os
import re
import logging
import atexit
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv
from mastra_bridge import mastra_bridge

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

# メンション応答
@app.event("app_mention")
def handle_app_mention_events(body, say, logger):
    """ボットがメンションされた時の応答処理"""
    event = body["event"]
    user_id = event["user"]
    text = event["text"]
    
    mention_text = text.split(">", 1)[1].strip() if ">" in text else ""
    
    if mention_text:
        response = f"Hi <@{user_id}>! You mentioned: '{mention_text}'. How can I assist you?"
    else:
        response = f"Hello <@{user_id}>! You mentioned me. What can I do for you?"
    
    say(response)
    logger.info(f"Responded to mention from user {user_id}")

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
• `weather` - Get weather information (coming soon)
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

# 検索機能（Mastraエージェント統合）
@app.message(re.compile(r"(search|検索|探して|調べて)"))
def handle_search_message(message, say):
    """検索関連のメッセージをMastraエージェントで処理"""
    user_id = message['user']
    text = message['text']
    thread_ts = message.get('thread_ts', message['ts'])
    
    # 処理中メッセージを送信
    say("🔍 検索中です... しばらくお待ちください。", thread_ts=thread_ts)
    
    try:
        # Mastraエージェントを使用して検索
        result = mastra_bridge.search(text, thread_id=thread_ts)
        
        if "error" in result:
            say(f"❌ エラーが発生しました: {result['error']}", thread_ts=thread_ts)
        else:
            response = result.get('response', 'No response')
            say(f"📋 検索結果:\n{response}", thread_ts=thread_ts)
            
    except Exception as e:
        logger.error(f"Search error: {e}")
        say(f"❌ 検索中にエラーが発生しました: {str(e)}", thread_ts=thread_ts)
    
    logger.info(f"Search request from user {user_id}: {text}")

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
        # 検索関連のキーワードが含まれているか、長い文章の場合はMastraで処理
        if any(keyword in mention_text for keyword in ["検索", "探して", "調べて", "教えて"]) or len(mention_text) > 20:
            say(f"<@{user_id}> 了解しました。調べてみます... 🔍", thread_ts=thread_ts)
            
            try:
                result = mastra_bridge.search(mention_text, thread_id=thread_ts)
                
                if "error" in result:
                    say(f"❌ エラーが発生しました: {result['error']}", thread_ts=thread_ts)
                else:
                    response = result.get('response', 'No response')
                    say(response, thread_ts=thread_ts)
                    
            except Exception as e:
                logger.error(f"Mention search error: {e}")
                say(f"❌ 処理中にエラーが発生しました: {str(e)}", thread_ts=thread_ts)
        else:
            # 通常のメンション応答
            response = f"Hi <@{user_id}>! You mentioned: '{mention_text}'. 検索が必要な場合は「〜を検索して」と言ってください。"
            say(response, thread_ts=thread_ts)
    else:
        response = f"Hello <@{user_id}>! 何かお探しですか？「〜を検索して」と言ってください。"
        say(response, thread_ts=thread_ts)
    
    logger.info(f"Responded to mention from user {user_id}")

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