import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import express from 'express';
import dotenv from 'dotenv';
import open from 'open';
import path from 'path';
import { NotionOAuthManager } from '../notion_oauth_manager.js';

// 環境変数の読み込み（プロジェクトルートの.envファイルを絶対パスで指定）
const envPath = path.resolve(process.cwd(), '.env');
console.log('🔍 Loading .env from:', envPath);
dotenv.config({ path: envPath });

// デバッグ用：APIキーの存在確認
console.log('🔍 Environment check:');
console.log('  GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('  GOOGLE_GENERATIVE_AI_API_KEY exists:', !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
if (process.env.GEMINI_API_KEY) {
  console.log('  GEMINI_API_KEY preview:', process.env.GEMINI_API_KEY.substring(0, 15) + '...');
}

// 環境変数の確認
if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error('Error: Neither GEMINI_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY is set');
  process.exit(1);
}

if (!process.env.TOKEN_ENCRYPTION_KEY) {
  console.error('Error: TOKEN_ENCRYPTION_KEY is required for multi-tenant OAuth');
  process.exit(1);
}

// Notion公式OAuth管理
const oauthManager = new NotionOAuthManager('./data/oauth', 'http://localhost:3001/oauth/callback');

// Geminiプロバイダーとモデルの設定 - APIキーを直接指定
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
});
const geminiModel = google('gemini-1.5-flash');

// エージェントのキャッシュ（ユーザー別）
const agents: Map<string, Agent> = new Map();

