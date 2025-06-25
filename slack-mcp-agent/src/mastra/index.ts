import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import dotenv from 'dotenv';
import { createAIAssistant } from './agents/ai-assistant';
import { mcp } from './mcp';

// .envファイルを読み込む
dotenv.config();

// 環境変数の確認
if (!process.env.NOTION_API_KEY) {
  console.warn('Warning: NOTION_API_KEY not set');
}
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.error('Error: Neither GOOGLE_GENERATIVE_AI_API_KEY nor GEMINI_API_KEY is set');
}

// エージェントの作成（非同期）
let aiAssistant: any = null;

async function initializeAgent() {
  try {
    aiAssistant = await createAIAssistant();
    console.log('[Mastra] AI Assistant initialized successfully');
  } catch (error) {
    console.error('[Mastra] Failed to initialize AI Assistant:', error);
  }
}

// エージェントを初期化
await initializeAgent();

export const mastra = new Mastra({
  agents: aiAssistant ? { aiAssistant } : {},
  storage: new LibSQLStore({
    // メモリ内ストレージ（永続化が必要な場合は file:../mastra.db に変更）
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'SlackMCPAgent',
    level: 'info',
  }),
});

// エージェントへのアクセス用エクスポート
export async function getAIAssistant() {
  if (!aiAssistant) {
    aiAssistant = await createAIAssistant();
  }
  return aiAssistant;
}