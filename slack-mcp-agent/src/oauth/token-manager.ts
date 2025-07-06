import Redis from 'ioredis';
import { nanoid } from 'nanoid';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  serviceType: 'notion' | 'google-drive';
  metadata?: Record<string, any>;
}

export interface OAuthState {
  slackUserId: string;
  channelId: string;
  serviceType: 'notion' | 'google-drive';
  timestamp: Date;
}

export class OAuthTokenManager {
  private redis: Redis;
  private tokenTTL: number = 30 * 24 * 60 * 60; // 30 days
  private stateTTL: number = 10 * 60; // 10 minutes

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async storeTokens(userId: string, serviceType: string, tokens: OAuthTokens): Promise<void> {
    const key = `oauth:tokens:${userId}:${serviceType}`;
    const data = JSON.stringify({
      ...tokens,
      expiresAt: tokens.expiresAt.toISOString()
    });
    
    await this.redis.setex(key, this.tokenTTL, data);
  }

  async getTokens(userId: string, serviceType: string): Promise<OAuthTokens | null> {
    const key = `oauth:tokens:${userId}:${serviceType}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    const tokens = JSON.parse(data);
    tokens.expiresAt = new Date(tokens.expiresAt);
    
    // Check if token is expired
    if (tokens.expiresAt < new Date()) {
      await this.removeTokens(userId, serviceType);
      return null;
    }
    
    return tokens;
  }

  async removeTokens(userId: string, serviceType: string): Promise<void> {
    const key = `oauth:tokens:${userId}:${serviceType}`;
    await this.redis.del(key);
  }

  async generateState(slackUserId: string, channelId: string, serviceType: 'notion' | 'google-drive'): Promise<string> {
    const state = nanoid();
    const key = `oauth:state:${state}`;
    const data: OAuthState = {
      slackUserId,
      channelId,
      serviceType,
      timestamp: new Date()
    };
    
    await this.redis.setex(key, this.stateTTL, JSON.stringify(data));
    return state;
  }

  async validateState(state: string): Promise<OAuthState | null> {
    const key = `oauth:state:${state}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;
    
    // Delete state after validation (one-time use)
    await this.redis.del(key);
    
    const stateData = JSON.parse(data);
    stateData.timestamp = new Date(stateData.timestamp);
    
    return stateData;
  }

  async listUserServices(userId: string): Promise<string[]> {
    const pattern = `oauth:tokens:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    
    return keys.map(key => {
      const parts = key.split(':');
      return parts[parts.length - 1];
    });
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}