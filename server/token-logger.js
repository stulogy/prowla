import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKENS_LOG = join(__dirname, '../data/token-usage.jsonl');

/**
 * Log token usage for sub-agent tasks
 * @param {Object} entry - Token usage entry
 * @param {string} entry.date - ISO date string
 * @param {string} entry.taskType - Type of task (job-search, research, materials, funding-scan)
 * @param {string} entry.company - Company name (if applicable)
 * @param {number} entry.tokensIn - Input tokens
 * @param {number} entry.tokensOut - Output tokens
 * @param {number} entry.cost - Total cost in USD
 * @param {string} entry.model - Model used
 * @param {number} entry.durationMs - Task duration
 */
export function logTokenUsage(entry) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  
  // Append to JSONL file
  const line = JSON.stringify(logEntry) + '\n';
  fs.appendFileSync(TOKENS_LOG, line, 'utf8');
  
  console.log(`💰 Token usage logged: ${entry.taskType} - ${entry.company || 'N/A'} - $${entry.cost.toFixed(4)}`);
}

/**
 * Get token usage summary
 * @param {Object} filters
 * @param {string} filters.startDate - ISO date string
 * @param {string} filters.endDate - ISO date string
 * @param {string} filters.taskType - Filter by task type
 */
export function getTokenUsage(filters = {}) {
  if (!fs.existsSync(TOKENS_LOG)) {
    return {
      entries: [],
      summary: {
        totalCost: 0,
        totalTokens: 0,
        byTaskType: {},
        byDay: {}
      }
    };
  }
  
  const lines = fs.readFileSync(TOKENS_LOG, 'utf8').split('\n').filter(l => l.trim());
  let entries = lines.map(line => JSON.parse(line));
  
  // Apply filters
  if (filters.startDate) {
    entries = entries.filter(e => e.timestamp >= filters.startDate);
  }
  if (filters.endDate) {
    entries = entries.filter(e => e.timestamp <= filters.endDate);
  }
  if (filters.taskType) {
    entries = entries.filter(e => e.taskType === filters.taskType);
  }
  
  // Calculate summary
  const summary = {
    totalCost: entries.reduce((sum, e) => sum + e.cost, 0),
    totalTokens: entries.reduce((sum, e) => sum + e.tokensIn + e.tokensOut, 0),
    byTaskType: {},
    byDay: {},
    byModel: {}
  };
  
  entries.forEach(entry => {
    // By task type
    if (!summary.byTaskType[entry.taskType]) {
      summary.byTaskType[entry.taskType] = { count: 0, cost: 0, tokens: 0 };
    }
    summary.byTaskType[entry.taskType].count++;
    summary.byTaskType[entry.taskType].cost += entry.cost;
    summary.byTaskType[entry.taskType].tokens += entry.tokensIn + entry.tokensOut;
    
    // By day
    const day = entry.timestamp.split('T')[0];
    if (!summary.byDay[day]) {
      summary.byDay[day] = { count: 0, cost: 0, tokens: 0 };
    }
    summary.byDay[day].count++;
    summary.byDay[day].cost += entry.cost;
    summary.byDay[day].tokens += entry.tokensIn + entry.tokensOut;
    
    // By model
    if (!summary.byModel[entry.model]) {
      summary.byModel[entry.model] = { count: 0, cost: 0, tokens: 0 };
    }
    summary.byModel[entry.model].count++;
    summary.byModel[entry.model].cost += entry.cost;
    summary.byModel[entry.model].tokens += entry.tokensIn + entry.tokensOut;
  });
  
  return { entries, summary };
}

/**
 * Parse Clawdbot session transcript to extract token usage
 * (This would be called when a sub-agent completes)
 */
export function parseSessionTokens(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(l => l.trim());
    let totalIn = 0;
    let totalOut = 0;
    let totalCost = 0;
    let model = 'unknown';
    
    lines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.usage) {
          totalIn += entry.usage.input || 0;
          totalOut += entry.usage.output || 0;
          totalCost += entry.usage.cost?.total || 0;
          if (entry.model) model = entry.model;
        }
      } catch (e) {
        // Skip malformed lines
      }
    });
    
    return {
      tokensIn: totalIn,
      tokensOut: totalOut,
      cost: totalCost,
      model
    };
  } catch (error) {
    console.error('Error parsing session tokens:', error);
    return null;
  }
}
