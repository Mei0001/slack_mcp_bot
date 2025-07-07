import { MCPClient } from "@mastra/mcp";

// MCPクライアントの設定（複数のサーバーをサポート）
export const mcp = new MCPClient({
  servers: {
    // Notion MCP Server
      notion: {
        "type": "http",
        "url": "https://mcp.notion.com/mcp"
      }
  },
    // 将来的にGoogle Drive MCPサーバーを追加
    // googleDrive: {
    //   command: "npx",
    //   args: ["-y", "@google/drive-mcp-server"],
    //   env: {
    //     "GOOGLE_CLIENT_ID": process.env.GOOGLE_CLIENT_ID,
    //     "GOOGLE_CLIENT_SECRET": process.env.GOOGLE_CLIENT_SECRET,
    //     "GOOGLE_REFRESH_TOKEN": process.env.GOOGLE_REFRESH_TOKEN
    //   },
    //   timeout: 30000
    // }
  
  timeout: 60000 // グローバルタイムアウト
});

// MCPツールを取得する関数（Mastraの推奨パターン）
export async function getMCPTools() {
  try {
    console.log("[MCP] Loading tools from MCP servers...");
    const tools = await mcp.getTools();
    console.log(`[MCP] Loaded ${Object.keys(tools).length} tools from all servers`);
    
    // ツール名を表示
    Object.keys(tools).forEach(toolName => {
      console.log(`[MCP] Available tool: ${toolName}`);
    });
    
    return tools;
  } catch (error) {
    console.error("[MCP] Failed to load tools:", error);
    return {};
  }
}

// MCPツールセットを取得する関数（Mastraの推奨パターン）
export async function getMCPToolsets() {
  try {
    console.log("[MCP] Loading toolsets from MCP servers...");
    const toolsets = await mcp.getToolsets();
    console.log(`[MCP] Loaded toolsets for ${Object.keys(toolsets).length} servers`);
    
    // サーバー名を表示
    Object.keys(toolsets).forEach(serverName => {
      const serverTools = toolsets[serverName];
      console.log(`[MCP] Server "${serverName}" has ${Object.keys(serverTools).length} tools`);
    });
    
    return toolsets;
  } catch (error) {
    console.error("[MCP] Failed to load toolsets:", error);
    return {};
  }
}

// MCPリソースを取得する関数
export async function getMCPResources() {
  try {
    console.log("[MCP] Loading resources from MCP servers...");
    const resources = await mcp.getResources();
    console.log(`[MCP] Loaded resources from ${Object.keys(resources).length} servers`);
    return resources;
  } catch (error) {
    console.error("[MCP] Failed to load resources:", error);
    return {};
  }
}