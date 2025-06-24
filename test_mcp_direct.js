#!/usr/bin/env node
/**
 * MCP Server Direct Connection Test
 * 
 * このファイルはMCPサーバーの接続とツール取得をテストするためのユーティリティです。
 * Slackボットの問題をトラブルシューティングする際に使用してください。
 * 
 * 使用方法: node test_mcp_direct.js
 */

import { MCPClient } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import dotenv from 'dotenv';

dotenv.config();

// Geminiの環境変数を設定
if (process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

console.log('=== MCP Direct Test ===');

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

// Geminiモデルの設定
const geminiModel = google('gemini-1.5-flash', {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
});

async function testMCPConnection() {
  try {
    console.log('\n1. Testing MCP server connection...');
    
    // MCPツールを取得
    const tools = await mcp.getTools();
    console.log(`✓ MCP tools loaded: ${Object.keys(tools).length} tools`);
    console.log('Available tools:', Object.keys(tools).slice(0, 5).join(', '), '...');
    
    return tools;
  } catch (error) {
    console.error('✗ MCP connection failed:', error.message);
    return null;
  }
}

async function testNotionSearch(tools) {
  try {
    console.log('\n2. Testing Notion search tool directly...');
    
    // Notionの検索ツールを直接テスト
    const searchTool = tools['notionApi_API-post-search'];
    if (!searchTool) {
      console.error('✗ Search tool not found');
      return false;
    }
    
    console.log('✓ Search tool found');
    console.log('Tool schema:', JSON.stringify(searchTool.function?.parameters, null, 2));
    
    return true;
  } catch (error) {
    console.error('✗ Tool test failed:', error.message);
    return false;
  }
}

async function testAgentWithMCPTools(tools) {
  try {
    console.log('\n3. Testing agent with MCP tools...');
    
    // エージェントを作成（1つのツールのみでテスト）
    const selectedTools = {};
    if (tools['notionApi_API-post-search']) {
      selectedTools['notionApi_API-post-search'] = tools['notionApi_API-post-search'];
    }
    
    console.log(`Using ${Object.keys(selectedTools).length} tools for agent`);
    
    const agent = new Agent({
      name: 'TestAgent',
      instructions: `
        あなたはNotionから情報を検索するテストエージェントです。
        利用可能なツールを使って質問に答えてください。
        日本語で応答してください。
      `,
      model: geminiModel,
      tools: selectedTools
    });
    
    console.log('✓ Agent created successfully');
    
    // 簡単なテスト
    console.log('\n4. Testing agent response...');
    const result = await agent.generate('Notionでプロジェクトに関する情報を検索してください');
    
    console.log('✓ Agent response generated');
    console.log('Response length:', result.text?.length || 0);
    console.log('Response preview:', result.text?.substring(0, 200) + '...');
    
    return true;
  } catch (error) {
    console.error('✗ Agent test failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

async function testAgentWithoutTools() {
  try {
    console.log('\n5. Testing agent without tools (fallback)...');
    
    const agent = new Agent({
      name: 'FallbackAgent',
      instructions: `
        あなたは親切なアシスタントです。
        現在ツールは利用できませんが、質問にお答えします。
        日本語で応答してください。
      `,
      model: geminiModel,
      tools: {}
    });
    
    const result = await agent.generate('こんにちは、調子はどうですか？');
    
    console.log('✓ Fallback agent works');
    console.log('Response:', result.text?.substring(0, 100) + '...');
    
    return true;
  } catch (error) {
    console.error('✗ Fallback agent failed:', error.message);
    return false;
  }
}

// メイン実行
async function main() {
  try {
    console.log('Environment check:');
    console.log('- NOTION_API_KEY:', process.env.NOTION_API_KEY ? 'Set' : 'Not set');
    console.log('- GOOGLE_GENERATIVE_AI_API_KEY:', process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 'Set' : 'Not set');
    
    // MCP接続テスト
    const tools = await testMCPConnection();
    
    if (tools) {
      // Notionツールテスト
      await testNotionSearch(tools);
      
      // エージェントテスト
      await testAgentWithMCPTools(tools);
    }
    
    // フォールバックテスト
    await testAgentWithoutTools();
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

main();