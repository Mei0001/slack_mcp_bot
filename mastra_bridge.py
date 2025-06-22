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
        self.node_modules_path = os.path.join(os.path.dirname(__file__), 'node_modules')
        
    def start(self) -> bool:
        """Node.jsエージェントサーバーを起動"""
        try:
            # 既に起動している場合はスキップ
            if self.is_running():
                logger.info("Mastra agent server is already running")
                return True
            
            # Node.jsサーバーを起動
            env = os.environ.copy()
            env['AGENT_PORT'] = str(self.port)
            
            # Gemini APIキーを環境変数から取得
            if 'GEMINI_API_KEY' in os.environ:
                env['GOOGLE_GENERATIVE_AI_API_KEY'] = os.environ['GEMINI_API_KEY']
            
            cmd = ['npx', 'tsx', 'src/agent/index.ts']
            
            self.process = subprocess.Popen(
                cmd,
                cwd=os.path.dirname(__file__),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # サーバーが起動するまで待機
            for _ in range(30):  # 最大30秒待機
                time.sleep(1)
                if self.is_running():
                    logger.info(f"Mastra agent server started on port {self.port}")
                    return True
            
            logger.error("Failed to start Mastra agent server")
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
    
    def search(self, message: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """検索リクエストを送信"""
        try:
            if not self.is_running():
                logger.error("Mastra agent server is not running")
                return {"error": "エージェントサーバーが起動していません"}
            
            payload = {
                "message": message,
                "threadId": thread_id
            }
            
            response = requests.post(
                f"{self.base_url}/api/agent/search",
                json=payload,
                timeout=30  # 長い処理に対応
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"エラー: {response.status_code} - {response.text}"}
                
        except requests.exceptions.Timeout:
            return {"error": "リクエストがタイムアウトしました"}
        except Exception as e:
            logger.error(f"Error calling Mastra agent: {e}")
            return {"error": str(e)}

# グローバルインスタンス
mastra_bridge = MastraBridge()