// Slack Web API設定
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// Slack通知機能
async function notifySlackAuthCompletion(slackUserId: string, accountId: string) {
  try {
    if (!SLACK_BOT_TOKEN) {
      console.warn('SLACK_BOT_TOKEN not found, skipping Slack notification');
      return;
    }

    // アカウント情報を取得
    const account = await oauthManager.getAccount(slackUserId, accountId);
    
    if (!account) {
      console.warn(`Account ${accountId} not found for user ${slackUserId}`);
      return;
    }

    const message = {
      channel: slackUserId, // ユーザーのDM
      text: `🎉 *Notion認証が完了しました！*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 Notion認証完了",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ *${account.name}* が正常に追加されました！\\n🏢 ワークスペース: ${account.workspace}\\n📧 アカウント: ${account.email}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*💡 次のステップ:*\\n• `/mcp` で状態を確認\\n• 「検索 [クエリ]」でNotionツールをテスト\\n• 「work:検索クエリ」でアカウント指定検索"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "🔧 MCP状態確認",
                emoji: true
              },
              style: "primary",
              action_id: "mcp_refresh_status",
              value: slackUserId
            }
          ]
        }
      ]
    };

    // Slack Web APIにPOSTリクエスト送信
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const result = await response.json() as any;
    
    if (result.ok) {
      console.log(`✅ Slack notification sent to user ${slackUserId}`);
    } else {
      console.error(`❌ Failed to send Slack notification: ${result.error}`);
    }

  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

// Notion API直接呼び出し用のヘルパー関数
async function callNotionAPI(endpoint: string, options: any, accessToken: string): Promise<any> {
  const url = `https://api.notion.com/v1${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} ${error}`);
  }

  return await response.json();
}

// Notion検索機能
async function searchNotionPages(query: string, accessToken: string): Promise<any> {
  return await callNotionAPI('/search', {
    method: 'POST',
    body: JSON.stringify({
      query: query,
      page_size: 10,
    }),
  }, accessToken);
}

// Notionページ取得
async function getNotionPage(pageId: string, accessToken: string): Promise<any> {
  return await callNotionAPI(`/pages/${pageId}`, {
    method: 'GET',
  }, accessToken);
}

// Notionデータベース検索
async function queryNotionDatabase(databaseId: string, filter: any, accessToken: string): Promise<any> {
  return await callNotionAPI(`/databases/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify(filter),
  }, accessToken);
}

// スマートアカウント選択機能
async function selectAccountForMessage(slackUserId: string, message: string): Promise<{ accountId: string | null; query: string; confidence: number; reason: string }> {
  const accounts = await oauthManager.listAccounts(slackUserId);
  if (accounts.length === 0) {
    return { accountId: null, query: message, confidence: 0, reason: 'no_accounts' };
  }

  // 明示的なアカウント指定をチェック（work:、personal:など）
  const patterns = [
    /^(\w+):\s*(.+)$/,           // "work:クエリ"
    /^@(\w+)\s+(.+)$/,          // "@work クエリ"
    /^\[(\w+)\]\s*(.+)$/        // "[work] クエリ"
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      const accountRef = match[1].toLowerCase();
      const query = match[2];
      
      // アカウント名での検索
      for (const account of accounts) {
        if (account.name.toLowerCase().includes(accountRef) || 
            account.workspace.toLowerCase().includes(accountRef)) {
          return { accountId: account.id, query, confidence: 1.0, reason: 'explicit_reference' };
        }
      }
      
      // work/personalキーワード
      if (accountRef === 'work' || accountRef === 'company') {
        const workKeywords = ['work', 'company', 'job', '仕事', '会社', '業務'];
        const workAccount = accounts.find(acc => 
          workKeywords.some(kw => 
            acc.name.toLowerCase().includes(kw.toLowerCase()) || 
            acc.workspace.toLowerCase().includes(kw.toLowerCase())
          )
        );
        if (workAccount) {
          return { accountId: workAccount.id, query, confidence: 0.9, reason: 'work_keyword' };
        }
      }
      
      if (accountRef === 'personal' || accountRef === 'private') {
        const personalKeywords = ['personal', 'private', '個人', 'プライベート'];
        const personalAccount = accounts.find(acc => 
          personalKeywords.some(kw => 
            acc.name.toLowerCase().includes(kw.toLowerCase()) || 
            acc.workspace.toLowerCase().includes(kw.toLowerCase())
          )
        );
        if (personalAccount) {
          return { accountId: personalAccount.id, query, confidence: 0.9, reason: 'personal_keyword' };
        }
      }
    }
  }
  
  // キーワードベースの自動選択
  const lowerMessage = message.toLowerCase();
  const workKeywords = ['work', 'company', 'job', '仕事', '会社', '業務', 'meeting', 'project'];
  const personalKeywords = ['personal', 'private', '個人', 'プライベート'];
  
  // 仕事関連キーワード
  for (const keyword of workKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      const workAccount = accounts.find(acc => 
        workKeywords.some(kw => 
          acc.name.toLowerCase().includes(kw.toLowerCase()) || 
          acc.workspace.toLowerCase().includes(kw.toLowerCase())
        )
      );
      if (workAccount) {
        return { accountId: workAccount.id, query: message, confidence: 0.7, reason: 'work_content' };
      }
    }
  }
  
  // 個人関連キーワード
  for (const keyword of personalKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      const personalAccount = accounts.find(acc => 
        personalKeywords.some(kw => 
          acc.name.toLowerCase().includes(kw.toLowerCase()) || 
          acc.workspace.toLowerCase().includes(kw.toLowerCase())
        )
      );
      if (personalAccount) {
        return { accountId: personalAccount.id, query: message, confidence: 0.7, reason: 'personal_content' };
      }
    }
  }
  
  // デフォルト（アクティブアカウント）
  const activeAccount = accounts.find(acc => acc.isActive);
  return { 
    accountId: activeAccount?.id || accounts[0]?.id || null, 
    query: message, 
    confidence: 0.3, 
    reason: 'default_active' 
  };
}

// ユーザー用のエージェントを取得または作成
async function getAgentForUser(slackUserId: string): Promise<Agent> {
  const accessToken = await oauthManager.getActiveToken(slackUserId);
  
  if (!accessToken) {
    // 認証されていないユーザー用のフォールバックエージェント
    if (!agents.has(`${slackUserId}:fallback`)) {
      const fallbackAgent = new Agent({
        name: 'UnauthenticatedAgent',
        instructions: `
          あなたは親切なアシスタントです。
          現在Notion OAuth認証が完了していないため、Notionの機能は利用できません。
          
          利用可能なコマンド:
          - 「アカウント追加」: 新しいNotionアカウントを追加
          - 「アカウント一覧」: 登録済みアカウントの表示
          - 「help」: ヘルプの表示
          - 「/mcp」: MCP管理画面（Slashコマンド）
          
          認証を開始するには以下の方法があります:
          1. 「アカウント追加」と送信
          2. 「/mcp auth」Slashコマンドを実行
          3. 「/mcp」で管理画面を開いて認証ボタンをクリック
          
          日本語で応答してください。
        `,
        model: geminiModel,
        tools: {}
      });
      
      agents.set(`${slackUserId}:fallback`, fallbackAgent);
    }
    
    return agents.get(`${slackUserId}:fallback`)!;
  }

  // 認証済みユーザー用のエージェント（Notion API直接利用）
  const agentKey = `${slackUserId}:authenticated`;
  
  if (!agents.has(agentKey)) {
    try {
      // Notion API用のツール定義
      const notionTools = {
        search_notion: {
          description: 'Search Notion pages and databases',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for Notion content'
              }
            },
            required: ['query']
          },
          execute: async (params: { query: string }) => {
            try {
              const results = await searchNotionPages(params.query, accessToken);
              return {
                success: true,
                results: results.results.map((item: any) => ({
                  id: item.id,
                  title: item.properties?.title?.title?.[0]?.plain_text || 'Untitled',
                  url: item.url,
                  last_edited: item.last_edited_time,
                  type: item.object
                }))
              };
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          }
        },
        get_notion_page: {
          description: 'Get detailed information about a specific Notion page',
          parameters: {
            type: 'object',
            properties: {
              pageId: {
                type: 'string',
                description: 'Notion page ID'
              }
            },
            required: ['pageId']
          },
          execute: async (params: { pageId: string }) => {
            try {
              const page = await getNotionPage(params.pageId, accessToken);
              return { success: true, page };
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          }
        }
      };
      
      const authenticatedAgent = new Agent({
        name: 'NotionOAuthAgent',
        instructions: `
          あなたは認証済みのAIアシスタントです。
          Notion公式OAuth 2.0で認証されたアカウントを使用して、
          ユーザーからの質問や検索要求に対して丁寧に返信してください。
          
          利用可能な機能:
          - Notionページとデータベースの検索
          - ページ詳細情報の取得
          - 複数アカウントの管理
          
          アカウント管理:
          - 「アカウント一覧」: 登録済みアカウントの表示
          - 「アカウント追加」: 新しいアカウントの追加
          - 「切り替え [アカウント名]」: アカウント切り替え
          - 「work:検索クエリ」: 仕事用アカウントで検索
          - 「personal:検索クエリ」: 個人用アカウントで検索
          
          MCP管理:
          - 「/mcp」: 状態確認と管理画面
          - 「/mcp status」: 詳細状態表示
          - 「/mcp accounts」: アカウント管理
          
          検索を行う際は、search_notionツールを使用してください。
          具体的なページの詳細が必要な場合は、get_notion_pageツールを使用してください。
          
          日本語で応答してください。
        `,
        model: geminiModel,
        tools: notionTools
      });
      
      agents.set(agentKey, authenticatedAgent);
      console.log(`✅ Created authenticated Notion OAuth agent for user ${slackUserId}`);
    } catch (error) {
      console.error(`❌ Failed to create agent for user ${slackUserId}:`, error);
      // フォールバックエージェントを返す
      const fallbackAgent = agents.get(`${slackUserId}:fallback`);
      if (fallbackAgent) return fallbackAgent;
      throw new Error('No fallback agent available');
    }
  }
  
  return agents.get(agentKey)!;
}

// アカウント選択UIの生成
function createAccountSelectionUI(accounts: any[], currentActive: string | null) {
  return {
    type: 'section',
    text: { 
      type: 'mrkdwn', 
      text: '*🏢 Notion アカウントを選択してください:*' 
    },
    accessory: {
      type: 'select',
      action_id: 'account_select',
      placeholder: { 
        type: 'plain_text', 
        text: 'アカウントを選択' 
      },
      options: accounts.map(account => ({
        text: {
          type: 'plain_text',
          text: `${account.isActive ? '✅ ' : ''}${account.name} (${account.workspace})`
        },
        value: account.id
      }))
    }
  };
}

function createAccountManagementButtons() {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '➕ アカウント追加' },
        action_id: 'add_account',
        style: 'primary'
      },
      {
        type: 'button', 
        text: { type: 'plain_text', text: '⚙️ アカウント設定' },
        action_id: 'manage_accounts'
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔄 アカウント切り替え' },
        action_id: 'switch_account'
      }
    ]
  };
}

// Expressサーバーの設定
const app = express();
app.use(express.json());

// OAuth コールバックエンドポイント
app.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ OAuth authorization failed:', error);
      res.send(`
        <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>❌ 認証に失敗しました</h2>
          <p>エラー: ${error}</p>
          <p>再度お試しください。</p>
          <script>setTimeout(() => window.close(), 5000);</script>
        </body>
        </html>
      `);
      return;
    }
    
    if (!code || !state) {
      res.status(400).send('Missing authorization code or state');
      return;
    }
    
    // OAuth コールバック処理
    const result = await oauthManager.handleCallback(code as string, state as string);
    
    // エージェントキャッシュをクリア（新しいアカウントで再作成させる）
    agents.delete(`${result.slackUserId}:authenticated`);
    agents.delete(`${result.slackUserId}:fallback`);
    
    // Slackへの認証完了通知（バックグラウンドで実行）
    notifySlackAuthCompletion(result.slackUserId, result.accountId).catch(error => {
      console.error('Failed to notify Slack about auth completion:', error);
    });
    
    res.send(`
      <html>
      <head>
        <title>Notion認証完了 - Slack Bot</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; margin: 0;">
        <div style="background: white; color: #333; border-radius: 20px; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <div style="font-size: 72px; margin-bottom: 20px;">🎉</div>
          <h1 style="color: #28a745; margin-bottom: 20px;">認証が完了しました！</h1>
          <p style="font-size: 18px; margin-bottom: 30px; color: #666;">
            Notionアカウントが正常にSlack Botに追加されました。<br>
            これで高度なAI機能をご利用いただけます。
          </p>
          
          <div style="background: #f8f9fa; padding: 25px; margin: 25px 0; border-radius: 15px; border-left: 5px solid #28a745;">
            <h3 style="color: #28a745; margin-top: 0;">📝 次のステップ</h3>
            <div style="text-align: left; display: inline-block;">
              <div style="margin-bottom: 15px;">
                <strong style="color: #495057;">1. Slashコマンドを試す</strong><br>
                <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; color: #495057;">/mcp</code> でMCPサーバーの状態を確認
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #495057;">2. 検索機能をテスト</strong><br>
                <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; color: #495057;">検索 [クエリ]</code> で認証済みツールをテスト
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #495057;">3. アカウント指定検索</strong><br>
                <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; color: #495057;">work:検索クエリ</code> でアカウント指定検索
              </div>
              <div>
                <strong style="color: #495057;">4. アカウント管理</strong><br>
                <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; color: #495057;">アカウント一覧</code> で登録済みアカウント確認
              </div>
            </div>
          </div>
          
          <div style="background: #e3f2fd; padding: 20px; margin: 25px 0; border-radius: 10px;">
            <div style="font-size: 24px; margin-bottom: 10px;">🔔</div>
            <p style="margin: 0; color: #1976d2;">
              <strong>Slackでも通知をお送りしました！</strong><br>
              DMをご確認ください。
            </p>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
            このウィンドウは自動的に閉じられます...<br>
            Slackに戻ってBotをお楽しみください！
          </p>
        </div>
        <script>
          let countdown = 10;
          const timer = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
              window.close();
              clearInterval(timer);
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);
    
    console.log(`✅ OAuth flow completed for user ${result.slackUserId}, account ${result.accountId}`);
    
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(500).send(`
      <html>
      <head>
        <title>認証エラー - Slack Bot</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: white; min-height: 100vh; margin: 0;">
        <div style="background: white; color: #333; border-radius: 20px; padding: 40px; max-width: 600px; margin: 0 auto; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <div style="font-size: 72px; margin-bottom: 20px;">😞</div>
          <h1 style="color: #dc3545; margin-bottom: 20px;">認証エラー</h1>
          <p style="font-size: 18px; margin-bottom: 30px; color: #666;">
            認証中にエラーが発生しました。<br>
            ご不便をおかけして申し訳ありません。
          </p>
          
          <div style="background: #f8d7da; color: #721c24; padding: 20px; margin: 25px 0; border-radius: 10px; border-left: 5px solid #dc3545;">
            <h3 style="margin-top: 0;">エラー詳細</h3>
            <code style="background: #f5c6cb; padding: 8px; border-radius: 4px; display: block; word-break: break-word;">
              ${(error as any).message}
            </code>
          </div>
          
          <div style="background: #d1ecf1; color: #0c5460; padding: 25px; margin: 25px 0; border-radius: 15px; border-left: 5px solid #17a2b8;">
            <h3 style="margin-top: 0;">🔧 対処方法</h3>
            <div style="text-align: left;">
              <div style="margin-bottom: 10px;">
                <strong>1.</strong> Slackに戻って <code style="background: #bee5eb; padding: 2px 6px; border-radius: 3px;">/mcp auth</code> を再実行
              </div>
              <div style="margin-bottom: 10px;">
                <strong>2.</strong> ブラウザのキャッシュをクリア
              </div>
              <div style="margin-bottom: 10px;">
                <strong>3.</strong> 異なるブラウザで試す
              </div>
              <div>
                <strong>4.</strong> Notionアカウントでログインしているか確認
              </div>
            </div>
          </div>
          
          <div style="background: #fff3cd; color: #856404; padding: 20px; margin: 25px 0; border-radius: 10px;">
            <p style="margin: 0;">
              <strong>🆘 問題が解決しない場合</strong><br>
              Slackで開発チームにお知らせください。
            </p>
          </div>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
            このウィンドウは自動的に閉じられます...<br>
            Slackに戻って再度お試しください。
          </p>
        </div>
        <script>setTimeout(() => window.close(), 10000);</script>
      </body>
      </html>
    `);
  }
});

