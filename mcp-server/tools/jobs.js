/**
 * Jobs Tools
 * 
 * MCP tools for managing job records in the database.
 * Provides CRUD operations, bulk updates, and fuzzy search.
 * 
 * Tools:
 * - jobs_list: Get jobs with filtering and pagination
 * - jobs_get: Get a single job by ID
 * - jobs_create: Create a new job
 * - jobs_update: Update job fields
 * - jobs_delete: Delete a job (adds to rejected list)
 * - jobs_bulk_update: Update multiple jobs at once
 * - jobs_search: Fuzzy search across jobs
 * 
 * @module tools/jobs
 */

import { getDb, slugify, getApplicationsPath, ensureDir, getRejectedPath, readJsonFile, writeJsonFile } from '../lib/db.js';
import { emit } from '../lib/event-emitter.js';
import { searchJobs } from '../lib/fuzzy-search.js';
import { join } from 'path';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'jobs_list',
    description: 'Get jobs from the database with optional filtering and pagination. Returns job summaries sorted by priority and creation date.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status (e.g., "Not Started", "Applied", "Interviewing")',
          enum: ['Not Started', 'Researching', 'Ready to Apply', 'Applied', 'Interviewing', 'Done']
        },
        priority: {
          type: 'string',
          description: 'Filter by priority',
          enum: ['🔴 High', '🟡 Medium', '🟢 Lower']
        },
        materials_status: {
          type: 'string',
          description: 'Filter by materials status',
          enum: ['⬜ None', '🔍 Research', '📝 Materials', '✅ Full']
        },
        source: {
          type: 'string',
          description: 'Filter by source (e.g., "LinkedIn", "Cold Outreach")'
        },
        only_new: {
          type: 'boolean',
          description: 'Only return jobs from the latest search batch or created in last 12h'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of jobs to return (default: 50)',
          default: 50
        },
        offset: {
          type: 'number',
          description: 'Number of jobs to skip for pagination (default: 0)',
          default: 0
        }
      }
    }
  },
  {
    name: 'jobs_get',
    description: 'Get a single job by ID, including all content fields (research notes, cover letter, email).',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to retrieve'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'jobs_create',
    description: 'Create a new job opportunity in the database. Returns the new job ID.',
    inputSchema: {
      type: 'object',
      properties: {
        company: {
          type: 'string',
          description: 'Company name (required)'
        },
        role: {
          type: 'string',
          description: 'Job role/title (required)'
        },
        priority: {
          type: 'string',
          description: 'Priority level (default: 🟢 Lower)',
          enum: ['🔴 High', '🟡 Medium', '🟢 Lower'],
          default: '🟢 Lower'
        },
        type: {
          type: 'string',
          description: 'Work type (e.g., "Fractional", "Contract", "Full-time")'
        },
        hours_week: {
          type: 'string',
          description: 'Hours per week (e.g., "10-20")'
        },
        compensation: {
          type: 'string',
          description: 'Compensation details (e.g., "$6,000/mo")'
        },
        location: {
          type: 'string',
          description: 'Location (e.g., "Remote", "San Francisco")'
        },
        source: {
          type: 'string',
          description: 'Where the job was found (e.g., "LinkedIn", "Cold Outreach")'
        },
        apply_url: {
          type: 'string',
          description: 'URL to apply for the job'
        },
        status: {
          type: 'string',
          description: 'Initial status (default: Not Started)',
          enum: ['Not Started', 'Researching', 'Ready to Apply', 'Applied', 'Interviewing', 'Done'],
          default: 'Not Started'
        }
      },
      required: ['company', 'role']
    }
  },
  {
    name: 'jobs_update',
    description: 'Update fields on an existing job. Only provided fields are updated.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to update'
        },
        status: {
          type: 'string',
          description: 'New status',
          enum: ['Not Started', 'Researching', 'Ready to Apply', 'Applied', 'Interviewing', 'Done']
        },
        priority: {
          type: 'string',
          description: 'New priority',
          enum: ['🔴 High', '🟡 Medium', '🟢 Lower']
        },
        materials: {
          type: 'string',
          description: 'Materials status',
          enum: ['⬜ None', '🔍 Research', '📝 Materials', '✅ Full']
        },
        type: { type: 'string', description: 'Work type' },
        hours_week: { type: 'string', description: 'Hours per week' },
        compensation: { type: 'string', description: 'Compensation' },
        location: { type: 'string', description: 'Location' },
        source: { type: 'string', description: 'Source' },
        apply_url: { type: 'string', description: 'Apply URL' },
        applied_date: { type: 'string', description: 'Date applied (ISO format)' },
        follow_up_date: { type: 'string', description: 'Follow-up date (ISO format)' }
      },
      required: ['job_id']
    }
  },
  {
    name: 'jobs_delete',
    description: 'Delete a job from the database. The company is added to the rejected list to prevent re-adding.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to delete'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'jobs_bulk_update',
    description: 'Update multiple jobs at once with the same field values. Useful for batch status changes.',
    inputSchema: {
      type: 'object',
      properties: {
        job_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of job IDs to update'
        },
        updates: {
          type: 'object',
          description: 'Fields to update on all jobs',
          properties: {
            status: { type: 'string' },
            priority: { type: 'string' },
            materials: { type: 'string' }
          }
        }
      },
      required: ['job_ids', 'updates']
    }
  },
  {
    name: 'jobs_search',
    description: 'Fuzzy search across jobs by company name, role, or research notes. Returns relevance-scored results.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "AI startup", "series A")'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to search (default: company, role, research_notes, source)',
          default: ['company', 'role', 'research_notes', 'source']
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 20)',
          default: 20
        }
      },
      required: ['query']
    }
  }
];

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * List jobs with filtering and pagination
   */
  jobs_list: ({ status, priority, materials_status, source, only_new, limit = 50, offset = 0 }) => {
    const db = getDb();
    
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (materials_status) {
      query += ' AND materials = ?';
      params.push(materials_status);
    }
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    // Get latest batch ID for "only_new" filter
    if (only_new) {
      const latestBatch = db.prepare('SELECT value FROM metadata WHERE key = ?').get('latest_batch_id');
      const latestBatchId = latestBatch?.value;
      
      if (latestBatchId) {
        query += ' AND (search_batch_id = ? OR created_at > datetime("now", "-12 hours"))';
        params.push(latestBatchId);
      } else {
        query += ' AND created_at > datetime("now", "-12 hours")';
      }
    }
    
    // Count total before pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const total = db.prepare(countQuery).get(...params).count;
    
    // Add ordering and pagination
    query += ` ORDER BY 
      CASE priority WHEN '🔴 High' THEN 1 WHEN '🟡 Medium' THEN 2 WHEN '🟢 Lower' THEN 3 END,
      created_at DESC
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const jobs = db.prepare(query).all(...params);
    
    // Add isNew flag
    const now = new Date();
    const jobsWithFlags = jobs.map(job => {
      const createdAt = new Date(job.created_at);
      const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
      return {
        ...job,
        is_new: hoursSinceCreated < 12
      };
    });
    
    return {
      jobs: jobsWithFlags,
      total,
      has_more: offset + jobs.length < total,
      limit,
      offset
    };
  },

  /**
   * Get a single job by ID
   */
  jobs_get: ({ job_id }) => {
    const db = getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    return job;
  },

  /**
   * Create a new job
   */
  jobs_create: ({ company, role, priority = '🟢 Lower', type, hours_week, compensation, location, source, apply_url, status = 'Not Started' }) => {
    const db = getDb();
    const companySlug = slugify(company);
    
    // Check if job already exists for this company
    const existing = db.prepare('SELECT id FROM jobs WHERE LOWER(company) = LOWER(?)').get(company);
    if (existing) {
      return { 
        error: 'Job already exists for this company',
        existing_job_id: existing.id,
        company
      };
    }
    
    const insert = db.prepare(`
      INSERT INTO jobs (
        status, priority, company, role, type, hours_week, compensation,
        location, source, materials, cover_letter, email, notes, apply_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insert.run(
      status,
      priority,
      company,
      role,
      type || null,
      hours_week || null,
      compensation || null,
      location || null,
      source || null,
      '⬜ None',
      `applications/${companySlug}/cover-letter.md`,
      `applications/${companySlug}/email.md`,
      `applications/${companySlug}/notes.md`,
      apply_url || null
    );
    
    const jobId = result.lastInsertRowid;
    
    // Emit event
    emit('job.created', { 
      job_id: jobId, 
      company, 
      role,
      priority,
      source
    });
    
    return { 
      job_id: Number(jobId),
      company,
      role
    };
  },

  /**
   * Update job fields
   */
  jobs_update: ({ job_id, ...updates }) => {
    const db = getDb();
    
    // Check job exists
    const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!existing) {
      return { error: 'Job not found', job_id };
    }
    
    const allowedFields = [
      'status', 'priority', 'company', 'role', 'type', 'hours_week',
      'compensation', 'location', 'source', 'materials', 'apply_url',
      'applied_date', 'follow_up_date'
    ];
    
    const setters = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setters.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (setters.length === 0) {
      return { error: 'No valid fields to update' };
    }
    
    setters.push('updated_at = CURRENT_TIMESTAMP');
    params.push(job_id);
    
    const query = `UPDATE jobs SET ${setters.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...params);
    
    // Get updated job
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    
    // Emit event
    emit('job.updated', { 
      job_id, 
      changes: updates,
      company: job.company
    });
    
    return { 
      success: true,
      job
    };
  },

  /**
   * Delete a job
   */
  jobs_delete: ({ job_id }) => {
    const db = getDb();
    
    // Get job details first
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    // Delete from database
    db.prepare('DELETE FROM jobs WHERE id = ?').run(job_id);
    
    // Add to rejected list
    const rejectedPath = getRejectedPath();
    let rejected = readJsonFile(rejectedPath, { rejected: [] });
    
    if (!rejected.rejected.includes(job.company)) {
      rejected.rejected.push(job.company);
      rejected.notes = "Companies in this list won't be added again by automated job search";
      writeJsonFile(rejectedPath, rejected);
    }
    
    // Emit event
    emit('job.deleted', { 
      job_id, 
      company: job.company,
      role: job.role
    });
    
    return { 
      success: true,
      company: job.company,
      added_to_rejected: true
    };
  },

  /**
   * Bulk update multiple jobs
   */
  jobs_bulk_update: ({ job_ids, updates }) => {
    const db = getDb();
    
    const allowedFields = ['status', 'priority', 'materials'];
    
    const setters = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setters.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (setters.length === 0) {
      return { error: 'No valid fields to update' };
    }
    
    setters.push('updated_at = CURRENT_TIMESTAMP');
    
    // Update each job
    const placeholders = job_ids.map(() => '?').join(',');
    const query = `UPDATE jobs SET ${setters.join(', ')} WHERE id IN (${placeholders})`;
    
    const result = db.prepare(query).run(...params, ...job_ids);
    
    // Emit events for each job
    for (const job_id of job_ids) {
      emit('job.updated', { job_id, changes: updates });
    }
    
    return {
      success: true,
      updated_count: result.changes
    };
  },

  /**
   * Fuzzy search jobs
   */
  jobs_search: ({ query, fields = null, limit = 20 }) => {
    return searchJobs(query, { fields, limit });
  }
};

export default { toolDefinitions, handlers };
