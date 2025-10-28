import OpenAI from 'openai';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

class DeepseekService {
  constructor() {
    this.apiKey = config.ai?.deepseekApiKey;
    if (!this.apiKey) {
      logger.warn('DEEPSEEK_API_KEY is not configured. AI features are disabled.');
      this.client = null;
      return;
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: 'https://api.deepseek.com',
      timeout: 15000
    });
  }

  isAvailable() {
    return Boolean(this.client);
  }

  async chat({ systemPrompt, userMessage, history = [], tools = [], temperature = 0.7, maxTokens = 600 }) {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API is not configured');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];

    const response = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? 'auto' : undefined,
      temperature,
      max_tokens: maxTokens
    });

    logger.info('deepseek_chat_call', {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      finishReason: response.choices[0]?.finish_reason
    });

    return response;
  }
}

export const deepseekService = new DeepseekService();
export default deepseekService;
