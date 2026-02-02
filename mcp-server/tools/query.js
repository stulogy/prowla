/**
 * Query Tools
 * 
 * MCP tools for querying job data with specialized filters.
 * Provides convenience methods for common agent queries.
 * 
 * Tools:
 * - query_stats: Get dashboard statistics
 * - query_by_company: Find job by company name
 * - query_needs_research: Get jobs without research
 * - query_high_priority: Get high priority jobs
 * 
 * @module tools/query
 */

import { getDb } from '../lib/db.js';
import { findByCompany, getJobsNeedingResearch, getHighPriorityJobs } from '../lib/fuzzy-search.js';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'query_stats',
    description: 'Get dashboard statistics: totals by status, priority, materials, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'query_by_company',
    description: 'Find a job by company name. Supports exact match or fuzzy matching.',
    inputSchema: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Company name to search for'
        },
        fuzzy: {
          type: 'boolean',
          description: 'Allow fuzzy matching if exact match not found (default: false)',
          default: false
        }
      },
      required: ['company_name']
    }
  },
  {
    name: 'query_needs_research',
    description: 'Get jobs that need research (no research notes yet). Useful for finding work to do.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum jobs to return (default: 50)',
          default: 50
        },
        priority: {
          type: 'string',
          description: 'Filter by priority',
          enum: ['🔴 High', '🟡 Medium', '🟢 Lower']
        }
      }
    }
  },
  {
    name: 'query_high_priority',
    description: 'Get all high priority (🔴) jobs. Optionally filter by status.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum jobs to return (default: 50)',
          default: 50
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['Not Started', 'Researching', 'Ready to Apply', 'Applied', 'Interviewing', 'Done']
        }
      }
    }
  }
];

import fs from 'fs';
import { getTasksPath } from '../lib/db.js';

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * Get dashboard statistics
   */
  query_stats: () => {
    const db = getDb();
    
    // Total count
    const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
    
    // By status
    const byStatus = {};
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM jobs 
      GROUP BY status
    `).all();
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }
    
    // By priority
    const byPriority = {};
    const priorityRows = db.prepare(`
      SELECT priority, COUNT(*) as count 
      FROM jobs 
      GROUP BY priority
    `).all();
    for (const row of priorityRows) {
      byPriority[row.priority] = row.count;
    }
    
    // By materials status
    const byMaterials = {};
    const materialsRows = db.prepare(`
      SELECT materials, COUNT(*) as count 
      FROM jobs 
      GROUP BY materials
    `).all();
    for (const row of materialsRows) {
      byMaterials[row.materials || '⬜ None'] = row.count;
    }
    
    // Pending tasks count
    let pendingTasks = 0;
    try {
      const tasksPath = getTasksPath();
      if (fs.existsSync(tasksPath)) {
        pendingTasks = fs.readdirSync(tasksPath).filter(f => f.endsWith('.json')).length;
      }
    } catch (e) {
      // Ignore errors
    }
    
    // Added today
    const addedToday = db.prepare(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE date(created_at) = date('now')
    `).get().count;
    
    // Added this week
    const addedThisWeek = db.prepare(`
      SELECT COUNT(*) as count 
      FROM jobs 
      WHERE created_at > datetime('now', '-7 days')
    `).get().count;
    
    return {
      total,
      by_status: byStatus,
      by_priority: byPriority,
      by_materials: byMaterials,
      pending_tasks: pendingTasks,
      added_today: addedToday,
      added_this_week: addedThisWeek
    };
  },

  /**
   * Find job by company name
   */
  query_by_company: ({ company_name, fuzzy = false }) => {
    const job = findByCompany(company_name, fuzzy);
    
    if (!job) {
      return { 
        found: false, 
        company_name,
        job: null
      };
    }
    
    return {
      found: true,
      company_name,
      job,
      match_type: job._relevance !== undefined ? 'fuzzy' : 'exact',
      relevance: job._relevance
    };
  },

  /**
   * Get jobs needing research
   */
  query_needs_research: ({ limit = 50, priority = null }) => {
    const jobs = getJobsNeedingResearch({ limit, priority });
    
    return {
      jobs,
      count: jobs.length,
      filter: { priority }
    };
  },

  /**
   * Get high priority jobs
   */
  query_high_priority: ({ limit = 50, status = null }) => {
    const jobs = getHighPriorityJobs({ limit, status });
    
    return {
      jobs,
      count: jobs.length,
      filter: { status }
    };
  }
};

export default { toolDefinitions, handlers };
