import { z } from 'zod';

// リクエストの型定義
export const MCPRequestSchema = z.object({
  tool: z.string(),
  arguments: z.record(z.any()),
  auth: z.object({
    token: z.string(),
    version: z.string().optional().default('2022-06-28')
  })
});

export type MCPRequest = z.infer<typeof MCPRequestSchema>;

// レスポンスの型定義
export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: {
    toolName: string;
    executionTime: number;
    timestamp: string;
  };
}

// Notion認証情報の型
export interface NotionAuth {
  token: string;
  version: string;
}

// サポートされるツールの型
export type SupportedTool = 
  | 'mcp_notionApi_API-post-search'
  | 'mcp_notionApi_API-post-database-query'
  | 'mcp_notionApi_API-retrieve-a-page'
  | 'mcp_notionApi_API-retrieve-a-database'
  | 'mcp_notionApi_API-get-block-children'
  | 'mcp_notionApi_API-patch-page'
  | 'mcp_notionApi_API-post-page'
  | 'mcp_notionApi_API-create-a-database'
  | 'mcp_notionApi_API-update-a-database'
  | 'mcp_notionApi_API-get-users'
  | 'mcp_notionApi_API-get-user'
  | 'mcp_notionApi_API-get-self';

// エラー型
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
} 