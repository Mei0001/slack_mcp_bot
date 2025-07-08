/**
 * HTTP MCP サーバー用のMastra互換アダプター
 * 既存のMCPClient.getTools()と互換性を保つ
 */

interface HTTPMCPConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

interface MCPTool {
  execute: (args: Record<string, any>) => Promise<any>;
  description?: string;
  parameters?: any;
}

export class HTTPMCPAdapter {
  private baseURL: string;
  private timeout: number;
  private retries: number;
  private userToken: string;

  constructor(config: HTTPMCPConfig, userToken: string) {
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 2;
    this.userToken = userToken;
  }

  /**
   * Mastra MCPClient.getTools()と互換性のあるツール一覧を返す
   */
  async getTools(): Promise<Record<string, MCPTool>> {
    console.log(`[HTTPMCPAdapter] 🔍 Getting tools from HTTP MCP server...`);

    try {
      // HTTPサーバーのヘルスチェック
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        console.warn(`[HTTPMCPAdapter] ⚠️ HTTP MCP server health check failed`);
        return {};
      }

      // 利用可能なツール一覧を取得
      const availableTools = await this.getAvailableTools();
      console.log(`[HTTPMCPAdapter] 📋 Found ${availableTools.length} available tools`);

      // Mastra互換のツールオブジェクトを作成
      const tools: Record<string, MCPTool> = {};

      // 必要なツールのマッピング（Notion MCP → HTTP MCP）
      const toolMapping: Record<string, string> = {
        'mcp_notionApi_API-post-search': 'mcp_notionApi_API-post-search',
        'mcp_notionApi_API-post-database-query': 'mcp_notionApi_API-post-database-query',
        'mcp_notionApi_API-retrieve-a-page': 'mcp_notionApi_API-retrieve-a-page',
        'mcp_notionApi_API-retrieve-a-database': 'mcp_notionApi_API-retrieve-a-database',
        'mcp_notionApi_API-get-block-children': 'mcp_notionApi_API-get-block-children',
        'mcp_notionApi_API-patch-page': 'mcp_notionApi_API-patch-page',
        'mcp_notionApi_API-post-page': 'mcp_notionApi_API-post-page',
        'mcp_notionApi_API-create-a-database': 'mcp_notionApi_API-create-a-database',
        'mcp_notionApi_API-update-a-database': 'mcp_notionApi_API-update-a-database',
        'mcp_notionApi_API-get-users': 'mcp_notionApi_API-get-users',
        'mcp_notionApi_API-get-user': 'mcp_notionApi_API-get-user',
        'mcp_notionApi_API-get-self': 'mcp_notionApi_API-get-self'
      };

      // 各ツールに対してMastra互換のラッパーを作成
      Object.entries(toolMapping).forEach(([mastraToolName, httpToolName]) => {
        tools[mastraToolName] = {
          execute: async (args: Record<string, any>) => {
            console.log(`[HTTPMCPAdapter] 🛠️ Executing tool: ${mastraToolName} → ${httpToolName}`);
            return await this.executeTool(httpToolName, args);
          },
          description: this.getToolDescription(httpToolName),
          parameters: {}
        };
      });

      console.log(`[HTTPMCPAdapter] ✅ Created ${Object.keys(tools).length} Mastra-compatible tools`);
      return tools;

    } catch (error: any) {
      console.error(`[HTTPMCPAdapter] ❌ Failed to get tools:`, error);
      return {};
    }
  }

  /**
   * HTTP MCPサーバーでツールを実行
   */
  private async executeTool(toolName: string, args: Record<string, any>): Promise<any> {
    const startTime = Date.now();

    try {
      const request = {
        tool: toolName,
        arguments: args,
        auth: {
          token: this.userToken,
          version: '2022-06-28'
        }
      };

      const response = await this.makeRequest('/mcp/execute', request);
      const executionTime = Date.now() - startTime;

      if (response.success) {
        console.log(`[HTTPMCPAdapter] ✅ Tool execution successful:`, {
          toolName,
          executionTime: `${executionTime}ms`
        });
        return response.data;
      } else {
        console.error(`[HTTPMCPAdapter] ❌ Tool execution failed:`, {
          toolName,
          error: response.error
        });
        throw new Error(response.error?.message || 'Unknown HTTP MCP error');
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`[HTTPMCPAdapter] ❌ HTTP request failed:`, {
        toolName,
        executionTime: `${executionTime}ms`,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 利用可能なツール一覧を取得
   */
  private async getAvailableTools(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseURL}/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { success: boolean; data: { tools: any[] } };
      return data.success ? data.data.tools : [];

    } catch (error: any) {
      console.error('[HTTPMCPAdapter] Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * ヘルスチェック
   */
  private async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      const data = await response.json() as { status: string };
      return response.ok && data.status === 'ok';

    } catch (error) {
      console.warn('[HTTPMCPAdapter] Health check failed:', error);
      return false;
    }
  }

  /**
   * HTTPリクエストを実行（リトライ機能付き）
   */
  private async makeRequest(endpoint: string, data: any, attempt = 1): Promise<any> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Slack-MCP-Bot/1.0'
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      console.error(`[HTTPMCPAdapter] Request failed (attempt ${attempt}):`, {
        endpoint,
        error: error.message,
        attempt,
        maxRetries: this.retries
      });

      // リトライ処理
      if (attempt < this.retries && this.shouldRetry(error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[HTTPMCPAdapter] Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, data, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * リトライすべきエラーかどうかを判定
   */
  private shouldRetry(error: any): boolean {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
    if (error.message.includes('HTTP 5') || error.message.includes('HTTP 429')) {
      return true;
    }
    return false;
  }

  /**
   * ツールの説明を取得
   */
  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      'mcp_notionApi_API-post-search': 'Notionワークスペース全体を検索',
      'mcp_notionApi_API-post-database-query': 'データベースをクエリ',
      'mcp_notionApi_API-retrieve-a-page': 'ページを取得',
      'mcp_notionApi_API-retrieve-a-database': 'データベースを取得',
      'mcp_notionApi_API-get-block-children': 'ブロックの子要素を取得',
      'mcp_notionApi_API-patch-page': 'ページを更新',
      'mcp_notionApi_API-post-page': 'ページを作成',
      'mcp_notionApi_API-create-a-database': 'データベースを作成',
      'mcp_notionApi_API-update-a-database': 'データベースを更新',
      'mcp_notionApi_API-get-users': 'ユーザーリストを取得',
      'mcp_notionApi_API-get-user': 'ユーザー情報を取得',
      'mcp_notionApi_API-get-self': '自分のユーザー情報を取得'
    };

    return descriptions[toolName] || `HTTP MCP tool: ${toolName}`;
  }
} 