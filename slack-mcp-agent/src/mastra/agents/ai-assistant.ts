import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { MCPClient } from "@mastra/mcp";
import { OAuthTokenManager } from "../../oauth/token-manager";
import { HTTPMCPAdapter } from "../http-mcp-adapter";

// エージェントキャッシュ（メモリ内、1時間有効）
const agentCache = new Map<string, { agent: Agent; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1時間

// エージェントをMCPツールと共に作成する関数（Mastraドキュメント準拠）
export async function createAIAssistant(userId?: string) {
  // キャッシュチェック
  if (userId) {
    const cached = agentCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Agent] 📦 Returning cached agent for user ${userId}`);
      return cached.agent;
    }
  }
  // Claudeモデルの設定
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error("[Agent] ERROR: Anthropic API key not found!");
    console.error("[Agent] Please set ANTHROPIC_API_KEY");
    throw new Error("Anthropic API key is missing. Please set ANTHROPIC_API_KEY environment variable.");
  }
  
  const claudeModel = anthropic('claude-sonnet-4-20250514');
  
  try {
    let tools: Record<string, any> = {};
    let connectedServices: string[] = [];

    // MCP接続方式の決定（環境変数で制御）
    const mcpMode = process.env.MCP_MODE || 'local'; // 'local' または 'http'
    const httpMcpUrl = process.env.HTTP_MCP_URL || 'http://localhost:3002';

    console.log(`[Agent] 🔧 MCP Mode: ${mcpMode}`, {
      httpMcpUrl: mcpMode === 'http' ? httpMcpUrl : 'N/A',
      environmentCheck: {
        hasMcpMode: !!process.env.MCP_MODE,
        hasHttpMcpUrl: !!process.env.HTTP_MCP_URL
      }
    });
    
    // ユーザー認証済みMCPクライアントを作成（Mastraドキュメント準拠）
    if (userId) {
      console.log(`[Agent] 🔍 Creating authenticated MCP client for user ${userId}`);
      
      try {
        const tokenManager = new OAuthTokenManager();
        console.log(`[Agent] 🔑 TokenManager created, attempting to get tokens for user ${userId}`);
        
        // ユーザーのトークンを取得
        const notionTokens = await tokenManager.getTokens(userId, 'notion');
        console.log(`[Agent] 📊 Token retrieval result:`, {
          hasTokens: !!notionTokens,
          hasAccessToken: !!(notionTokens?.accessToken),
          tokenLength: notionTokens?.accessToken ? notionTokens.accessToken.length : 0,
          expiresAt: notionTokens?.expiresAt,
          metadata: notionTokens?.metadata
        });
        
        if (notionTokens && notionTokens.accessToken) {
          console.log(`[Agent] ✅ Found valid Notion tokens for user ${userId}`);
          
          if (mcpMode === 'http') {
            // HTTP MCP サーバー方式
            console.log(`[Agent] 🌐 Using HTTP MCP server: ${httpMcpUrl}`);
            
            try {
              const httpAdapter = new HTTPMCPAdapter({
                baseURL: httpMcpUrl,
                timeout: 30000,
                retries: 2
              }, notionTokens.accessToken);

              console.log(`[Agent] 🛠️ HTTP MCP Adapter created, attempting to get tools...`);
              const httpTools = await httpAdapter.getTools();
              
              // HTTPから取得したツールをマージ
              Object.assign(tools, httpTools);
              connectedServices.push('notion-http');

              console.log(`[Agent] 🎉 Loaded ${Object.keys(httpTools).length} tools from HTTP MCP server`);
              console.log(`[Agent] 📋 HTTP MCP tools:`, Object.keys(httpTools));

            } catch (httpError: any) {
              console.error(`[Agent] ❌ Failed to connect to HTTP MCP server:`, httpError);
              console.log(`[Agent] 🔄 Falling back to local MCP...`);
              
                             // HTTP接続失敗時は従来のローカルMCPにフォールバック
               console.log(`[Agent] 🔄 Attempting local MCP fallback...`);
               // ローカルMCPの処理は省略（HTTP失敗時のみ表示）
             }

           } else {
             // 従来のローカル MCP サーバー方式
             console.log(`[Agent] 🔗 Using local MCP server`);
             
             // 従来のローカルMCP処理（簡略化）
             try {
               // Notion MCP サーバー用の認証設定
               const openApiHeaders = JSON.stringify({
                 "Authorization": `Bearer ${notionTokens.accessToken}`,
                 "Notion-Version": "2022-06-28"
               });
               
               const userMcp = new MCPClient({
                 id: `notion-mcp-${userId}-${Date.now()}`,
                 servers: {
                   notion: {
                     command: "npx",
                     args: ["-y", "@notionhq/notion-mcp-server"],
                     env: {
                       OPENAPI_MCP_HEADERS: openApiHeaders
                     }
                   }
                 },
                 timeout: 60000
               });
               
               const allTools = await userMcp.getTools();
               
               // 必要なツールのみフィルタリング
               const essentialToolNames = [
                 'mcp_notionApi_API-post-search',
                 'mcp_notionApi_API-post-database-query',
                 'mcp_notionApi_API-retrieve-a-page',
                 'mcp_notionApi_API-retrieve-a-database',
                 'mcp_notionApi_API-get-block-children',
                 'mcp_notionApi_API-patch-page',
                 'mcp_notionApi_API-post-page'
               ];
               
               Object.entries(allTools).forEach(([toolName, toolDef]) => {
                 if (essentialToolNames.includes(toolName)) {
                   tools[toolName] = toolDef;
                 }
               });
               
               connectedServices.push('notion-local');
               console.log(`[Agent] 🎉 Loaded ${Object.keys(tools).length} tools from local MCP`);
               
             } catch (localError: any) {
               console.error(`[Agent] ❌ Local MCP also failed:`, localError);
             }
           }
          
        } else {
          console.log(`[Agent] ❌ No valid Notion tokens found for user ${userId}`);
          console.log(`[Agent] 🔍 Token state:`, {
            tokenExists: !!notionTokens,
            accessTokenExists: !!(notionTokens?.accessToken),
            rawTokenData: notionTokens
          });
        }
      } catch (tokenError: any) {
        console.error(`[Agent] ❌ Failed to load user tokens:`, tokenError);
        console.error(`[Agent] 🔍 TokenManager error details:`, {
          name: tokenError?.name || 'Unknown',
          message: tokenError?.message || 'Unknown error',
          stack: tokenError?.stack || 'No stack trace'
        });
      }
    } else {
      console.log(`[Agent] ⚠️ No userId provided, skipping MCP tool loading`);
    }
    
    if (Object.keys(tools).length === 0) {
      console.log("[Agent] No MCP tools available - user needs OAuth authentication");
    }
    
    // 接続されたサービスに基づいて指示を調整
    let serviceInstructions = "";
    if (connectedServices.length > 0) {
      serviceInstructions = "Notionツールを使用して検索・編集ができます。";
    } else if (userId) {
      serviceInstructions = "外部サービス未接続です。「/mcp」コマンドで連携してください。";
    }

    // Mastraの推奨パターンでエージェント作成（ドキュメント準拠）
    const agent = new Agent({
      name: "AI Assistant",
      description: "Notion情報検索アシスタント",
      instructions: `あなたはNotionの情報検索・管理アシスタントです。${serviceInstructions}
日本語で簡潔に応答し、検索結果は要約して提示してください。`,
      model: claudeModel,
      tools: tools  // Mastraドキュメント準拠：エージェント作成時にツールを渡す
    });
    
    const toolCount = Object.keys(tools).length;
    console.log(`[Agent] Created AI Assistant successfully with ${toolCount} tools`);
    
    // キャッシュに保存
    if (userId && toolCount > 0) {
      agentCache.set(userId, { agent, timestamp: Date.now() });
      console.log(`[Agent] 💾 Agent cached for user ${userId}`);
    }
    
    return agent;
  } catch (error) {
    console.error("[Agent] Failed to create AI Assistant:", error);
    
    // フォールバック：ツールなしのエージェントを返す
    return new Agent({
      name: "AI Assistant (Fallback)",
      description: "基本会話アシスタント",
      instructions: `現在、外部ツールへの接続に問題があるため、一般的な質問にのみお答えできます。`,
      model: claudeModel,
      tools: {}
    });
  }
}