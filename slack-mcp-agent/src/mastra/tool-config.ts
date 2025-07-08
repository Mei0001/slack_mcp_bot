// ツール設定の動的管理
// 参考: https://zenn.dev/nikechan/articles/b9b2d40129f736

export interface ToolConfig {
  essential: string[];
  optional: string[];
  excluded: string[];
}

// メッセージ内容に基づいてツール設定を動的に調整
export function getToolConfigForMessage(message: string): ToolConfig {
  const lowerMessage = message.toLowerCase();
  
  // 基本的な必須ツール（常に含める）
  const baseEssential = [
    'notion_API-post-search',  // 検索は常に必要
  ];
  
  // 条件に基づいて追加するツール
  const conditionalTools: string[] = [];
  
  // ページ取得が必要な場合
  if (lowerMessage.includes('ページ') || lowerMessage.includes('page') || 
      lowerMessage.includes('内容') || lowerMessage.includes('詳細')) {
    conditionalTools.push('notion_API-retrieve-a-page');
  }
  
  // 編集・更新が必要な場合
  if (lowerMessage.includes('更新') || lowerMessage.includes('編集') || 
      lowerMessage.includes('変更') || lowerMessage.includes('修正') ||
      lowerMessage.includes('update') || lowerMessage.includes('edit')) {
    conditionalTools.push('notion_API-patch-page');
  }
  
  // 作成が必要な場合
  if (lowerMessage.includes('作成') || lowerMessage.includes('新規') || 
      lowerMessage.includes('追加') || lowerMessage.includes('create') || 
      lowerMessage.includes('add') || lowerMessage.includes('new')) {
    conditionalTools.push('notion_API-post-page');
  }
  
  // データベース操作が必要な場合
  if (lowerMessage.includes('データベース') || lowerMessage.includes('database') ||
      lowerMessage.includes('テーブル') || lowerMessage.includes('一覧')) {
    conditionalTools.push('notion_API-post-database-query');
    conditionalTools.push('notion_API-retrieve-a-database');
  }
  
  // タスク関連の場合
  if (lowerMessage.includes('タスク') || lowerMessage.includes('todo') || 
      lowerMessage.includes('進行中') || lowerMessage.includes('未着手')) {
    conditionalTools.push('notion_API-post-database-query');
  }
  
  return {
    essential: [...baseEssential, ...conditionalTools],
    optional: [],
    excluded: [
      'notion_API-delete-a-block',        // 削除操作は慎重に
      'notion_API-create-token',          // トークン管理は不要
      'notion_API-retrieve-bot-user',     // Bot情報は不要
      'notion_API-append-block-children', // 複雑なブロック操作
      'notion_API-create-a-database',     // データベース作成は不要
      'notion_API-update-a-database',     // データベース更新は不要
    ]
  };
}

// ツールの総トークン数を概算
export function estimateToolTokens(toolCount: number): number {
  // 各ツールは平均500-1000トークンのスキーマを持つ
  return toolCount * 750;
}