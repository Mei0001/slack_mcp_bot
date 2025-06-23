import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Geminiモデルの設定
const model = google('gemini-1.5-flash');

// 検索結果を整形するツール
const formatSearchResults = createTool({
  id: 'format-search-results',
  description: '検索結果を見やすく整形します',
  inputSchema: z.object({
    results: z.array(z.any()),
    query: z.string()
  }),
  outputSchema: z.object({
    formatted: z.string()
  }),
  execute: async ({ context }) => {
    const { results, query } = context;
    
    if (!results || results.length === 0) {
      return { formatted: `「${query}」に関する情報は見つかりませんでした。` };
    }
    
    // 結果を整形（最大3件）
    const topResults = results.slice(0, 3);
    const formatted = topResults.map((result: any, index: number) => {
      return `${index + 1}. ${result.title || 'タイトルなし'}\n   ${result.content || result.description || '内容なし'}`;
    }).join('\n\n');
    
    return { formatted };
  }
});

// MCPエージェントの作成
export const mcpAgent = new Agent({
  name: 'MCP Agent',
  instructions: `あなたはNotionやGoogle Driveから情報を検索する専門のアシスタントです。
  
  以下のガイドラインに従って応答してください：
  1. ユーザーの質問を理解し、適切なMCPツールを使用して情報を検索します
  2. 検索結果を分かりやすく要約して提示します
  3. 見つかった情報源へのリンクがある場合は提供します
  4. 日本語で丁寧に応答します
  5. 検索結果が見つからない場合は、その旨を伝え、検索キーワードの提案をします
  
  応答形式：
  📋 検索結果：
  [要約された内容]
  
  📌 詳細情報：
  [最大3件の関連情報]
  
  🔗 参考リンク：
  [利用可能な場合]`,
  model,
  tools: {
    formatSearchResults
  }
});