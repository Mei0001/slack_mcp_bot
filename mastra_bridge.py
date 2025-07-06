import subprocess
import os
import requests
import time
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# 環境変数の読み込み
load_dotenv(override=True)

logger = logging.getLogger(__name__)

class MastraBridge:
    """PythonからNode.js Mastraエージェントとの通信を管理するブリッジクラス"""
    
    def __init__(self, port: int = 3001):
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.process: Optional[subprocess.Popen] = None
        self.node_modules_path = os.path.join(os.path.dirname(__file__), 'node_modules')
        
    def start(self) -> bool:
        """Node.jsエージェントサーバーを起動"""
        try:
            # 既に起動している場合はスキップ
            if self.is_running():
                logger.info(f"Mastra agent server is already running on port {self.port}")
                return True
            
            # Node.jsサーバーを起動
            env = os.environ.copy()
            env['AGENT_PORT'] = str(self.port)
            
            # Gemini APIキーを環境変数から取得
            if 'GEMINI_API_KEY' in os.environ:
                env['GOOGLE_GENERATIVE_AI_API_KEY'] = os.environ['GEMINI_API_KEY']
                logger.info(f"[MastraBridge] Setting GOOGLE_GENERATIVE_AI_API_KEY: {os.environ['GEMINI_API_KEY'][:10]}...")
            
            # Notion APIキーも渡す
            if 'NOTION_API_KEY' in os.environ:
                env['NOTION_API_KEY'] = os.environ['NOTION_API_KEY']
            
            cmd = ['npm', 'run', 'dev']
            
            self.process = subprocess.Popen(
                cmd,
                cwd=os.path.dirname(__file__),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # サーバーが起動するまで待機
            logger.info(f"Waiting for Mastra agent server to start on port {self.port}...")
            for i in range(30):  # 最大30秒待機
                time.sleep(1)
                if self.is_running():
                    logger.info(f"Mastra agent server started successfully on port {self.port}")
                    return True
                if i % 5 == 0:
                    logger.info(f"Still waiting for server... ({i}s)")
            
            # プロセスのエラー出力を確認
            if self.process:
                stdout, stderr = self.process.communicate(timeout=1)
                if stderr:
                    logger.error(f"Process stderr: {stderr.decode()}")
                if stdout:
                    logger.info(f"Process stdout: {stdout.decode()}")
            
            logger.error("Failed to start Mastra agent server after 30 seconds")
            return False
            
        except Exception as e:
            logger.error(f"Error starting Mastra agent: {e}")
            return False
    
    def stop(self):
        """Node.jsエージェントサーバーを停止"""
        if self.process:
            self.process.terminate()
            self.process.wait()
            self.process = None
            logger.info("Mastra agent server stopped")
    
    def is_running(self) -> bool:
        """サーバーが実行中かチェック"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def search(self, message: str, thread_id: Optional[str] = None, slack_user_id: Optional[str] = None) -> Dict[str, Any]:
        """検索リクエストを送信（マルチテナント対応）"""
        try:
            logger.info(f"[MastraBridge] Starting search request for user {slack_user_id}: {message[:50]}...")
            
            if not self.is_running():
                logger.error("[MastraBridge] Mastra agent server is not running")
                logger.info("[MastraBridge] Attempting to restart the server...")
                if not self.start():
                    return {"error": "エージェントサーバーの起動に失敗しました"}
            
            payload = {
                "message": message,
                "threadId": thread_id,
                "slackUserId": slack_user_id  # マルチテナント用のユーザーID
            }
            
            logger.info(f"[MastraBridge] Sending POST request to {self.base_url}/api/agent/search")
            logger.info(f"[MastraBridge] Payload: {payload}")
            
            response = requests.post(
                f"{self.base_url}/api/agent/search",
                json=payload,
                timeout=60  # より長いタイムアウトに変更
            )
            
            logger.info(f"[MastraBridge] Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"[MastraBridge] Success! Response: {result.get('response', '')[:100]}...")
                return result
            else:
                error_msg = f"エラー: {response.status_code} - {response.text}"
                logger.error(f"[MastraBridge] {error_msg}")
                return {"error": error_msg}
                
        except requests.exceptions.Timeout:
            logger.error("[MastraBridge] Request timeout after 60 seconds")
            return {"error": "リクエストがタイムアウトしました（60秒）"}
        except requests.exceptions.ConnectionError as e:
            logger.error(f"[MastraBridge] Connection error: {e}")
            return {"error": "エージェントサーバーに接続できません"}
        except Exception as e:
            logger.error(f"[MastraBridge] Error calling Mastra agent: {e}")
            logger.error(f"[MastraBridge] Exception type: {type(e).__name__}")
            return {"error": str(e)}
    
    def get_accounts(self, slack_user_id: str) -> Dict[str, Any]:
        """ユーザーのNotionアカウント一覧を取得"""
        try:
            if not self.is_running():
                return {"error": "エージェントサーバーが起動していません"}
            
            response = requests.get(
                f"{self.base_url}/api/accounts/{slack_user_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"アカウント取得エラー: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"[MastraBridge] Error getting accounts: {e}")
            return {"error": str(e)}
    
    def delete_account(self, slack_user_id: str, account_id: str) -> Dict[str, Any]:
        """Notionアカウントを削除"""
        try:
            if not self.is_running():
                return {"error": "エージェントサーバーが起動していません"}
            
            response = requests.delete(
                f"{self.base_url}/api/accounts/{slack_user_id}/{account_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"アカウント削除エラー: {response.status_code}"}
                
        except Exception as e:
            logger.error(f"[MastraBridge] Error deleting account: {e}")
            return {"error": str(e)}

# グローバルインスタンス
mastra_bridge = MastraBridge()