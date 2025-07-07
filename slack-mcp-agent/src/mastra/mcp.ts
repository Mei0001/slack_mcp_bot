import { MCPClient } from "@mastra/mcp";

// レガシーMCPクライアント（非認証）- 現在は使用しない
// OAuth 2.0実装により、AuthenticatedMCPClientを使用
export const mcp = new MCPClient({
  servers: {
    // 注意: このクライアントは認証なしでの接続のため現在無効化
    // OAuth 2.0トークンを使用する場合はAuthenticatedMCPClientを使用
    // notion: {
    //   "type": "http", 
    //   "url": "https://mcp.notion.com/mcp"
    // }
  },
  timeout: 60000 // グローバルタイムアウト
});

// レガシーMCPツールを取得する関数（非認証・現在は使用しない）
export async function getMCPTools() {
  console.warn("[MCP] getMCPTools() is deprecated. Use AuthenticatedMCPClient instead for OAuth 2.0 support.");
  console.log("[MCP] No default MCP servers configured for security reasons.");
  return {};
}

// レガシーMCPツールセットを取得する関数（非認証・現在は使用しない）
export async function getMCPToolsets() {
  console.warn("[MCP] getMCPToolsets() is deprecated. Use AuthenticatedMCPClient instead for OAuth 2.0 support.");
  return {};
}

// レガシーMCPリソースを取得する関数（非認証・現在は使用しない）
export async function getMCPResources() {
  console.warn("[MCP] getMCPResources() is deprecated. Use AuthenticatedMCPClient instead for OAuth 2.0 support.");
  return {};
}