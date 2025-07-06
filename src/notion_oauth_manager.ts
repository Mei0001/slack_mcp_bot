import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Notion公式OAuth 2.0を使用したアカウント管理
 * 従来のカスタムOAuthサーバーの代わりにNotion公式OAuthを使用
 */

interface NotionAccount {
  id: string;
  name: string;
  email: string;
  workspace: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scopes: string[];
  isActive: boolean;
  createdAt: number;
  lastUsed?: number;
  botId?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string;
}

interface UserAccountData {
  accounts: Record<string, NotionAccount>;
  activeAccount: string | null;
  defaultAccount: string | null;
  settings: {
    autoAccountSelection: boolean;
    workKeywords: string[];
    personalKeywords: string[];
  };
}

interface OAuthSession {
  id: string;
  slackUserId: string;
  state: string;
  accountAlias?: string;
  createdAt: number;
  expiresAt: number;
}

export class NotionOAuthManager {
  private dataDir: string;
  private users: Map<string, UserAccountData> = new Map();
  private sessions: Map<string, OAuthSession> = new Map();
  
  // Notion OAuth設定
  private readonly NOTION_CLIENT_ID: string;
  private readonly NOTION_CLIENT_SECRET: string;
  private readonly REDIRECT_URI: string;
  private readonly NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
  private readonly NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

  constructor(dataDir: string, redirectUri: string) {
    this.dataDir = dataDir;
    this.REDIRECT_URI = redirectUri;
    
    // 環境変数からNotion OAuth設定を取得
    this.NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID || '';
    this.NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || '';
    
    if (!this.NOTION_CLIENT_ID || !this.NOTION_CLIENT_SECRET) {
      console.warn('⚠️ NOTION_CLIENT_ID or NOTION_CLIENT_SECRET not found in environment');
    }
    
    this.initializeDataDir();
    this.loadUserData();
  }