// メインエージェントエンドポイント
app.post('/api/agent/search', async (req, res) => {
  try {
    const { message, slackUserId, threadId } = req.body;
    console.log(`📨 Request from user ${slackUserId}: ${message?.substring(0, 50)}...`);
    
    if (!message || !slackUserId) {
      return res.status(400).json({ error: 'メッセージとSlackユーザーIDが必要です' });
    }

    // アカウント管理コマンドの処理
    if (message.match(/^(account|アカウント|accounts)\s*(list|一覧|リスト)?$/i)) {
      const accounts = await oauthManager.listAccounts(slackUserId);
      
      if (accounts.length === 0) {
        return res.json({
          response: '📋 Notionアカウントが登録されていません。\\n\\n「アカウント追加」で新しいアカウントを追加してください。',
          threadId: threadId || 'default'
        });
      }

      const accountList = accounts.map((account, index) => 
        `${account.isActive ? '✅' : '⚪'} **${account.name}**\\n` +
        `   📧 ${account.email}\\n` +
        `   🏢 ${account.workspace}\\n` +
        `   📅 追加日: ${new Date(account.createdAt).toLocaleDateString()}`
      ).join('\\n\\n');

      return res.json({
        response: `🏢 **登録済みNotionアカウント** (${accounts.length}個)\\n\\n${accountList}\\n\\n💡 **使い方:**\\n• 「切り替え [アカウント名]」でアカウント変更\\n• 「work:検索クエリ」で仕事用アカウント指定\\n• 「アカウント追加」で新しいアカウント追加`,
        threadId: threadId || 'default'
      });
    }

    // アカウント追加コマンド
    if (message.match(/^(add account|アカウント追加|新しいアカウント)$/i)) {
      try {
        const authFlow = await oauthManager.addAccount(slackUserId);
        
        // ブラウザを自動で開く
        await open(authFlow.authUrl);
        
        return res.json({
          response: `🔐 **新しいNotionアカウントの認証を開始します**\\n\\nブラウザで認証画面が開きました。認証完了後、このチャンネルでアカウントをご利用いただけます。\\n\\n🔗 認証URL: ${authFlow.authUrl}\\n\\n💡 認証完了後は「アカウント一覧」で確認できます。`,
          requiresAuth: true,
          authUrl: authFlow.authUrl,
          threadId: threadId || 'default'
        });
        
      } catch (error: any) {
        return res.status(500).json({
          error: 'アカウント追加に失敗しました',
          details: error.message
        });
      }
    }

    // アカウント切り替えコマンド
    const switchMatch = message.match(/^(switch|切り替え|change)\s+(to\s+)?(.+)$/i);
    if (switchMatch) {
      const accountRef = switchMatch[3];
      
      try {
        const accounts = await oauthManager.listAccounts(slackUserId);
        const targetAccount = accounts.find(acc => 
          acc.name.toLowerCase().includes(accountRef.toLowerCase()) ||
          acc.workspace.toLowerCase().includes(accountRef.toLowerCase())
        );

        if (!targetAccount) {
          return res.json({
            response: `❌ アカウント「${accountRef}」が見つかりません。\\n\\n「アカウント一覧」で利用可能なアカウントを確認してください。`,
            threadId: threadId || 'default'
          });
        }

        await oauthManager.switchAccount(slackUserId, targetAccount.id);
        
        // エージェントキャッシュをクリア
        agents.delete(`${slackUserId}:authenticated`);
        
        return res.json({
          response: `✅ アクティブアカウントを「**${targetAccount.name}**」に切り替えました。\\n\\n🏢 ワークスペース: ${targetAccount.workspace}\\n📧 アカウント: ${targetAccount.email}`,
          threadId: threadId || 'default'
        });
        
      } catch (error: any) {
        return res.status(500).json({
          error: 'アカウント切り替えに失敗しました',
          details: error.message
        });
      }
    }

    // スマートアカウント選択
    const selection = await selectAccountForMessage(slackUserId, message);
    
    if (selection.accountId && selection.confidence > 0.7) {
      // 選択されたアカウントに切り替え
      await oauthManager.switchAccount(slackUserId, selection.accountId);
      // エージェントキャッシュをクリア
      agents.delete(`${slackUserId}:authenticated`);
      
      const account = await oauthManager.getAccount(slackUserId, selection.accountId);
      console.log(`🎯 Auto-selected account: ${account?.name} (confidence: ${selection.confidence}, reason: ${selection.reason})`);
    }

    // エージェントを取得して実行
    const agent = await getAgentForUser(slackUserId);
    
    console.log('🤖 Generating response with agent...');
    
    const result = await agent.generate(selection.query || message, {
      threadId: threadId || 'default'
    });

    const fullResponse = result.text || 'すみません、応答の生成に失敗しました。';
    
    console.log(`✅ Response generated: ${fullResponse.length} characters`);
    
    // アカウント選択情報を付加
    let responseWithAccountInfo = fullResponse;
    if (selection.accountId && selection.confidence > 0.5) {
      const account = await oauthManager.getAccount(slackUserId, selection.accountId);
      responseWithAccountInfo = `🏢 *使用アカウント: ${account?.name}*\\n\\n${fullResponse}`;
    }
    
    res.json({ 
      response: responseWithAccountInfo,
      threadId: threadId || 'default',
      accountSelection: {
        accountId: selection.accountId,
        confidence: selection.confidence,
        reason: selection.reason
      }
    });
    
  } catch (error: any) {
    console.error('❌ Agent error:', error);
    res.status(500).json({ 
      error: 'エージェント処理中にエラーが発生しました',
      details: error.message
    });
  }
});

