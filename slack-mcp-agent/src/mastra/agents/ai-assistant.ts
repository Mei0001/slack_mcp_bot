import { Agent } from "@mastra/core/agent";
import { anthropic } from "@ai-sdk/anthropic";
import { getMCPTools, getMCPToolsets } from "../mcp";
import { validateMCPToolsForClaude } from "../tool-validator";
import { AuthenticatedMCPClient } from "../authenticated-mcp";
import { OAuthTokenManager } from "../../oauth/token-manager";

// エージェントをMCPツールと共に作成する関数
export async function createAIAssistant(userId?: string) {
  // Claudeモデルの設定（関数内で初期化してAPIキーを確実に取得）
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error("[Agent] ERROR: Anthropic API key not found!");
    console.error("[Agent] Please set ANTHROPIC_API_KEY");
    throw new Error("Anthropic API key is missing. Please set ANTHROPIC_API_KEY environment variable.");
  }
  
  const claudeModel = anthropic('claude-sonnet-4-20250514');
  try {
    // MCPツールを取得（Mastraの推奨パターン）
    let tools = {};
    let connectedServices: string[] = [];
    
    try {
      if (userId) {
        // ユーザー認証済みMCPクライアントを使用
        console.log(`[Agent] Creating authenticated MCP client for user ${userId}`);
        const tokenManager = new OAuthTokenManager();
        const authMCPClient = new AuthenticatedMCPClient({
          userId,
          tokenManager
        });
        
        const initialized = await authMCPClient.initialize();
        if (initialized) {
          const mcpClient = authMCPClient.getMCPClient();
          if (mcpClient) {
            const rawMCPTools = await mcpClient.getTools();
            connectedServices = await authMCPClient.getConnectedServices();
            
            if (Object.keys(rawMCPTools).length > 0) {
              console.log(`[Agent] Successfully loaded ${Object.keys(rawMCPTools).length} authenticated MCP tools for user ${userId}`);
              tools = validateMCPToolsForClaude(rawMCPTools);
              console.log(`[Agent] Validated ${Object.keys(tools).length} tools for Claude compatibility`);
            }
          }
        } else {
          console.log(`[Agent] No authenticated services for user ${userId}, falling back to default`);
        }
      }
      
      // フォールバック：ユーザー認証がない場合、デフォルトのMCPツールを使用
      if (Object.keys(tools).length === 0 && !userId) {
        const rawMCPTools = await getMCPTools();
        if (Object.keys(rawMCPTools).length > 0) {
          console.log(`[Agent] Successfully loaded ${Object.keys(rawMCPTools).length} default MCP tools`);
          tools = validateMCPToolsForClaude(rawMCPTools);
          console.log(`[Agent] Validated ${Object.keys(tools).length} tools for Claude compatibility`);
        }
      }
      
      if (Object.keys(tools).length === 0) {
        console.warn("[Agent] No MCP tools available, continuing without tools");
      }
    } catch (toolError) {
      console.error("[Agent] Failed to load MCP tools:", toolError);
      console.log("[Agent] Continuing without tools...");
    }
    
    // 接続されたサービスに基づいて指示を調整
    let serviceInstructions = "";
    if (connectedServices.length > 0) {
      const serviceNames = connectedServices.map(s => 
        s === 'notion' ? 'Notion' : 'Google Drive'
      ).join('と');
      serviceInstructions = `
        現在、このユーザーは${serviceNames}に接続しています。
        これらのサービスの情報を検索・編集することができます。
      `;
    } else if (userId) {
      serviceInstructions = `
        現在、このユーザーは外部サービスに接続していません。
        サービス連携が必要な場合は、「/mcp」コマンドを使用するよう案内してください。
      `;
    }

    // エージェントを作成（MCPツールを統合）
    const agent = new Agent({
      name: "AI Assistant",
      description: "NotionやGoogle Driveから情報を検索・管理する多機能AIアシスタント",
      instructions: `
        あなたは優秀なAIアシスタントです。
        ユーザーからの質問や依頼に対して、利用可能なツールを使って適切に応答してください。
        
        ${serviceInstructions}
        
        主な機能：
        1. Notionの検索：ページ、データベース、ユーザー情報の検索
        2. Notionの編集：ページの更新、データベースエントリの作成・編集
        3. 情報の要約と分析：検索結果を整理して分かりやすく提示
        
        応答のガイドライン：
        - 日本語で丁寧に応答してください
        - 検索結果は要約して分かりやすく提示してください
        - エラーが発生した場合は、分かりやすく説明してください
        - 具体的な操作を行う前に、何をするか説明してください
        - ツールが利用できない場合は、一般的な質問にお答えします
      `,
      model: claudeModel,
      tools: tools  // MCPツールを使用
    });
    
    const toolCount = Object.keys(tools).length;
    console.log(`[Agent] Created AI Assistant successfully with ${toolCount} tools`);
    
    return agent;
  } catch (error) {
    console.error("[Agent] Failed to create AI Assistant:", error);
    
    // フォールバック：ツールなしのエージェントを返す
    return new Agent({
      name: "AI Assistant (Fallback)",
      description: "基本的な会話機能のみのAIアシスタント",
      instructions: `
        あなたは親切なAIアシスタントです。
        現在、外部ツールへの接続に問題があるため、一般的な質問にのみお答えできます。
        日本語で丁寧に応答してください。
      `,
      model: claudeModel,
      tools: {}
    });
  }
}