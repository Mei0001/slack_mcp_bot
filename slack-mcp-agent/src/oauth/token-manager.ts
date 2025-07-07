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
    const finalRedisUrl = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`[TokenManager] 🔗 Connecting to Redis: ${finalRedisUrl}`);
    
    this.redis = new Redis(finalRedisUrl);
    
    // Redis connection event handlers for debugging
    this.redis.on('connect', () => {
      console.log(`[TokenManager] ✅ Redis connected successfully`);
    });
    
    this.redis.on('error', (error) => {
      console.error(`[TokenManager] ❌ Redis connection error:`, error);
    });
    
    this.redis.on('ready', () => {
      console.log(`[TokenManager] 🚀 Redis ready for operations`);
    });
  }

  async storeTokens(userId: string, serviceType: string, tokens: OAuthTokens): Promise<void> {
    const key = `oauth:tokens:${userId}:${serviceType}`;
    console.log(`[TokenManager] 💾 Storing tokens for user ${userId}, service ${serviceType}`);
    console.log(`[TokenManager] 📊 Token details:`, {
      hasAccessToken: !!tokens.accessToken,
      accessTokenLength: tokens.accessToken ? tokens.accessToken.length : 0,
      hasRefreshToken: !!tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
      serviceType: tokens.serviceType,
      ttlSeconds: this.tokenTTL
    });
    
    const data = JSON.stringify({
      ...tokens,
      expiresAt: tokens.expiresAt.toISOString()
    });
    
    try {
      await this.redis.setex(key, this.tokenTTL, data);
      console.log(`[TokenManager] ✅ Tokens stored successfully with key: ${key}`);
    } catch (error: any) {
      console.error(`[TokenManager] ❌ Failed to store tokens:`, {
        userId,
        serviceType,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async getTokens(userId: string, serviceType: string): Promise<OAuthTokens | null> {
    const key = `oauth:tokens:${userId}:${serviceType}`;
    console.log(`[TokenManager] 🔍 Looking for tokens with key: ${key}`);
    
    try {
      const data = await this.redis.get(key);
      console.log(`[TokenManager] 📊 Redis get result:`, {
        hasData: !!data,
        dataLength: data ? data.length : 0,
        dataPreview: data ? data.substring(0, 50) + '...' : 'null'
      });
      
      if (!data) {
        console.log(`[TokenManager] ❌ No token data found for user ${userId}, service ${serviceType}`);
        return null;
      }
      
      console.log(`[TokenManager] 🔄 Parsing token data...`);
      const tokens = JSON.parse(data);
      tokens.expiresAt = new Date(tokens.expiresAt);
      
      console.log(`[TokenManager] 📊 Parsed token info:`, {
        hasAccessToken: !!tokens.accessToken,
        accessTokenLength: tokens.accessToken ? tokens.accessToken.length : 0,
        hasRefreshToken: !!tokens.refreshToken,
        expiresAt: tokens.expiresAt.toISOString(),
        serviceType: tokens.serviceType,
        hasMetadata: !!tokens.metadata
      });
      
      // Check if token is expired
      const now = new Date();
      const isExpired = tokens.expiresAt < now;
      console.log(`[TokenManager] ⏰ Token expiration check:`, {
        expiresAt: tokens.expiresAt.toISOString(),
        currentTime: now.toISOString(),
        isExpired: isExpired,
        timeUntilExpiry: isExpired ? 'expired' : `${Math.round((tokens.expiresAt.getTime() - now.getTime()) / 1000 / 60)} minutes`
      });
      
      if (isExpired) {
        console.log(`[TokenManager] 🗑️ Token expired, removing from Redis...`);
        await this.removeTokens(userId, serviceType);
        return null;
      }
      
      console.log(`[TokenManager] ✅ Valid tokens retrieved for user ${userId}, service ${serviceType}`);
      return tokens;
      
    } catch (error: any) {
      console.error(`[TokenManager] ❌ Error retrieving tokens:`, {
        userId,
        serviceType,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
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