import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { MCPRequestSchema, MCPResponse, MCPError } from './types.js';
import { NotionService } from './notion-service.js';

const app = express();

// セキュリティミドルウェア
app.use(helmet({
  contentSecurityPolicy: false, // Cloudflareとの互換性のため
}));

// CORS設定（本番環境では制限する）
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Notion MCP HTTP Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// サポートされるツールの一覧を返すエンドポイント
app.get('/tools', (req, res) => {
  // 一時的なサービスインスタンスを作成してツール情報を取得
  const tempService = new NotionService({ token: 'temp', version: '2022-06-28' });
  const supportedTools = tempService.getSupportedTools();
  
  const toolsInfo = supportedTools.map(tool => ({
    name: tool,
    ...tempService.getToolInfo(tool)
  }));

  res.json({
    success: true,
    data: {
      tools: toolsInfo,
      count: toolsInfo.length
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

// MCPツール実行エンドポイント
app.post('/mcp/execute', async (req, res) => {
  const startTime = Date.now();
  let toolName = 'unknown';

  try {
    // リクエストの検証
    const validatedRequest = MCPRequestSchema.parse(req.body);
    toolName = validatedRequest.tool;

    console.log(`[Server] 🚀 Executing MCP tool: ${toolName}`, {
      timestamp: new Date().toISOString(),
      args: Object.keys(validatedRequest.arguments),
      hasAuth: !!validatedRequest.auth.token
    });

    // NotionServiceを初期化
    const notionService = new NotionService(validatedRequest.auth);

    // ツールを実行
    const result = await notionService.executeTool(
      validatedRequest.tool as any,
      validatedRequest.arguments
    );

    const executionTime = Date.now() - startTime;

    const response: MCPResponse = {
      success: true,
      data: result,
      metadata: {
        toolName,
        executionTime,
        timestamp: new Date().toISOString()
      }
    };

    console.log(`[Server] ✅ Tool execution successful:`, {
      toolName,
      executionTime: `${executionTime}ms`,
      dataSize: JSON.stringify(result).length
    });

    res.json(response);

  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    console.error(`[Server] ❌ Tool execution failed:`, {
      toolName,
      executionTime: `${executionTime}ms`,
      error: error.message,
      type: error.constructor.name
    });

    let mcpError: MCPError;
    
    if (error instanceof MCPError) {
      mcpError = error;
    } else if (error.name === 'ZodError') {
      mcpError = new MCPError(
        'Invalid request format',
        'VALIDATION_ERROR',
        error.issues
      );
    } else {
      mcpError = new MCPError(
        error.message || 'Unknown error occurred',
        'INTERNAL_ERROR',
        { originalError: error.message, stack: error.stack }
      );
    }

    const response: MCPResponse = {
      success: false,
      error: {
        message: mcpError.message,
        code: mcpError.code,
        details: mcpError.details
      },
      metadata: {
        toolName,
        executionTime,
        timestamp: new Date().toISOString()
      }
    };

    // エラーの種類に応じてHTTPステータスコードを設定
    let statusCode = 500;
    if (mcpError.code === 'VALIDATION_ERROR') {
      statusCode = 400;
    } else if (mcpError.code === 'UNSUPPORTED_TOOL') {
      statusCode = 404;
    } else if (mcpError.code === 'NOTION_API_ERROR') {
      statusCode = 502;
    }

    res.status(statusCode).json(response);
  }
});

// バッチ実行エンドポイント（将来の拡張用）
app.post('/mcp/batch', async (req, res) => {
  try {
    const { requests } = req.body;
    
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'requests must be a non-empty array',
          code: 'INVALID_BATCH_REQUEST'
        }
      });
    }

    // 最大10件まで
    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Maximum 10 requests allowed in batch',
          code: 'BATCH_SIZE_LIMIT'
        }
      });
    }

    console.log(`[Server] 🔄 Processing batch of ${requests.length} requests`);

    const results = await Promise.allSettled(
      requests.map(async (request: any, index: number) => {
        try {
          const validatedRequest = MCPRequestSchema.parse(request);
          const notionService = new NotionService(validatedRequest.auth);
          const result = await notionService.executeTool(
            validatedRequest.tool as any,
            validatedRequest.arguments
          );
          return { requestIndex: index, success: true, data: result };
        } catch (error: any) {
          return { 
            requestIndex: index, 
            success: false, 
            error: {
              message: error.message,
              code: error.code || 'BATCH_ITEM_ERROR'
            }
          };
        }
      })
    );

    res.json({
      success: true,
      data: {
        results: results.map((result, idx) => ({
          index: idx,
          ...(result.status === 'fulfilled' ? result.value : { success: false, error: result.reason })
        }))
      },
      metadata: {
        totalRequests: requests.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Server] Batch processing error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Batch processing failed',
        code: 'BATCH_ERROR',
        details: error.message
      }
    });
  }
});

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
      code: 'ENDPOINT_NOT_FOUND'
    },
    metadata: {
      availableEndpoints: [
        'GET /health',
        'GET /tools',
        'POST /mcp/execute',
        'POST /mcp/batch'
      ],
      timestamp: new Date().toISOString()
    }
  });
});

// エラーハンドラー
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    },
    metadata: {
      timestamp: new Date().toISOString()
    }
  });
});

// サーバー起動
const PORT = process.env.PORT || 3002;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`✅ Notion MCP HTTP Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`🛠️ Tools info: http://localhost:${PORT}/tools`);
    console.log(`🎯 Execute endpoint: http://localhost:${PORT}/mcp/execute`);
    console.log(`📦 Batch endpoint: http://localhost:${PORT}/mcp/batch`);
  });
}

export default app; 