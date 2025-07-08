import subprocess
import os
import requests
import time
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class MastraBridge:
    """PythonからNode.js Mastraエージェントとの通信を管理するブリッジクラス"""
    
    def __init__(self, port: int = 3001):
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.process: Optional[subprocess.Popen] = None
        self.mastra_project_path = os.path.join(os.path.dirname(__file__), 'slack-mcp-agent')
        
    def start(self) -> bool:
        """Node.jsエージェントサーバーを起動"""
        try:
            # 既に起動している場合はスキップ
            if self.is_running():
                logger.info(f"[MastraBridge] ✅ Server already running on port {self.port}")
                return True
            
            # Mastraプロジェクトディレクトリの存在確認
            if not os.path.exists(self.mastra_project_path):
                logger.error(f"[MastraBridge] ❌ Mastra project directory not found: {self.mastra_project_path}")
                return False
            
            # Node.jsサーバーを起動
            env = os.environ.copy()
            env['AGENT_PORT'] = str(self.port)
            
            # API キーを環境変数から取得
            if 'GEMINI_API_KEY' in os.environ:
                env['GOOGLE_GENERATIVE_AI_API_KEY'] = os.environ['GEMINI_API_KEY']
                logger.info("[MastraBridge] ✓ Gemini API key configured")
            
            if 'NOTION_API_KEY' in os.environ:
                env['NOTION_API_KEY'] = os.environ['NOTION_API_KEY']
                logger.info("[MastraBridge] ✓ Notion API key configured")
            
            # 新しいMastraサーバーを起動
            cmd = ['npm', 'run', 'server']
            
            logger.info(f"[MastraBridge] Starting Mastra server: {' '.join(cmd)}")
            logger.info(f"[MastraBridge] Working directory: {self.mastra_project_path}")
            
            self.process = subprocess.Popen(
                cmd,
                cwd=self.mastra_project_path,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # サーバーが起動するまで待機
            logger.info(f"[MastraBridge] ⏳ Waiting for server startup on port {self.port}...")
            for i in range(60):  # 最大60秒待機（依存関係のインストール時間を考慮）
                time.sleep(1)
                if self.is_running():
                    logger.info(f"[MastraBridge] ✅ Server started successfully on port {self.port}")
                    return True
                if i % 10 == 0 and i > 0:
                    logger.info(f"[MastraBridge] ⏳ Still waiting... ({i}s elapsed)")
            
            # プロセスのエラー出力を確認
            if self.process:
                try:
                    stdout, stderr = self.process.communicate(timeout=1)
                    if stderr:
                        logger.error(f"[MastraBridge] ❌ Server error: {stderr.decode().strip()}")
                    if stdout:
                        logger.info(f"[MastraBridge] Server output: {stdout.decode().strip()}")
                except:
                    pass  # タイムアウトは無視
            
            logger.error("[MastraBridge] ❌ Failed to start server after 60 seconds")
            return False
            
        except Exception as e:
            logger.error(f"[MastraBridge] ❌ Startup error: {e}")
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
    
    def search(self, message: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """検索リクエストを送信"""
        try:
            logger.info(f"[MastraBridge] Starting search request for message: {message[:50]}...")
            
            if not self.is_running():
                logger.error("[MastraBridge] Mastra agent server is not running")
                logger.info("[MastraBridge] Attempting to restart the server...")
                if not self.start():
                    return {"error": "エージェントサーバーの起動に失敗しました"}
            
            payload = {
                "message": message,
                "threadId": thread_id
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
    
    def search_with_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """ペイロード付き検索リクエストを送信（新しいサーバーAPI対応）"""
        try:
            message = payload.get('message', '')
            logger.info(f"[MastraBridge] Starting enhanced search request: {message[:50]}...")
            
            if not self.is_running():
                logger.warning("[MastraBridge] Server not running, attempting restart...")
                if not self.start():
                    return {"error": "エージェントサーバーの起動に失敗しました"}
            
            logger.debug(f"[MastraBridge] Sending enhanced request to {self.base_url}/api/agent/search")
            
            response = requests.post(
                f"{self.base_url}/api/agent/search",
                json=payload,
                timeout=60
            )
            
            logger.debug(f"[MastraBridge] Response status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                response_text = result.get('response', '')
                logger.info(f"[MastraBridge] ✅ Enhanced response generated ({len(response_text)} chars)")
                return result
            else:
                # エラーメッセージ全体を取得
                full_error = response.text
                error_msg = f"HTTP {response.status_code}: {full_error}"
                logger.error(f"[MastraBridge] ❌ Full error: {error_msg}")
                
                # レート制限エラーの場合は特別な処理
                if "rate limit" in full_error.lower():
                    return {
                        "error": "APIレート制限に達しました。しばらく待ってから再度お試しください。",
                        "details": full_error
                    }
                
                return {"error": f"エラー: {error_msg}"}
                
        except requests.exceptions.Timeout:
            logger.error("[MastraBridge] ❌ Request timeout after 60 seconds")
            return {"error": "リクエストがタイムアウトしました（60秒）"}
        except requests.exceptions.ConnectionError:
            logger.error("[MastraBridge] ❌ Connection error")
            return {"error": "エージェントサーバーに接続できません"}
        except Exception as e:
            logger.error(f"[MastraBridge] ❌ Enhanced search error: {type(e).__name__}: {e}")
            return {"error": f"予期しないエラー: {str(e)}"}

# グローバルインスタンス
mastra_bridge = MastraBridge()