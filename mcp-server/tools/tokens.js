/**
 * Tokens Tools
 * 
 * MCP tools for logging and querying token usage.
 * Helps track AI costs by task type, model, and time period.
 * 
 * Tools:
 * - tokens_log: Log token usage for an operation
 * - tokens_get_usage: Get usage statistics
 * - tokens_get_cost: Get cost estimates
 * 
 * @module tools/tokens
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Token usage log file
const TOKEN_LOG_PATH = join(__dirname, '../../server/token-usage.json');

/**
 * Model pricing (per 1K tokens)
 * Updated as of February 2026
 */
const MODEL_PRICING = {
  // Claude 4 models
  'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
  'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
  
  // Claude 3.5 models
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku-20241022': { input: 0.0008, output: 0.004 },
  
  // Shorthand aliases
  'sonnet': { input: 0.003, output: 0.015 },
  'opus': { input: 0.015, output: 0.075 },
  'haiku': { input: 0.0008, output: 0.004 },
  
  // Default (use sonnet pricing)
  'default': { input: 0.003, output: 0.015 }
};

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'tokens_log',
    description: 'Log token usage for an operation. Use this to track AI costs.',
    inputSchema: {
      type: 'object',
      properties: {
        task_type: {
          type: 'string',
          description: 'Type of task (e.g., "research", "materials", "discovery")'
        },
        input_tokens: {
          type: 'number',
          description: 'Number of input tokens used'
        },
        output_tokens: {
          type: 'number',
          description: 'Number of output tokens generated'
        },
        model: {
          type: 'string',
          description: 'Model used (e.g., "claude-sonnet-4-20250514", "haiku")'
        },
        job_id: {
          type: 'number',
          description: 'Optional job ID this usage is associated with'
        },
        metadata: {
          type: 'object',
          description: 'Optional additional metadata'
        }
      },
      required: ['task_type', 'input_tokens', 'output_tokens', 'model']
    }
  },
  {
    name: 'tokens_get_usage',
    description: 'Get token usage statistics. Can filter by date range and task type.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date (ISO format, e.g., "2026-02-01")'
        },
        end_date: {
          type: 'string',
          description: 'End date (ISO format)'
        },
        task_type: {
          type: 'string',
          description: 'Filter by task type'
        }
      }
    }
  },
  {
    name: 'tokens_get_cost',
    description: 'Get cost estimates based on token usage. Uses current model pricing.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date (ISO format)'
        },
        end_date: {
          type: 'string',
          description: 'End date (ISO format)'
        }
      }
    }
  }
];

/**
 * Load token usage log
 * @returns {Object[]} Array of usage entries
 */
function loadUsageLog() {
  try {
    if (fs.existsSync(TOKEN_LOG_PATH)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_LOG_PATH, 'utf8'));
      return data.entries || [];
    }
  } catch (e) {
    console.error('Error loading token log:', e.message);
  }
  return [];
}

/**
 * Save token usage log
 * @param {Object[]} entries - Usage entries
 */
function saveUsageLog(entries) {
  const data = {
    entries,
    updated_at: new Date().toISOString()
  };
  fs.writeFileSync(TOKEN_LOG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Calculate cost for tokens
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @param {string} model - Model name
 * @returns {number} Cost in dollars
 */
function calculateCost(inputTokens, outputTokens, model) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * Log token usage
   */
  tokens_log: ({ task_type, input_tokens, output_tokens, model, job_id = null, metadata = null }) => {
    const entries = loadUsageLog();
    
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      task_type,
      input_tokens,
      output_tokens,
      model,
      job_id,
      metadata,
      cost: calculateCost(input_tokens, output_tokens, model)
    };
    
    entries.push(entry);
    saveUsageLog(entries);
    
    return {
      success: true,
      entry_id: entry.id,
      cost: entry.cost.toFixed(4)
    };
  },

  /**
   * Get usage statistics
   */
  tokens_get_usage: ({ start_date = null, end_date = null, task_type = null }) => {
    let entries = loadUsageLog();
    
    // Filter by date range
    if (start_date) {
      const startTime = new Date(start_date).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= startTime);
    }
    if (end_date) {
      const endTime = new Date(end_date).getTime() + (24 * 60 * 60 * 1000); // End of day
      entries = entries.filter(e => new Date(e.timestamp).getTime() < endTime);
    }
    
    // Filter by task type
    if (task_type) {
      entries = entries.filter(e => e.task_type === task_type);
    }
    
    // Aggregate totals
    let totalInput = 0;
    let totalOutput = 0;
    const byTaskType = {};
    const byModel = {};
    
    for (const entry of entries) {
      totalInput += entry.input_tokens;
      totalOutput += entry.output_tokens;
      
      // By task type
      if (!byTaskType[entry.task_type]) {
        byTaskType[entry.task_type] = { input: 0, output: 0, count: 0 };
      }
      byTaskType[entry.task_type].input += entry.input_tokens;
      byTaskType[entry.task_type].output += entry.output_tokens;
      byTaskType[entry.task_type].count += 1;
      
      // By model
      if (!byModel[entry.model]) {
        byModel[entry.model] = { input: 0, output: 0, count: 0 };
      }
      byModel[entry.model].input += entry.input_tokens;
      byModel[entry.model].output += entry.output_tokens;
      byModel[entry.model].count += 1;
    }
    
    return {
      period: {
        start: start_date || 'all time',
        end: end_date || 'now'
      },
      total: {
        input: totalInput,
        output: totalOutput,
        entries: entries.length
      },
      by_task_type: byTaskType,
      by_model: byModel
    };
  },

  /**
   * Get cost estimates
   */
  tokens_get_cost: ({ start_date = null, end_date = null }) => {
    let entries = loadUsageLog();
    
    // Filter by date range
    if (start_date) {
      const startTime = new Date(start_date).getTime();
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= startTime);
    }
    if (end_date) {
      const endTime = new Date(end_date).getTime() + (24 * 60 * 60 * 1000);
      entries = entries.filter(e => new Date(e.timestamp).getTime() < endTime);
    }
    
    // Calculate costs
    let totalCost = 0;
    const byTaskType = {};
    const byModel = {};
    const byDay = {};
    
    for (const entry of entries) {
      const cost = entry.cost || calculateCost(entry.input_tokens, entry.output_tokens, entry.model);
      totalCost += cost;
      
      // By task type
      if (!byTaskType[entry.task_type]) {
        byTaskType[entry.task_type] = 0;
      }
      byTaskType[entry.task_type] += cost;
      
      // By model
      if (!byModel[entry.model]) {
        byModel[entry.model] = 0;
      }
      byModel[entry.model] += cost;
      
      // By day
      const day = entry.timestamp.split('T')[0];
      if (!byDay[day]) {
        byDay[day] = 0;
      }
      byDay[day] += cost;
    }
    
    // Format costs to 4 decimal places
    const formatCosts = (obj) => {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = parseFloat(value.toFixed(4));
      }
      return result;
    };
    
    return {
      period: {
        start: start_date || 'all time',
        end: end_date || 'now'
      },
      total_cost: parseFloat(totalCost.toFixed(4)),
      total_cost_formatted: `$${totalCost.toFixed(2)}`,
      by_task_type: formatCosts(byTaskType),
      by_model: formatCosts(byModel),
      by_day: formatCosts(byDay),
      pricing_info: MODEL_PRICING
    };
  }
};

export default { toolDefinitions, handlers };
