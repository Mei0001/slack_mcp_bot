// MCPツールのスキーマ検証とClaude/Anthropic互換性チェック

interface ClaudeToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

// Claude/Anthropic互換のツールスキーマを検証する関数
export function validateClaudeToolSchema(tool: any): ClaudeToolSchema | null {
  try {
    if (!tool || typeof tool !== 'object') {
      return null;
    }

    // 基本的なプロパティの検証
    const name = tool.name || tool.id || 'unknown_tool';
    const description = tool.description || `Tool: ${name}`;

    // パラメータスキーマの検証と修正
    let parameters = {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    };

    if (tool.parameters) {
      parameters = sanitizeParameters(tool.parameters);
    } else if (tool.inputSchema) {
      parameters = sanitizeParameters(tool.inputSchema);
    }

    return {
      name,
      description,
      parameters
    };
  } catch (error) {
    console.warn(`[ToolValidator] Failed to validate tool: ${tool.name || tool.id}`, error);
    return null;
  }
}

// パラメータを安全化する関数
function sanitizeParameters(params: any): {
  type: "object";
  properties: Record<string, any>;
  required: string[];
} {
  try {
    // デフォルト値
    let result = {
      type: "object" as const,
      properties: {},
      required: [] as string[]
    };

    if (params && typeof params === 'object') {
      // propertiesの処理
      if (params.properties && typeof params.properties === 'object') {
        result.properties = sanitizeProperties(params.properties);
      }

      // requiredの処理
      if (params.required && Array.isArray(params.required)) {
        result.required = sanitizeRequired(params.required, result.properties);
      }

      // typeの処理
      if (params.type === 'object' || !params.type) {
        result.type = "object";
      }
    }

    return result;
  } catch (error) {
    console.warn('[ToolValidator] Failed to sanitize parameters:', error);
    return {
      type: "object",
      properties: {},
      required: []
    };
  }
}

// propertiesを安全化する関数
function sanitizeProperties(properties: any): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof key === 'string' && key.length > 0) {
      result[key] = sanitizeProperty(value);
    }
  }

  return result;
}

// 個別のプロパティを安全化する関数
function sanitizeProperty(property: any): any {
  if (!property || typeof property !== 'object') {
    return {
      type: "string",
      description: "A parameter"
    };
  }

  const result: any = {
    type: property.type || "string",
    description: property.description || "A parameter"
  };

  // 追加のプロパティを保持
  if (property.enum) result.enum = property.enum;
  if (property.format) result.format = property.format;
  if (property.items) result.items = sanitizeProperty(property.items);
  if (property.properties) result.properties = sanitizeProperties(property.properties);

  return result;
}

// required配列を安全化する関数
function sanitizeRequired(required: any[], properties: Record<string, any>): string[] {
  if (!Array.isArray(required)) {
    return [];
  }

  return required
    .filter((item): item is string => {
      // 文字列であり、かつpropertiesに存在するもののみを残す
      return typeof item === 'string' 
        && item.length > 0 
        && properties.hasOwnProperty(item);
    });
}

// MCPツールのバッチ検証
export function validateMCPToolsForClaude(mcpTools: Record<string, any>): Record<string, ClaudeToolSchema> {
  const validatedTools: Record<string, ClaudeToolSchema> = {};
  let validCount = 0;
  let invalidCount = 0;

  for (const [key, tool] of Object.entries(mcpTools)) {
    const validated = validateClaudeToolSchema(tool);
    if (validated) {
      validatedTools[key] = validated;
      validCount++;
    } else {
      invalidCount++;
      console.warn(`[ToolValidator] Skipped invalid tool: ${key}`);
    }
  }

  console.log(`[ToolValidator] Validated ${validCount} tools, skipped ${invalidCount} invalid tools`);
  return validatedTools;
}

// ツールのデバッグ情報を出力
export function debugTool(toolName: string, tool: any): void {
  console.log(`\n=== Debug Tool: ${toolName} ===`);
  console.log('Original tool:', JSON.stringify(tool, null, 2));
  
  const validated = validateClaudeToolSchema(tool);
  if (validated) {
    console.log('Validated tool:', JSON.stringify(validated, null, 2));
    
    // required配列の詳細チェック
    if (validated.parameters.required.length > 0) {
      console.log('Required properties check:');
      validated.parameters.required.forEach((req, index) => {
        const exists = validated.parameters.properties.hasOwnProperty(req);
        console.log(`  [${index}] "${req}" -> ${exists ? 'EXISTS' : 'MISSING'}`);
      });
    }
  } else {
    console.log('Validation failed');
  }
  console.log('=== End Debug ===\n');
}