export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export const oauthConfigs: Record<string, OAuthConfig> = {
  notion: {
    clientId: process.env.NOTION_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:5001/oauth/callback',
    authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: ['read_content', 'update_content', 'insert_content']
  },
  'google-drive': {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || 'http://localhost:5001/oauth/callback',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ]
  }
};

export function getOAuthConfig(serviceType: string): OAuthConfig | null {
  return oauthConfigs[serviceType] || null;
}

export function generateAuthUrl(serviceType: string, state: string): string | null {
  const config = getOAuthConfig(serviceType);
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state: state,
    scope: config.scopes.join(' ')
  });

  // Notion specific parameters
  if (serviceType === 'notion') {
    params.append('owner', 'user');
  }

  // Google specific parameters
  if (serviceType === 'google-drive') {
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}