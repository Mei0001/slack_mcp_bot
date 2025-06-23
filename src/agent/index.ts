import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import express from 'express';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 環境変数の確認
console.log('Environment check:');
console.log('- NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'Set' : 'Not set');
console.log('- GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY ? 'Set' : 'Not set');

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
console.log('Initializing Gemini model...');
const geminiModel = google('gemini-1.5-flash', {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
});
console.log('Gemini model initialized');

// エージェントの作成
export const searchAgent = new Agent({
  name: 'SearchAgent',
  instructions: `
    あなたはNotionから情報を検索する専門のアシスタントです。
    ユーザーの質問に基づいて、利用可能なMCPツールを使って情報を検索し、
    要約して分かりやすく回答してください。
    
    検索結果は以下の形式で返してください：
    📋 検索結果：
    [見つかった情報の要約]
    
    📌 詳細情報：
    [最大3件の関連情報]
    
    🔗 参考リンク：
    [利用可能な場合]
    
    検索結果が見つからない場合は、その旨を伝え、検索キーワードの提案をしてください。
    日本語で応答してください。
  `,
  model: geminiModel,
  tools: {} // MCPツールは後で動的に追加
});

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

    // 最初はツール無しでテスト
    console.log('Generating response with agent (no tools)...');
    
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
      throw generateError;
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

// シンプルなテストエンドポイント
app.post('/api/test', async (req, res) => {
  try {
    console.log('Test endpoint called');
    const result = await searchAgent.generate('こんにちは！元気ですか？');
    console.log('Test result:', result.text);
    res.json({ response: result.text });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCPクライアントの初期化とサーバー起動
async function startServer() {
  try {
    // 利用可能なツールを確認（MCPClientは自動的に接続を管理）
    console.log('Getting MCP tools...');
    const tools = await mcp.getTools();
    console.log('Available MCP tools:', Object.keys(tools));
    
    // サーバー起動
    const PORT = process.env.AGENT_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Mastra Agent server running on port ${PORT}`);
      console.log('MCP integration ready');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
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