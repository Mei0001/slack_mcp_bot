// Cloudflare Workers用の型定義

declare global {
  interface KVNamespace {
    get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
    put(key: string, value: string | ArrayBuffer | ReadableStream, options?: {
      expiration?: number;
      expirationTtl?: number;
      metadata?: any;
    }): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: {
      prefix?: string;
      limit?: number;
      cursor?: string;
    }): Promise<{
      keys: { name: string; metadata?: any }[];
      list_complete: boolean;
      cursor?: string;
    }>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }

  interface CloudflareEnv {
    TOKEN_CACHE?: KVNamespace;
    ALLOWED_ORIGINS?: string;
    NODE_ENV?: string;
    [key: string]: any;
  }
}

export {}; 