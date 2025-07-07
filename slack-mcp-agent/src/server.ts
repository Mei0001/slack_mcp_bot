import express from 'express';
import dotenv from 'dotenv';
import { getAIAssistant } from './mastra/index';
// import { getMCPToolsets } from './mastra/mcp'; // 非推奨：AuthenticatedMCPClientを使用

// .envファイルを読み込む
dotenv.config();

const app = express();
app.use(express.json());

// 環境変数の確認
const PORT = process.env.AGENT_PORT || 3001;

// AIエージェント用変数
let agent: any = null;

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Mastra AI Assistant',
    timestamp: new Date().toISOString()
  });
});

// エージェント検索エンドポイント
app.post('/api/agent/search', async (req, res) => {
  try {
    const { message, threadId, context, userId } = req.body;
    
    console.log(`[Server] 📥 Received search request from user ${userId}: ${message?.substring(0, 50)}...`);
    console.log(`[Server] 📊 Request details:`, {
      hasMessage: !!message,
      hasThreadId: !!threadId,
      hasContext: !!context,
      hasUserId: !!userId,
      messageLength: message?.length || 0
    });
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    // ユーザーごとにエージェントを初期化（認証済みMCPツールを使用）
    console.log(`[Server] 🤖 Initializing AI Assistant for user ${userId}...`);
    const userAgent = await getAIAssistant(userId);
    
    // エージェントの状態をログ出力
    const agentTools = await userAgent.getTools();
    console.log(`[Server] 🔧 Agent initialized with ${Object.keys(agentTools).length} tools`);
    console.log(`[Server] 📋 Available agent tools:`, Object.keys(agentTools));

    // メッセージにコンテキストがある場合は結合
    let fullMessage = message;
    if (context) {
      fullMessage = `過去の会話:\n${context}\n\n現在の質問: ${message}`;
    }

    console.log('[Server] 🎯 Generating response with AI Assistant...');
    console.log(`[Server] 📝 Full message to process: ${fullMessage.substring(0, 100)}...`);
    
    let result;
    try {
      // ユーザー認証済みエージェントでレスポンス生成
      console.log('[Server] 🚀 Generating response with user-authenticated agent...');
      
      const generationOptions = {
        threadId: threadId || 'default'
      };
      console.log(`[Server] 🔧 Generation options:`, generationOptions);
      
      result = await userAgent.generate(fullMessage, generationOptions);
      
      console.log(`[Server] 📤 Generation completed:`, {
        hasResult: !!result,
        hasText: !!(result?.text),
        textLength: result?.text?.length || 0,
        hasToolCalls: !!(result?.toolCalls),
        toolCallsCount: result?.toolCalls?.length || 0
      });

      const response = result.text || 'すみません、応答の生成に失敗しました。';
      
      console.log(`[Server] Response generated: ${response.length} characters`);
      
      res.json({ 
        response,
        threadId: threadId || 'default',
        timestamp: new Date().toISOString()
      });
      
    } catch (generateError: any) {
      console.error('[Server] Generation error:', generateError);
      console.error('[Server] Error details:', {
        message: generateError.message,
        stack: generateError.stack,
        name: generateError.name,
        cause: generateError.cause
      });
      
      // MCPツールエラーの場合はフォールバックエージェントで再試行
      if (generateError.message?.includes('tool') || generateError.message?.includes('mcp')) {
        console.log('[Server] MCP tool error detected, trying with fallback agent...');
        try {
          const fallbackAgent = await getAIAssistant(); // ユーザーIDなしでフォールバック
          const fallbackResult = await fallbackAgent.generate(fullMessage, {
            threadId: threadId || 'default'
          });
          
          const fallbackResponse = fallbackResult.text || 'すみません、応答の生成に失敗しました。';
          console.log(`[Server] Fallback response: ${fallbackResponse.length} chars`);
          
          res.json({ 
            response: fallbackResponse,
            threadId: threadId || 'default',
            warning: 'MCPツールが一時的に利用できません。OAuth認証を確認してください。'
          });
        } catch (fallbackError) {
          console.error('[Server] Fallback also failed:', fallbackError);
          throw generateError;
        }
      } else {
        throw generateError;
      }
    }
    
  } catch (error: any) {
    console.error('[Server] Agent error:', error);
    res.status(500).json({ 
      error: 'エージェント処理中にエラーが発生しました',
      details: error.message || 'Unknown error'
    });
  }
});

// サーバー起動
async function startServer() {
  try {
    // エージェントの事前初期化
    console.log('[Server] Pre-initializing AI Assistant...');
    agent = await getAIAssistant();
    console.log('[Server] AI Assistant pre-initialized successfully');
    
    // HTTPサーバー起動
    app.listen(PORT, () => {
      console.log(`✅ Mastra AI Assistant server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🤖 Agent endpoint: http://localhost:${PORT}/api/agent/search`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// サーバー起動
startServer();