"""
スレッド内記憶機能の実装
同一スレッド内での会話履歴を管理し、コンテキストとして提供
"""

import time
from typing import Dict, List, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class Message:
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: float
    user_id: Optional[str] = None

class ThreadMemory:
    """スレッド単位で会話履歴を管理するクラス"""
    
    def __init__(self, max_messages: int = 20, max_age_hours: int = 24):
        self.max_messages = max_messages
        self.max_age_hours = max_age_hours
        self.threads: Dict[str, List[Message]] = {}
    
    def add_message(self, thread_id: str, role: str, content: str, user_id: Optional[str] = None):
        """メッセージを追加"""
        if thread_id not in self.threads:
            self.threads[thread_id] = []
        
        message = Message(
            role=role,
            content=content,
            timestamp=time.time(),
            user_id=user_id
        )
        
        self.threads[thread_id].append(message)
        
        # 古いメッセージを削除
        self._cleanup_old_messages(thread_id)
        
        logger.info(f"[ThreadMemory] Added {role} message to thread {thread_id}")
    
    def get_context(self, thread_id: str) -> str:
        """スレッドの会話履歴をコンテキスト文字列として取得"""
        if thread_id not in self.threads:
            return ""
        
        messages = self.threads[thread_id]
        if not messages:
            return ""
        
        # 最新のメッセージから逆順で取得し、適切な順序に戻す
        recent_messages = messages[-self.max_messages:]
        
        context_parts = []
        for msg in recent_messages:
            if msg.role == 'user':
                context_parts.append(f"ユーザー: {msg.content}")
            else:
                context_parts.append(f"アシスタント: {msg.content}")
        
        context = "\n".join(context_parts)
        logger.info(f"[ThreadMemory] Retrieved context for thread {thread_id}: {len(context)} chars")
        return context
    
    def has_history(self, thread_id: str) -> bool:
        """スレッドに履歴があるかチェック"""
        return thread_id in self.threads and len(self.threads[thread_id]) > 0
    
    def _cleanup_old_messages(self, thread_id: str):
        """古いメッセージをクリーンアップ"""
        if thread_id not in self.threads:
            return
        
        current_time = time.time()
        max_age_seconds = self.max_age_hours * 3600
        
        # 時間による削除
        self.threads[thread_id] = [
            msg for msg in self.threads[thread_id]
            if current_time - msg.timestamp <= max_age_seconds
        ]
        
        # 数による削除
        if len(self.threads[thread_id]) > self.max_messages:
            self.threads[thread_id] = self.threads[thread_id][-self.max_messages:]
    
    def clear_thread(self, thread_id: str):
        """特定のスレッドの履歴をクリア"""
        if thread_id in self.threads:
            del self.threads[thread_id]
            logger.info(f"[ThreadMemory] Cleared thread {thread_id}")

# グローバルインスタンス
thread_memory = ThreadMemory()