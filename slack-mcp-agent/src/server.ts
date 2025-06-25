import express from 'express';
import dotenv from 'dotenv';
import { getAIAssistant } from './mastra/index';
import { getMCPToolsets } from './mastra/mcp';

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
    const { message, threadId, context } = req.body;
    
    console.log(`[Server] Received search request: ${message?.substring(0, 50)}...`);
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    // エージェントが未初期化の場合は取得
    if (!agent) {
      console.log('[Server] Initializing AI Assistant...');
      agent = await getAIAssistant();
    }

    // メッセージにコンテキストがある場合は結合
    let fullMessage = message;
    if (context) {
      fullMessage = `過去の会話:\n${context}\n\n現在の質問: ${message}`;
    }

    console.log('[Server] Generating response with AI Assistant...');
    
    let result;
    try {
      // 動的なMCPツールセットを取得してエージェントで使用
      try {
        const { getMCPToolsets } = await import('./mastra/mcp');
        const toolsets = await getMCPToolsets();
        
        // エージェントでレスポンスを生成（動的ツールセット使用）
        result = await agent.generate(fullMessage, {
          threadId: threadId || 'default',
          toolsets: Object.keys(toolsets).length > 0 ? toolsets : undefined
        });
        
        console.log(`[Server] Used ${Object.keys(toolsets).length} toolsets`);
      } catch (toolsetError) {
        console.warn('[Server] Toolsets unavailable, using static tools:', toolsetError);
        
        // フォールバック：静的ツールで実行
        result = await agent.generate(fullMessage, {
          threadId: threadId || 'default'
        });
      }

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
      
      // MCPツールエラーの場合はツールなしで再試行
      if (generateError.message?.includes('tool') || generateError.message?.includes('mcp')) {
        console.log('[Server] MCP tool error detected, retrying without tools...');
        try {
          const fallbackResult = await agent.generate(fullMessage, {
            threadId: threadId || 'default'
          });
          
          const fallbackResponse = fallbackResult.text || 'すみません、応答の生成に失敗しました。';
          console.log(`[Server] Fallback response: ${fallbackResponse.length} chars`);
          
          res.json({ 
            response: fallbackResponse,
            threadId: threadId || 'default',
            warning: 'MCPツールが一時的に利用できません'
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