  private async initializeDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create data directory:', error);
    }
  }

  private async loadUserData() {
    try {
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const userId = file.replace('.json', '');
          const filePath = path.join(this.dataDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          this.users.set(userId, JSON.parse(data));
        }
      }
      console.log(`📁 Loaded ${this.users.size} user accounts`);
    } catch (error) {
      console.log('📁 No existing user data found, starting fresh');
    }
  }

  private async saveUserData(slackUserId: string) {
    try {
      const userData = this.users.get(slackUserId);
      if (userData) {
        const filePath = path.join(this.dataDir, `${slackUserId}.json`);
        await fs.writeFile(filePath, JSON.stringify(userData, null, 2));
      }
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  }

  /**
   * Notion OAuth認証フローを開始
   */
  async addAccount(slackUserId: string, accountAlias?: string): Promise<{ authUrl: string; sessionId: string }> {
    console.log(`🔐 Starting Notion OAuth flow for user ${slackUserId}${accountAlias ? ` (alias: ${accountAlias})` : ''}`);

    if (!this.NOTION_CLIENT_ID) {
      throw new Error('NOTION_CLIENT_ID is not configured');
    }

    // セッション作成
    const sessionId = crypto.randomUUID();
    const state = crypto.randomUUID();
    
    const session: OAuthSession = {
      id: sessionId,
      slackUserId,
      state,
      accountAlias,
      createdAt: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30分
    };

    this.sessions.set(sessionId, session);

    // Notion OAuth認証URL生成
    const authParams = new URLSearchParams({
      client_id: this.NOTION_CLIENT_ID,
      response_type: 'code',
      redirect_uri: this.REDIRECT_URI,
      state: `${sessionId}:${state}`,
      // Notionのスコープは固定（read content, update content, insert content）
    });

    const authUrl = `${this.NOTION_AUTH_URL}?${authParams.toString()}`;

    console.log(`✅ Notion OAuth flow initiated for user ${slackUserId}`);
    console.log(`🔗 Authorization URL: ${authUrl}`);

    return { authUrl, sessionId };
  }

  /**
   * OAuth コールバック処理
   */
  async handleCallback(code: string, state: string): Promise<{ slackUserId: string; accountId: string }> {
    console.log(`🔄 Processing OAuth callback with state: ${state}`);

    // セッション検証
    const [sessionId, expectedState] = state.split(':');
    const session = this.sessions.get(sessionId);

    if (!session || session.state !== expectedState) {
      throw new Error('Invalid session or state');
    }

    if (Date.now() > session.expiresAt) {
      throw new Error('Session expired');
    }

    try {
      // 認証コードをアクセストークンに交換
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      // ユーザー情報を取得
      const userInfo = await this.getUserInfo(tokenResponse.access_token);
      
      // アカウント情報を保存
      const accountId = await this.saveAccount(session.slackUserId, tokenResponse, userInfo, session.accountAlias);

      // セッション削除
      this.sessions.delete(sessionId);

      console.log(`✅ OAuth callback completed for user ${session.slackUserId}, account ${accountId}`);
      
      return { slackUserId: session.slackUserId, accountId };

    } catch (error) {
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  /**
   * 認証コードをアクセストークンに交換
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    const tokenData = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.REDIRECT_URI,
    };

    // Basic認証用のクレデンシャル
    const credentials = Buffer.from(`${this.NOTION_CLIENT_ID}:${this.NOTION_CLIENT_SECRET}`).toString('base64');

    const response = await fetch(this.NOTION_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Notion-Version': '2022-06-28',
      },
      body: new URLSearchParams(tokenData).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * アクセストークンを使用してユーザー情報を取得
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * アカウント情報を保存
   */
  private async saveAccount(slackUserId: string, tokenData: any, userInfo: any, accountAlias?: string): Promise<string> {
    // ユーザーデータの初期化
    if (!this.users.has(slackUserId)) {
      this.users.set(slackUserId, {
        accounts: {},
        activeAccount: null,
        defaultAccount: null,
        settings: {
          autoAccountSelection: true,
          workKeywords: ['work', 'job', '仕事', '業務', 'office'],
          personalKeywords: ['personal', 'private', '個人', 'プライベート'],
        },
      });
    }

    const userData = this.users.get(slackUserId)!;
    const accountId = crypto.randomUUID();

    // ワークスペース名の取得（botがある場合）
    let workspaceName = 'Unknown Workspace';
    if (tokenData.workspace_name) {
      workspaceName = tokenData.workspace_name;
    } else if (userInfo.name) {
      workspaceName = userInfo.name;
    }

    const account: NotionAccount = {
      id: accountId,
      name: accountAlias || workspaceName || 'Notion Account',
      email: userInfo.person?.email || 'unknown@example.com',
      workspace: workspaceName,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined,
      scopes: tokenData.scope ? tokenData.scope.split(' ') : ['read'],
      isActive: Object.keys(userData.accounts).length === 0, // 最初のアカウントをアクティブに
      createdAt: Date.now(),
      botId: tokenData.bot_id,
      workspaceId: tokenData.workspace_id,
      workspaceName: tokenData.workspace_name,
      workspaceIcon: tokenData.workspace_icon,
    };

    userData.accounts[accountId] = account;

    // 最初のアカウントの場合はアクティブ・デフォルトに設定
    if (!userData.activeAccount) {
      userData.activeAccount = accountId;
      userData.defaultAccount = accountId;
    }

    await this.saveUserData(slackUserId);

    console.log(`💾 Saved account ${accountId} for user ${slackUserId}: ${account.name} (${account.workspace})`);
    
    return accountId;
  }

  /**
   * ユーザーのアカウント一覧を取得
   */
  async listAccounts(slackUserId: string): Promise<NotionAccount[]> {
    const userData = this.users.get(slackUserId);
    if (!userData) return [];

    return Object.values(userData.accounts);
  }

  /**
   * アクティブなアクセストークンを取得
   */
  async getActiveToken(slackUserId: string): Promise<string | null> {
    const userData = this.users.get(slackUserId);
    if (!userData || !userData.activeAccount) return null;

    const account = userData.accounts[userData.activeAccount];
    if (!account) return null;

    // トークンの有効期限チェック（もしあれば）
    if (account.expiresAt && Date.now() > account.expiresAt) {
      console.warn(`Token expired for account ${account.id}`);
      return null;
    }

    account.lastUsed = Date.now();
    await this.saveUserData(slackUserId);

    return account.accessToken;
  }

  /**
   * アカウントを取得
   */
  async getAccount(slackUserId: string, accountId: string): Promise<NotionAccount | null> {
    const userData = this.users.get(slackUserId);
    return userData?.accounts[accountId] || null;
  }

  /**
   * アクティブアカウントを切り替え
   */
  async switchAccount(slackUserId: string, accountId: string): Promise<void> {
    const userData = this.users.get(slackUserId);
    if (!userData || !userData.accounts[accountId]) {
      throw new Error('Account not found');
    }

    // 現在のアクティブアカウントを非アクティブに
    if (userData.activeAccount) {
      userData.accounts[userData.activeAccount].isActive = false;
    }

    // 新しいアカウントをアクティブに
    userData.activeAccount = accountId;
    userData.accounts[accountId].isActive = true;
    userData.accounts[accountId].lastUsed = Date.now();

    await this.saveUserData(slackUserId);
    console.log(`🔄 Switched active account for user ${slackUserId} to ${accountId}`);
  }

  /**
   * アカウントを削除
   */
  async removeAccount(slackUserId: string, accountId: string): Promise<void> {
    const userData = this.users.get(slackUserId);
    if (!userData || !userData.accounts[accountId]) {
      throw new Error('Account not found');
    }

    delete userData.accounts[accountId];

    // 削除されたアカウントがアクティブだった場合
    if (userData.activeAccount === accountId) {
      const remainingAccounts = Object.keys(userData.accounts);
      userData.activeAccount = remainingAccounts.length > 0 ? remainingAccounts[0] : null;
      
      if (userData.activeAccount) {
        userData.accounts[userData.activeAccount].isActive = true;
      }
    }

    await this.saveUserData(slackUserId);
    console.log(`🗑️ Removed account ${accountId} for user ${slackUserId}`);
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired OAuth sessions`);
    }
  }
}