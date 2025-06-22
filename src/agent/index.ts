import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import express from 'express';

// MCPクライアントの設定（後でNotionサーバーを追加）
const mcp = new MCPClient({
  servers: {
    // Notionサーバーは後で設定
  }
});

// Geminiモデルの設定
const geminiModel = google('gemini-1.5-flash');

// エージェントの作成
export const searchAgent = new Agent({
  name: 'SearchAgent',
  instructions: `
    あなたは情報検索専門のアシスタントです。
    ユーザーの質問に基づいて、利用可能なツールを使って情報を検索し、
    要約して分かりやすく回答してください。
    
    検索結果は以下の形式で返してください：
    1. 見つかった情報の要約
    2. 関連する詳細（最大3件）
    3. 情報源へのリンク（利用可能な場合）
    
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
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    // MCPツールを動的に取得
    const toolsets = await mcp.getToolsets();
    
    // エージェントでストリーミング応答を生成
    const response = await searchAgent.stream(message, {
      toolsets,
      threadId: threadId || 'default'
    });

    // ストリーミング応答を収集
    let fullResponse = '';
    for await (const chunk of response.textStream) {
      fullResponse += chunk;
    }

    res.json({ 
      response: fullResponse,
      threadId: threadId || 'default'
    });
  } catch (error) {
    console.error('Agent error:', error);
    res.status(500).json({ error: 'エージェント処理中にエラーが発生しました' });
  }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', agent: 'SearchAgent' });
});

// サーバー起動
const PORT = process.env.AGENT_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mastra Agent server running on port ${PORT}`);
});