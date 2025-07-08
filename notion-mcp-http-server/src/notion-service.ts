import { Client } from '@notionhq/client';
import { MCPError, NotionAuth, SupportedTool } from './types.js';

export class NotionService {
  private client: Client;

  constructor(auth: NotionAuth) {
    this.client = new Client({
      auth: auth.token,
      notionVersion: auth.version
    });
  }

  async executeTool(toolName: SupportedTool, args: Record<string, any>): Promise<any> {
    const startTime = Date.now();
    console.log(`[NotionService] 🛠️ Executing tool: ${toolName}`, {
      args: Object.keys(args),
      timestamp: new Date().toISOString()
    });

    try {
      const result = await this.callNotionAPI(toolName, args);
      
      const executionTime = Date.now() - startTime;
      console.log(`[NotionService] ✅ Tool execution completed:`, {
        toolName,
        executionTime: `${executionTime}ms`,
        hasResult: !!result
      });

      return result;
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`[NotionService] ❌ Tool execution failed:`, {
        toolName,
        executionTime: `${executionTime}ms`,
        error: error.message,
        code: error.code
      });
      
      throw new MCPError(
        `Notion API call failed: ${error.message}`,
        error.code || 'NOTION_API_ERROR',
        { originalError: error, toolName, args }
      );
    }
  }

  private async callNotionAPI(toolName: SupportedTool, args: Record<string, any>): Promise<any> {
    switch (toolName) {
      case 'mcp_notionApi_API-post-search':
        return await this.client.search({
          query: args.query,
          filter: args.filter,
          sort: args.sort,
          start_cursor: args.start_cursor,
          page_size: args.page_size
        });

      case 'mcp_notionApi_API-post-database-query':
        return await this.client.databases.query({
          database_id: args.database_id,
          filter: args.filter,
          sorts: args.sorts,
          start_cursor: args.start_cursor,
          page_size: args.page_size
        });

      case 'mcp_notionApi_API-retrieve-a-page':
        return await this.client.pages.retrieve({
          page_id: args.page_id
        });

      case 'mcp_notionApi_API-retrieve-a-database':
        return await this.client.databases.retrieve({
          database_id: args.database_id
        });

      case 'mcp_notionApi_API-get-block-children':
        return await this.client.blocks.children.list({
          block_id: args.block_id,
          start_cursor: args.start_cursor,
          page_size: args.page_size
        });

      case 'mcp_notionApi_API-patch-page':
        return await this.client.pages.update({
          page_id: args.page_id,
          properties: args.properties,
          archived: args.archived,
          icon: args.icon,
          cover: args.cover
        });

      case 'mcp_notionApi_API-post-page':
        return await this.client.pages.create({
          parent: args.parent,
          properties: args.properties,
          children: args.children,
          icon: args.icon,
          cover: args.cover
        });

      case 'mcp_notionApi_API-create-a-database':
        return await this.client.databases.create({
          parent: args.parent,
          title: args.title,
          properties: args.properties,
          icon: args.icon,
          cover: args.cover
        });

      case 'mcp_notionApi_API-update-a-database':
        return await this.client.databases.update({
          database_id: args.database_id,
          title: args.title,
          description: args.description,
          properties: args.properties,
          icon: args.icon,
          cover: args.cover
        });

      case 'mcp_notionApi_API-get-users':
        return await this.client.users.list({
          start_cursor: args.start_cursor,
          page_size: args.page_size
        });

      case 'mcp_notionApi_API-get-user':
        return await this.client.users.retrieve({
          user_id: args.user_id
        });

      case 'mcp_notionApi_API-get-self':
        return await this.client.users.me();

      default:
        throw new MCPError(
          `Unsupported tool: ${toolName}`,
          'UNSUPPORTED_TOOL',
          { toolName, availableTools: this.getSupportedTools() }
        );
    }
  }

  getSupportedTools(): SupportedTool[] {
    return [
      'mcp_notionApi_API-post-search',
      'mcp_notionApi_API-post-database-query',
      'mcp_notionApi_API-retrieve-a-page',
      'mcp_notionApi_API-retrieve-a-database',
      'mcp_notionApi_API-get-block-children',
      'mcp_notionApi_API-patch-page',
      'mcp_notionApi_API-post-page',
      'mcp_notionApi_API-create-a-database',
      'mcp_notionApi_API-update-a-database',
      'mcp_notionApi_API-get-users',
      'mcp_notionApi_API-get-user',
      'mcp_notionApi_API-get-self'
    ];
  }

  // ツール情報を取得するメソッド
  getToolInfo(toolName: SupportedTool): { description: string; parameters: string[] } {
    const toolInfo: Record<SupportedTool, { description: string; parameters: string[] }> = {
      'mcp_notionApi_API-post-search': {
        description: 'Notionワークスペース全体を検索',
        parameters: ['query', 'filter?', 'sort?', 'start_cursor?', 'page_size?']
      },
      'mcp_notionApi_API-post-database-query': {
        description: 'データベースをクエリ',
        parameters: ['database_id', 'filter?', 'sorts?', 'start_cursor?', 'page_size?']
      },
      'mcp_notionApi_API-retrieve-a-page': {
        description: 'ページを取得',
        parameters: ['page_id']
      },
      'mcp_notionApi_API-retrieve-a-database': {
        description: 'データベースを取得',
        parameters: ['database_id']
      },
      'mcp_notionApi_API-get-block-children': {
        description: 'ブロックの子要素を取得',
        parameters: ['block_id', 'start_cursor?', 'page_size?']
      },
      'mcp_notionApi_API-patch-page': {
        description: 'ページを更新',
        parameters: ['page_id', 'properties?', 'archived?', 'icon?', 'cover?']
      },
      'mcp_notionApi_API-post-page': {
        description: 'ページを作成',
        parameters: ['parent', 'properties', 'children?', 'icon?', 'cover?']
      },
      'mcp_notionApi_API-create-a-database': {
        description: 'データベースを作成',
        parameters: ['parent', 'title', 'properties', 'icon?', 'cover?']
      },
      'mcp_notionApi_API-update-a-database': {
        description: 'データベースを更新',
        parameters: ['database_id', 'title?', 'description?', 'properties?', 'icon?', 'cover?']
      },
      'mcp_notionApi_API-get-users': {
        description: 'ユーザーリストを取得',
        parameters: ['start_cursor?', 'page_size?']
      },
      'mcp_notionApi_API-get-user': {
        description: 'ユーザー情報を取得',
        parameters: ['user_id']
      },
      'mcp_notionApi_API-get-self': {
        description: '自分のユーザー情報を取得',
        parameters: []
      }
    };

    return toolInfo[toolName] || { description: 'Unknown tool', parameters: [] };
  }
} 