// アカウント管理エンドポイント
app.get('/api/accounts/:slackUserId', async (req, res) => {
  try {
    const { slackUserId } = req.params;
    const accounts = await oauthManager.listAccounts(slackUserId);
    
    res.json({
      accounts,
      count: accounts.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/accounts/:slackUserId/:accountId', async (req, res) => {
  try {
    const { slackUserId, accountId } = req.params;
    await oauthManager.removeAccount(slackUserId, accountId);
    
    // エージェントキャッシュをクリア
    agents.delete(`${slackUserId}:authenticated`);
    
    res.json({ message: 'Account removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    agent: 'NotionOAuthAgent',
    transport: 'HTTP with Notion Official OAuth 2.0',
    features: [
      'notion-official-oauth',
      'multi-account-support',
      'smart-account-selection', 
      'account-switching',
      'direct-notion-api'
    ]
  });
});

// サーバー起動
async function startServer() {
  try {
    // 期限切れセッションのクリーンアップを定期実行
    setInterval(() => {
      oauthManager.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // 5分ごと

    const PORT = process.env.AGENT_PORT || 3001;
    app.listen(PORT, () => {
      console.log(`✅ Notion Official OAuth Agent server running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/api/health`);
      console.log(`📍 OAuth Callback: http://localhost:${PORT}/oauth/callback`);
      console.log(`\\n🏢 Notion Official OAuth Features:`);
      console.log('  ✅ Official Notion OAuth 2.0');
      console.log('  ✅ Multiple Notion accounts per user');
      console.log('  ✅ Smart account selection');
      console.log('  ✅ Account switching');
      console.log('  ✅ Direct Notion API calls');
      console.log(`\\n💡 Usage:`);
      console.log('  1. Send \"アカウント追加\" to add Notion accounts');
      console.log('  2. Use \"work:search query\" for work account');
      console.log('  3. Use \"personal:search query\" for personal account');
      console.log('  4. Send \"アカウント一覧\" to manage accounts');
    });
  } catch (error) {
    console.error('❌ Failed to start Notion OAuth server:', error);
    process.exit(1);
  }
}

// プロセス終了時のクリーンアップ
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  try {
    // OAuth セッションのクリーンアップ
    oauthManager.cleanupExpiredSessions();
    console.log('✅ OAuth sessions cleaned up');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  process.exit(0);
});

// サーバー起動
startServer();