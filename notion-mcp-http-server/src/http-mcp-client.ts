import { MCPRequest, MCPResponse, SupportedTool } from './types.js';

export interface HTTPMCPClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
}

export class HTTPMCPClient {
  private baseURL: string;
  private timeout: number;
  private retries: number;

  constructor(config: HTTPMCPClientConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, ''); // 末尾のスラッシュを削除
    this.timeout = config.timeout || 30000; // 30秒
    this.retries = config.retries || 2;
  }

  /**
   * MCPツールを実行する
   */
  async executeTool(
    toolName: SupportedTool,
    args: Record<string, any>,
    userToken: string,
    notionVersion: string = '2022-06-28'
  ): Promise<any> {
    const request: MCPRequest = {
      tool: toolName,
      arguments: args,
      auth: {
        token: userToken,
        version: notionVersion
      }
    };

    console.log(`[HTTPMCPClient] 🚀 Executing tool: ${toolName}`, {
      args: Object.keys(args),
      hasToken: !!userToken,
      timestamp: new Date().toISOString()
    });

    const startTime = Date.now();

    try {
      const response = await this.makeRequest('/mcp/execute', request);
      const executionTime = Date.now() - startTime;

      if (response.success) {
        console.log(`[HTTPMCPClient] ✅ Tool execution successful:`, {
          toolName,
          executionTime: `${executionTime}ms`,
          hasData: !!response.data
        });
        return response.data;
      } else {
        console.error(`[HTTPMCPClient] ❌ Tool execution failed:`, {
          toolName,
          executionTime: `${executionTime}ms`,
          error: response.error
        });
        throw new Error(response.error?.message || 'Unknown MCP error');
      }

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`[HTTPMCPClient] ❌ HTTP request failed:`, {
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
  async getAvailableTools(): Promise<any[]> {
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
      console.error('[HTTPMCPClient] Failed to get tools:', error);
      throw error;
    }
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5秒タイムアウト
      });

      const data = await response.json() as { status: string };
      return response.ok && data.status === 'ok';

    } catch (error) {
      console.warn('[HTTPMCPClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * HTTPリクエストを実行（リトライ機能付き）
   */
  private async makeRequest(endpoint: string, data: MCPRequest, attempt = 1): Promise<MCPResponse> {
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

      const result = await response.json() as MCPResponse;
      return result;

    } catch (error: any) {
      console.error(`[HTTPMCPClient] Request failed (attempt ${attempt}):`, {
        endpoint,
        error: error.message,
        attempt,
        maxRetries: this.retries
      });

      // リトライ処理
      if (attempt < this.retries && this.shouldRetry(error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数バックオフ（最大5秒）
        console.log(`[HTTPMCPClient] Retrying in ${delay}ms...`);
        
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
    // ネットワークエラーやタイムアウトはリトライ
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }

    // 500番台のエラーはリトライ
    if (error.message.includes('HTTP 5')) {
      return true;
    }

    // 429 (Rate Limited) もリトライ
    if (error.message.includes('HTTP 429')) {
      return true;
    }

    return false;
  }

  /**
   * バッチでツールを実行（将来の拡張用）
   */
  async executeBatch(requests: Array<{
    tool: SupportedTool;
    args: Record<string, any>;
    userToken: string;
  }>): Promise<any[]> {
    try {
      const batchRequest = {
        requests: requests.map(req => ({
          tool: req.tool,
          arguments: req.args,
          auth: {
            token: req.userToken,
            version: '2022-06-28'
          }
        }))
      };

      const response = await fetch(`${this.baseURL}/mcp/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batchRequest),
        signal: AbortSignal.timeout(this.timeout * 2) // バッチは時間を長めに
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { success: boolean; data: { results: any[] } };
      return result.success ? result.data.results : [];

    } catch (error: any) {
      console.error('[HTTPMCPClient] Batch execution failed:', error);
      throw error;
    }
  }
} 