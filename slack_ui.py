import os
import redis
import json
import logging
from datetime import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Redis connection
redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

# OAuth callback URL
OAUTH_CALLBACK_URL = os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:5001/oauth/callback')

def create_mcp_services_blocks() -> list:
    """Create blocks for MCP services selection"""
    return [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "🔗 MCP サービス連携"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "どのサービスと連携しますか？"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📝 Notion"
                    },
                    "style": "primary",
                    "value": "notion",
                    "action_id": "connect_notion"
                },
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "📁 Google Drive"
                    },
                    "style": "primary",
                    "value": "google-drive",
                    "action_id": "connect_google_drive"
                }
            ]
        }
    ]

def create_service_status_blocks(user_id: str) -> list:
    """Create blocks showing connected services status"""
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": "📊 接続済みサービス"
            }
        }
    ]
    
    # Check connected services
    connected_services = get_connected_services(user_id)
    
    if not connected_services:
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "現在、接続されているサービスはありません。"
            }
        })
    else:
        for service in connected_services:
            status_emoji = "✅" if service['connected'] else "❌"
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{status_emoji} *{service['name']}*\n接続日時: {service['connected_at']}"
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "切断"
                    },
                    "style": "danger",
                    "value": service['type'],
                    "action_id": f"disconnect_{service['type']}"
                }
            })
    
    blocks.append({"type": "divider"})
    
    return blocks

def create_auth_in_progress_blocks(service_name: str) -> list:
    """Create blocks for auth in progress"""
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"🔄 *{service_name}の認証を開始しています...*\n\nブラウザで認証画面が開きます。認証が完了したら、自動的にSlackに戻ります。"
            }
        }
    ]

def create_auth_success_blocks(service_name: str) -> list:
    """Create blocks for successful authentication"""
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"✅ *{service_name}の連携が完了しました！*\n\nこれで{service_name}の情報を検索・編集できるようになりました。"
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"💡 使い方: `検索 [キーワード]` または `@{os.getenv('SLACK_BOT_NAME', 'bot')} [質問]`"
                }
            ]
        }
    ]

def create_auth_error_blocks(service_name: str, error: str) -> list:
    """Create blocks for authentication error"""
    return [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"❌ *{service_name}の連携に失敗しました*\n\nエラー: {error}"
            }
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "もう一度試す"
                    },
                    "style": "primary",
                    "value": service_name.lower().replace(' ', '-'),
                    "action_id": f"retry_auth"
                }
            ]
        }
    ]

def get_connected_services(user_id: str) -> list:
    """Get list of connected services for a user"""
    services = []
    service_types = ['notion', 'google-drive']
    service_names = {
        'notion': 'Notion',
        'google-drive': 'Google Drive'
    }
    
    for service_type in service_types:
        key = f"oauth:tokens:{user_id}:{service_type}"
        token_data = redis_client.get(key)
        
        if token_data:
            tokens = json.loads(token_data)
            services.append({
                'type': service_type,
                'name': service_names.get(service_type, service_type),
                'connected': True,
                'connected_at': tokens.get('connectedAt', '不明')
            })
    
    return services

def generate_oauth_state(user_id: str, channel_id: str, service_type: str) -> Optional[str]:
    """Generate OAuth state for authentication flow"""
    try:
        # Try nanoid first, fallback to uuid if not available
        try:
            from nanoid import generate
            state = generate()
        except ImportError:
            import uuid
            import secrets
            state = secrets.token_urlsafe(21)  # Similar length to nanoid
            logger.info("Using fallback UUID for OAuth state generation")
        
        state_key = f"oauth:state:{state}"
        state_data = {
            'slackUserId': user_id,
            'channelId': channel_id,
            'serviceType': service_type,
            'timestamp': datetime.now().isoformat()
        }
        
        # Store state with 10 minute TTL
        redis_client.setex(state_key, 600, json.dumps(state_data))
        return state
    except Exception as e:
        logger.error(f"Failed to generate OAuth state: {e}")
        return None

def generate_oauth_url(service_type: str, state: str) -> Optional[str]:
    """Generate OAuth authorization URL"""
    oauth_configs = {
        'notion': {
            'auth_url': 'https://api.notion.com/v1/oauth/authorize',
            'client_id': os.getenv('NOTION_OAUTH_CLIENT_ID'),
            'scopes': 'read_content,update_content,insert_content'
        },
        'google-drive': {
            'auth_url': 'https://accounts.google.com/o/oauth2/v2/auth',
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'scopes': 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file'
        }
    }
    
    config = oauth_configs.get(service_type)
    if not config or not config['client_id']:
        logger.error(f"OAuth config not found for {service_type}")
        return None
    
    params = {
        'client_id': config['client_id'],
        'redirect_uri': OAUTH_CALLBACK_URL,
        'response_type': 'code',
        'state': state,
        'scope': config['scopes']
    }
    
    # Service-specific parameters
    if service_type == 'notion':
        params['owner'] = 'user'
    elif service_type == 'google-drive':
        params['access_type'] = 'offline'
        params['prompt'] = 'consent'
    
    from urllib.parse import urlencode
    return f"{config['auth_url']}?{urlencode(params)}"