/**
 * Config Tools
 * 
 * MCP tools for managing job search configuration and preferences.
 * 
 * Tools:
 * - config_get: Get current search preferences
 * - config_update: Update search preferences
 * - config_get_rejected: Get list of rejected companies
 * 
 * @module tools/config
 */

import { 
  getConfigPath, 
  getRejectedPath, 
  readJsonFile, 
  writeJsonFile 
} from '../lib/db.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  workTypes: ['Fractional', 'Contract', 'Part-time'],
  hoursPerWeek: { min: 10, max: 30 },
  rates: {
    hourly: { min: 110, max: 170 },
    fractionalMonthly: { min: 5000, max: 8000 },
    fullTimeSalary: { min: 140000, max: 180000 }
  },
  industries: ['EdTech', 'SaaS', 'AI', 'B2B'],
  companyStages: ['Pre-seed', 'Seed', 'Series A'],
  mustBeRemote: true,
  autoRejectFullTime: true,
  noAgencies: true,
  searchFrequency: '8,16',
  autoResearch: false,
  notifyOnNewJobs: true
};

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'config_get',
    description: 'Get the current job search configuration/preferences. Includes work types, rates, industries, etc.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'config_update',
    description: 'Update job search configuration. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        workTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Acceptable work types (e.g., ["Fractional", "Contract", "Part-time"])'
        },
        hoursPerWeek: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' }
          },
          description: 'Acceptable hours per week range'
        },
        rates: {
          type: 'object',
          description: 'Rate expectations',
          properties: {
            hourly: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' }
              }
            },
            fractionalMonthly: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' }
              }
            },
            fullTimeSalary: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' }
              }
            }
          }
        },
        industries: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred industries'
        },
        companyStages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred company stages'
        },
        mustBeRemote: {
          type: 'boolean',
          description: 'Only consider remote positions'
        },
        autoRejectFullTime: {
          type: 'boolean',
          description: 'Automatically reject full-time positions'
        },
        noAgencies: {
          type: 'boolean',
          description: 'Reject staffing agency listings'
        },
        searchFrequency: {
          type: 'string',
          description: 'Hours to run search (comma-separated, e.g., "8,16")'
        },
        autoResearch: {
          type: 'boolean',
          description: 'Automatically research high-priority jobs'
        },
        notifyOnNewJobs: {
          type: 'boolean',
          description: 'Send notifications for new jobs'
        }
      }
    }
  },
  {
    name: 'config_get_rejected',
    description: 'Get the list of rejected companies. These companies are excluded from future job searches.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * Get current configuration
   */
  config_get: () => {
    const configPath = getConfigPath();
    const config = readJsonFile(configPath, DEFAULT_CONFIG);
    
    return {
      config,
      path: configPath
    };
  },

  /**
   * Update configuration
   */
  config_update: (updates) => {
    const configPath = getConfigPath();
    
    // Get current config
    const currentConfig = readJsonFile(configPath, DEFAULT_CONFIG);
    
    // Deep merge updates
    const newConfig = deepMerge(currentConfig, updates);
    
    // Write updated config
    writeJsonFile(configPath, newConfig);
    
    return {
      success: true,
      config: newConfig
    };
  },

  /**
   * Get rejected companies list
   */
  config_get_rejected: () => {
    const rejectedPath = getRejectedPath();
    const data = readJsonFile(rejectedPath, { rejected: [] });
    
    return {
      rejected: data.rejected || [],
      count: (data.rejected || []).length,
      path: rejectedPath
    };
  }
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object (overrides target)
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) continue;
    
    if (
      typeof source[key] === 'object' && 
      source[key] !== null && 
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

export default { toolDefinitions, handlers };
