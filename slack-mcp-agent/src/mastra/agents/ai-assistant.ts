import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { MCPClient } from "@mastra/mcp";
import { OAuthTokenManager } from "../../oauth/token-manager";
// import { createFileLogger } from "vibelogger";
import { getToolConfigForMessage } from "../tool-config";

// vibeloggerの初期化（一時的に無効化）
// const logger = createFileLogger("mastra_agent");

// エージェントキャッシュ（メモリ内、1時間有効）
const agentCache = new Map<string, { agent: Agent; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1時間

// エージェントをMCPツールと共に作成する関数（Mastraドキュメント準拠）
export async function createAIAssistant(userId?: string, message?: string) {
  // メッセージベースのキャッシュキーを生成（ツール設定が変わる可能性があるため）
  const toolConfigKey = message ? getToolConfigForMessage(message).essential.join(',') : 'default';
  const cacheKey = userId ? `${userId}-${toolConfigKey}` : 'default';
  
  // キャッシュチェック
  if (userId && !message) {  // メッセージがない場合のみキャッシュを使用
    const cached = agentCache.get(cacheKey);
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
    let tools = {};
    let connectedServices: string[] = [];
    
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
          console.log(`[Agent] 🔗 Creating MCPClient for https://mcp.notion.com/mcp`);
          
          // Notion MCP サーバー用の認証設定（デバッグ用詳細ログ付き）
          console.log(`[Agent] 🔑 Token details for MCP connection:`, {
            tokenPrefix: notionTokens.accessToken.substring(0, 10) + '...',
            tokenLength: notionTokens.accessToken.length,
            workspaceId: notionTokens.metadata?.workspace_id,
            workspaceName: notionTokens.metadata?.workspace_name
          });
          
          // 公式仕様に基づく正しい環境変数設定
          const openApiHeaders = JSON.stringify({
            "Authorization": `Bearer ${notionTokens.accessToken}`,
            "Notion-Version": "2022-06-28"
          });
          
          console.log(`[Agent] 🔐 Setting OPENAPI_MCP_HEADERS environment variable for MCP server`);
          console.log(`[Agent] 🔐 Token being passed to MCP server:`, {
            tokenExists: !!notionTokens.accessToken,
            tokenLength: notionTokens.accessToken.length,
            tokenPrefix: notionTokens.accessToken.substring(0, 15) + '...',
            tokenSuffix: '...' + notionTokens.accessToken.slice(-5),
            openApiHeadersLength: openApiHeaders.length,
            openApiHeadersPreview: openApiHeaders.substring(0, 50) + '...'
          });
          
          const userMcp = new MCPClient({
            id: `notion-mcp-${userId}-${Date.now()}`, // ユニークIDでMCPClient重複エラーを回避
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
          
          console.log(`[Agent] 🛠️ MCPClient created, attempting to get tools...`);
          
          try {
            // Mastraの推奨パターン：await mcp.getTools()
            const allTools = await userMcp.getTools();
            
            // レート制限を避けるため、必要なツールだけをフィルタリング
            // 参考: https://zenn.dev/nikechan/articles/b9b2d40129f736
            
            // メッセージに基づいて動的にツール設定を取得
            const toolConfig = message ? getToolConfigForMessage(message) : {
              essential: ['notion_API-post-search'],  // デフォルトは検索のみ
              optional: [],
              excluded: []
            };
            
            console.log(`[Agent] 📊 Dynamic tool config for message:`, {
              message: message?.substring(0, 50) || 'no message',
              essential: toolConfig.essential,
              excluded: toolConfig.excluded
            });
            
            // 除外ツールのSetを作成
            const excludedTools = new Set(toolConfig.excluded);
            
            // Zenn記事のパターンに従ってフィルタリング
            tools = Object.fromEntries(
              Object.entries(allTools)
                .filter(([toolName]) => {
                  // 必須ツールを優先
                  if (toolConfig.essential.includes(toolName)) {
                    return true;
                  }
                  // オプションツールも含める
                  if (toolConfig.optional.includes(toolName)) {
                    return true;
                  }
                  // 除外リストにあるものは除外
                  if (excludedTools.has(toolName)) {
                    return false;
                  }
                  // その他のツールは含めない（トークン削減のため）
                  return false;
                })
            );
            
            connectedServices.push('notion');
            
            console.log(`[Agent] 🎉 Filtered ${Object.keys(tools).length} essential tools from ${Object.keys(allTools).length} total MCP tools`);
            console.log(`[Agent] 📋 Active tools:`, Object.keys(tools));
            
            // vibeloggerでツールフィルタリングを記録（一時的に無効化）
            console.log(`[Agent] 📊 Tool filtering completed:`, {
              user_id: userId,
              message_hint: message?.substring(0, 50) || 'no message',
              total_tools: Object.keys(allTools).length,
              filtered_tools: Object.keys(tools).length,
              active_tools: Object.keys(tools),
              essential_tools: toolConfig.essential,
              optional_tools: toolConfig.optional,
              excluded_tools: toolConfig.excluded,
              excluded_count: Object.keys(allTools).length - Object.keys(tools).length
            });
            
            // 各ツールの詳細をログ出力
            Object.entries(tools).forEach(([toolName, toolDef]) => {
              console.log(`[Agent] 🔧 Tool "${toolName}":`, {
                description: (toolDef as any)?.description?.substring(0, 50) + '...' || 'No description',
                hasExecute: typeof (toolDef as any)?.execute === 'function'
              });
            });
            
          } catch (toolsError: any) {
            console.error(`[Agent] ❌ Failed to get MCP tools:`, toolsError);
            console.error(`[Agent] 🔍 Error details:`, {
              name: toolsError?.name || 'Unknown',
              message: toolsError?.message || 'Unknown error',
              stack: toolsError?.stack || 'No stack trace'
            });
            
            // vibeloggerでMCPツール取得エラーを記録（一時的に無効化）
            console.error(`[Agent] 🚨 MCP tools load error:`, {
              user_id: userId,
              error_name: toolsError?.name || 'Unknown',
              error_message: toolsError?.message || 'Unknown error',
              has_stack: !!toolsError?.stack
            });
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
    
    // キャッシュに保存（メッセージがない場合のみ）
    if (userId && toolCount > 0 && !message) {
      agentCache.set(cacheKey, { agent, timestamp: Date.now() });
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