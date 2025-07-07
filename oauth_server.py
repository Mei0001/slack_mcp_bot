import os
import logging
import requests
import redis
import json
from flask import Flask, request, redirect, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis connection
redis_client = redis.Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

# OAuth configurations
OAUTH_CONFIGS = {
    'notion': {
        'client_id': os.getenv('NOTION_OAUTH_CLIENT_ID'),
        'client_secret': os.getenv('NOTION_OAUTH_CLIENT_SECRET'),
        'token_url': 'https://api.notion.com/v1/oauth/token',
        'redirect_uri': os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:5001/oauth/callback')
    },
    'google-drive': {
        'client_id': os.getenv('GOOGLE_CLIENT_ID'),
        'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
        'token_url': 'https://oauth2.googleapis.com/token',
        'redirect_uri': os.getenv('OAUTH_REDIRECT_URI', 'http://localhost:5001/oauth/callback')
    }
}

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'OAuth Server',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/oauth/callback', methods=['GET'])
def oauth_callback():
    """Handle OAuth callback from service providers"""
    code = request.args.get('code')
    state = request.args.get('state')
    error = request.args.get('error')
    
    if error:
        logger.error(f"OAuth error: {error}")
        return redirect(f"slack://app?error={error}")
    
    if not code or not state:
        return jsonify({'error': 'Missing code or state parameter'}), 400
    
    try:
        # Validate state from Redis
        state_key = f"oauth:state:{state}"
        state_data = redis_client.get(state_key)
        
        if not state_data:
            return jsonify({'error': 'Invalid or expired state'}), 400
        
        # Delete state after validation (one-time use)
        redis_client.delete(state_key)
        
        state_info = json.loads(state_data)
        service_type = state_info['serviceType']
        slack_user_id = state_info['slackUserId']
        channel_id = state_info['channelId']
        
        # Get OAuth config for the service
        config = OAUTH_CONFIGS.get(service_type)
        if not config:
            return jsonify({'error': f'Unknown service type: {service_type}'}), 400
        
        # Exchange code for tokens
        token_data = exchange_code_for_tokens(code, service_type, config)
        
        if not token_data:
            return jsonify({'error': 'Failed to exchange code for tokens'}), 500
        
        # Store tokens in Redis
        store_tokens(slack_user_id, service_type, token_data)
        
        # Redirect back to Slack with success
        return redirect(f"slack://app?team={os.getenv('SLACK_TEAM_ID')}&id={channel_id}&auth_success=true&service={service_type}")
        
    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

def exchange_code_for_tokens(code, service_type, config):
    """Exchange authorization code for access tokens"""
    try:
        if service_type == 'notion':
            # Notion OAuth 2.0 specification: uses JSON format with Basic Auth
            headers = {
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            }
            
            # Basic Auth with client credentials
            import base64
            auth_string = f"{config['client_id']}:{config['client_secret']}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            headers['Authorization'] = f'Basic {auth_b64}'
            
            data = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': config['redirect_uri']
            }
            
            logger.info(f"Exchanging code for Notion tokens: {config['token_url']}")
            logger.debug(f"Request data: {data}")
            
            response = requests.post(
                config['token_url'],
                headers=headers,
                json=data,
                timeout=30
            )
            
        else:
            # Google uses form-encoded data
            headers = {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            data = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': config['redirect_uri'],
                'client_id': config['client_id'],
                'client_secret': config['client_secret']
            }
            
            response = requests.post(
                config['token_url'],
                headers=headers,
                data=data,
                timeout=30
            )
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.error(f"Token exchange error: {str(e)}")
        return None

def store_tokens(user_id, service_type, token_data):
    """Store OAuth tokens in Redis"""
    try:
        # Calculate expiration time
        expires_in = token_data.get('expires_in', 3600)
        expires_at = datetime.now() + timedelta(seconds=expires_in)
        
        # Prepare token data
        tokens = {
            'accessToken': token_data.get('access_token'),
            'refreshToken': token_data.get('refresh_token'),
            'expiresAt': expires_at.isoformat(),
            'serviceType': service_type,
            'metadata': {
                'workspace_id': token_data.get('workspace_id'),
                'workspace_name': token_data.get('workspace_name'),
                'bot_id': token_data.get('bot_id'),
                'scope': token_data.get('scope')
            }
        }
        
        # Store in Redis with 30-day TTL
        key = f"oauth:tokens:{user_id}:{service_type}"
        ttl = 30 * 24 * 60 * 60  # 30 days
        redis_client.setex(key, ttl, json.dumps(tokens))
        
        logger.info(f"Tokens stored for user {user_id}, service {service_type}")
        
    except Exception as e:
        logger.error(f"Token storage error: {str(e)}")
        raise

@app.route('/oauth/revoke', methods=['POST'])
def revoke_tokens():
    """Revoke OAuth tokens for a user and service"""
    try:
        data = request.json
        user_id = data.get('user_id')
        service_type = data.get('service_type')
        
        if not user_id or not service_type:
            return jsonify({'error': 'Missing user_id or service_type'}), 400
        
        # Delete tokens from Redis
        key = f"oauth:tokens:{user_id}:{service_type}"
        deleted = redis_client.delete(key)
        
        if deleted:
            logger.info(f"Tokens revoked for user {user_id}, service {service_type}")
            return jsonify({'success': True, 'message': 'Tokens revoked successfully'})
        else:
            return jsonify({'success': False, 'message': 'No tokens found to revoke'}), 404
            
    except Exception as e:
        logger.error(f"Token revocation error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('OAUTH_SERVER_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')