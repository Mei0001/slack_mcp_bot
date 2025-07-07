import { MCPClient } from '@mastra/mcp';
import { OAuthTokenManager } from '../oauth/token-manager';

export interface AuthenticatedMCPConfig {
  userId: string;
  tokenManager: OAuthTokenManager;
}

export class AuthenticatedMCPClient {
  private userId: string;
  private tokenManager: OAuthTokenManager;
  private mcpClient: MCPClient | null = null;

  constructor(config: AuthenticatedMCPConfig) {
    this.userId = config.userId;
    this.tokenManager = config.tokenManager;
  }

  async initialize(): Promise<boolean> {
    try {
      // Get user's tokens from Redis
      const notionTokens = await this.tokenManager.getTokens(this.userId, 'notion');
      const googleTokens = await this.tokenManager.getTokens(this.userId, 'google-drive');

      const servers: any = {};

      // Configure Notion MCP if tokens exist
      if (notionTokens && notionTokens.accessToken) {
        servers.notion = {
          type: "http",
          url: "https://mcp.notion.com/mcp",
          headers: {
            "Authorization": `Bearer ${notionTokens.accessToken}`
          }
        };
        console.log(`[MCP] Notion configured for user ${this.userId}`);
      }

      // Configure Google Drive MCP if tokens exist
      if (googleTokens && googleTokens.accessToken) {
        servers['google-drive'] = {
          type: "http",
          url: process.env.GOOGLE_DRIVE_MCP_URL || "https://mcp.googleapis.com/drive/v1",
          headers: {
            "Authorization": `Bearer ${googleTokens.accessToken}`
          }
        };
        console.log(`[MCP] Google Drive configured for user ${this.userId}`);
      }

      // Only create MCP client if at least one service is configured
      if (Object.keys(servers).length > 0) {
        this.mcpClient = new MCPClient({
          servers,
          timeout: 60000
        });
        
        // Initialize the client
        await this.mcpClient.initialize();
        return true;
      } else {
        console.log(`[MCP] No authenticated services for user ${this.userId}`);
        return false;
      }
    } catch (error) {
      console.error(`[MCP] Failed to initialize authenticated client:`, error);
      return false;
    }
  }

  async getTools() {
    if (!this.mcpClient) {
      return [];
    }

    try {
      const tools = await this.mcpClient.getTools();
      return tools;
    } catch (error) {
      console.error(`[MCP] Failed to get tools:`, error);
      return [];
    }
  }

  async getConnectedServices(): Promise<string[]> {
    const services: string[] = [];
    
    const notionTokens = await this.tokenManager.getTokens(this.userId, 'notion');
    if (notionTokens) services.push('notion');
    
    const googleTokens = await this.tokenManager.getTokens(this.userId, 'google-drive');
    if (googleTokens) services.push('google-drive');
    
    return services;
  }

  async refreshTokenIfNeeded(serviceType: string): Promise<boolean> {
    const tokens = await this.tokenManager.getTokens(this.userId, serviceType);
    if (!tokens) return false;

    // Check if token is about to expire (within 5 minutes)
    const now = new Date();
    const expiresAt = new Date(tokens.expiresAt);
    const timeDiff = expiresAt.getTime() - now.getTime();
    const minutesUntilExpiry = timeDiff / (1000 * 60);

    if (minutesUntilExpiry < 5 && tokens.refreshToken) {
      // TODO: Implement token refresh logic
      console.log(`[MCP] Token for ${serviceType} expiring soon, refresh needed`);
      return false;
    }

    return true;
  }

  getMCPClient(): MCPClient | null {
    return this.mcpClient;
  }
}