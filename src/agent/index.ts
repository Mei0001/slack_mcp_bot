import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import express from 'express';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 環境変数の確認
if (!process.env.NOTION_API_KEY) {
  console.warn('Warning: NOTION_API_KEY not set');
}
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error('Error: Neither GOOGLE_GENERATIVE_AI_API_KEY nor GEMINI_API_KEY is set');
  process.exit(1);
}

// MCPクライアントの設定
const mcp = new MCPClient({
  servers: {
    notionApi: {
      command: "npx",
      args: ["-y", "@notionhq/notion-mcp-server"],
      env: {
        "OPENAPI_MCP_HEADERS": JSON.stringify({
          "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
          "Notion-Version": "2022-06-28"
        })
      }
    }
  }
});

// Geminiの環境変数を設定
if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

// Geminiモデルの設定
const geminiModel = google('gemini-1.5-flash', {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
});

// エージェント変数（グローバルスコープで宣言）
let searchAgent: Agent;

// ツールスキーマを検証する関数
function validateToolSchema(tool: any): boolean {
  try {
    if (!tool.function || !tool.function.parameters) {
      return false;
    }
    
    const params = tool.function.parameters;
    const required = params.required || [];
    const properties = params.properties || {};
    
    // required配列内のすべてのプロパティがpropertiesで定義されているかチェック
    for (const requiredProp of required) {
      if (!properties[requiredProp]) {
        console.warn(`Invalid tool schema: required property '${requiredProp}' not defined in properties`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.warn('Tool schema validation error:', error);
    return false;
  }
}

// MCPツールをフィルタリングする関数
function filterValidMCPTools(mcpTools: any): any {
  const validTools: any = {};
  
  for (const [toolName, tool] of Object.entries(mcpTools)) {
    if (validateToolSchema(tool)) {
      validTools[toolName] = tool;
    } else {
      console.warn(`Skipping invalid tool: ${toolName}`);
    }
  }
  
  return validTools;
}

// エージェントをMCPツールと共に非同期で作成
async function createAgentWithMCPTools(): Promise<Agent> {
  console.log('Creating agent with MCP tools...');
  
  try {
    // MCPツールを取得
    const allMcpTools = await mcp.getTools();
    console.log(`All MCP tools loaded: ${Object.keys(allMcpTools).length} tools`);
    
    // 有効なツールのみフィルタリング
    const validMcpTools = filterValidMCPTools(allMcpTools);
    console.log(`Valid MCP tools: ${Object.keys(validMcpTools).length} tools`);
    console.log('Valid tool names:', Object.keys(validMcpTools));
    
    // 安全なツールのみを選択
    const selectedTools: any = {};
    const safeToolNames = [
      'notionApi_API-post-search',
      'notionApi_API-get-users',
      'notionApi_API-get-self'
    ];
    
    for (const toolName of safeToolNames) {
      if (validMcpTools[toolName]) {
        selectedTools[toolName] = validMcpTools[toolName];
      }
    }
    
    console.log(`Selected ${Object.keys(selectedTools).length} safe tools for agent`);
    
    // エージェントを作成
    const agent = new Agent({
      name: 'SearchAgent',
      instructions: `
        あなたは有能なAIアシスタントです。
        ユーザーからの質問や送信されたメッセージに対して丁寧に返信してください
        日本語で応答してください。
      `,
      model: geminiModel,
      tools: selectedTools
    });
    
    console.log('Agent created successfully with MCP tools');
    return agent;
  } catch (error) {
    console.error('Failed to create agent with MCP tools:', error);
    return createFallbackAgent();
  }
}

// フォールバックエージェントを作成
function createFallbackAgent(): Agent {
  console.log('Creating fallback agent without MCP tools...');
  return new Agent({
    name: 'FallbackAgent',
    instructions: `
      あなたは親切なアシスタントです。
      現在Notionツールが利用できませんが、一般的な質問にお答えします。
      Notionについて質問された場合は、
      「現在Notionツールに技術的な問題があります。しばらく後でもう一度お試しください。」
      と回答してください。
      日本語で応答してください。
    `,
    model: geminiModel,
    tools: {}
  });
}

// Expressサーバーの設定
const app = express();
app.use(express.json());

// エージェントのエンドポイント
app.post('/api/agent/search', async (req, res) => {
  try {
    const { message, threadId } = req.body;
    console.log(`Received request: ${message?.substring(0, 50)}...`);
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    // エージェントが初期化されていない場合はエラー
    if (!searchAgent) {
      return res.status(500).json({ error: 'エージェントが初期化されていません' });
    }

    console.log('Generating response with agent...');
    
    try {
      const result = await searchAgent.generate(message, {
        threadId: threadId || 'default'
      });

      const fullResponse = result.text || 'すみません、応答の生成に失敗しました。';
      
      console.log(`Response generated: ${fullResponse.length} characters`);
      res.json({ 
        response: fullResponse,
        threadId: threadId || 'default'
      });
    } catch (generateError) {
      console.error('Generate error:', generateError);
      
      // MCPツールエラーの場合はフォールバックエージェントで再試行
      if (generateError.message && generateError.message.includes('function_declarations')) {
        console.log('MCP tool error detected, using fallback agent...');
        try {
          const fallbackAgent = createFallbackAgent();
          const fallbackResult = await fallbackAgent.generate(message, {
            threadId: threadId || 'default'
          });
          
          const fallbackResponse = fallbackResult.text || 'すみません、応答の生成に失敗しました。';
          console.log(`Fallback response: ${fallbackResponse.length} chars`);
          
          res.json({ 
            response: fallbackResponse,
            threadId: threadId || 'default'
          });
        } catch (fallbackError) {
          console.error('Fallback agent failed:', fallbackError);
          throw generateError;
        }
      } else {
        throw generateError;
      }
    }
  } catch (error) {
    console.error('Agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'エージェント処理中にエラーが発生しました',
      details: errorMessage
    });
  }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'SearchAgent' });
});


// MCPクライアントの初期化とサーバー起動
async function startServer() {
  try {
    // エージェントを作成（MCP接続テストも含む）
    searchAgent = await createAgentWithMCPTools();
    console.log('Agent initialized successfully');
    
    // サーバー起動
    const PORT = process.env.AGENT_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`✅ Mastra Agent server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});

// サーバー起動
startServer();