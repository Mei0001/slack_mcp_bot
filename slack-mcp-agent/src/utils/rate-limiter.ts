// Simple rate limiter for Anthropic API
// Claude Sonnet 4 has a limit of 20,000 tokens per minute

interface RateLimitState {
  windowStart: number;
  tokenCount: number;
}

export class RateLimiter {
  private state: RateLimitState = {
    windowStart: Date.now(),
    tokenCount: 0
  };
  
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxTokens = 18000; // Leave some buffer (20k limit)
  
  async checkAndWait(estimatedTokens: number): Promise<void> {
    const now = Date.now();
    
    // Reset window if it's expired
    if (now - this.state.windowStart > this.windowMs) {
      console.log('[RateLimiter] Resetting rate limit window');
      this.state = {
        windowStart: now,
        tokenCount: 0
      };
    }
    
    // Check if we would exceed the limit
    if (this.state.tokenCount + estimatedTokens > this.maxTokens) {
      const waitTime = this.windowMs - (now - this.state.windowStart);
      console.log(`[RateLimiter] Would exceed rate limit. Waiting ${Math.round(waitTime / 1000)}s...`);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Reset after waiting
        this.state = {
          windowStart: Date.now(),
          tokenCount: 0
        };
      }
    }
    
    // Update token count
    this.state.tokenCount += estimatedTokens;
    console.log(`[RateLimiter] Token usage: ${this.state.tokenCount}/${this.maxTokens} in current window`);
  }
  
  // Estimate tokens based on message length (rough approximation)
  estimateTokens(message: string, toolCount: number = 0): number {
    // Rough estimate: 1 token per 4 characters for Japanese/English mix
    const messageTokens = Math.ceil(message.length / 4);
    
    // Each tool adds approximately 500-1000 tokens for its schema
    const toolTokens = toolCount * 750;
    
    // Add buffer for system messages and response
    const bufferTokens = 500;
    
    const total = messageTokens + toolTokens + bufferTokens;
    console.log(`[RateLimiter] Estimated tokens: ${total} (message: ${messageTokens}, tools: ${toolTokens}, buffer: ${bufferTokens})`);
    
    return total;
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();