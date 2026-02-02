/**
 * Research Tools
 * 
 * MCP tools for managing company research notes.
 * Handles saving research to database and syncing to markdown files.
 * 
 * Tools:
 * - research_get: Get research notes for a job
 * - research_save: Save completed research
 * - research_save_batch: Save research for multiple jobs
 * - research_template: Get the research template
 * 
 * @module tools/research
 */

import { join } from 'path';
import { 
  getDb, 
  slugify, 
  getApplicationsPath, 
  ensureDir, 
  writeTextFile,
  readTextFile
} from '../lib/db.js';
import { emit } from '../lib/event-emitter.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to research template
const TEMPLATE_PATH = join(__dirname, '../../RESEARCH-TEMPLATE.md');

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'research_get',
    description: 'Get research notes for a job. Returns the markdown research content if it exists.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to get research for'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'research_save',
    description: 'Save completed research notes for a job. Updates the database and syncs to markdown file. Optionally logs token usage.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to save research for'
        },
        research_notes: {
          type: 'string',
          description: 'The research notes in markdown format (use RESEARCH-TEMPLATE.md structure)'
        },
        log_tokens: {
          type: 'object',
          description: 'Optional token usage to log',
          properties: {
            input: { type: 'number', description: 'Input tokens used' },
            output: { type: 'number', description: 'Output tokens used' },
            model: { type: 'string', description: 'Model used (e.g., "claude-sonnet-4-20250514")' }
          }
        }
      },
      required: ['job_id', 'research_notes']
    }
  },
  {
    name: 'research_save_batch',
    description: 'Save research notes for multiple jobs at once. Useful when researching several companies in one session.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of job research items to save',
          items: {
            type: 'object',
            properties: {
              job_id: { type: 'number', description: 'Job ID' },
              research_notes: { type: 'string', description: 'Research notes markdown' }
            },
            required: ['job_id', 'research_notes']
          }
        },
        log_tokens: {
          type: 'object',
          description: 'Optional token usage to log for the entire batch',
          properties: {
            input: { type: 'number' },
            output: { type: 'number' },
            model: { type: 'string' }
          }
        }
      },
      required: ['items']
    }
  },
  {
    name: 'research_template',
    description: 'Get the research template markdown. Use this to understand the expected structure for research notes.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

/**
 * Sync research notes to markdown file
 * @param {string} company - Company name
 * @param {string} content - Research notes content
 */
function syncToFile(company, content) {
  const applicationsPath = getApplicationsPath();
  const companySlug = slugify(company);
  const companyDir = join(applicationsPath, companySlug);
  
  ensureDir(companyDir);
  writeTextFile(join(companyDir, 'notes.md'), content);
}

/**
 * Detect materials status based on what content exists
 * @param {Object} job - Job object
 * @returns {string} Materials status emoji
 */
function detectMaterialsStatus(job) {
  const hasNotes = job.research_notes && job.research_notes.trim().length > 0;
  const hasCoverLetter = job.cover_letter_content && job.cover_letter_content.trim().length > 0;
  const hasEmail = job.email_content && job.email_content.trim().length > 0;
  
  if (hasCoverLetter && hasEmail && hasNotes) return '✅ Full';
  if (hasCoverLetter && hasEmail) return '📝 Materials';
  if (hasNotes) return '🔍 Research';
  return '⬜ None';
}

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * Get research notes for a job
   */
  research_get: ({ job_id }) => {
    const db = getDb();
    const job = db.prepare('SELECT company, research_notes FROM jobs WHERE id = ?').get(job_id);
    
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    return {
      job_id,
      company: job.company,
      research_notes: job.research_notes || null,
      has_research: !!(job.research_notes && job.research_notes.trim().length > 0)
    };
  },

  /**
   * Save research notes for a job
   */
  research_save: ({ job_id, research_notes, log_tokens = null }) => {
    const db = getDb();
    
    // Get existing job
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    // Update database
    db.prepare(`
      UPDATE jobs 
      SET research_notes = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(research_notes, job_id);
    
    // Get updated job to detect materials status
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    const materialsStatus = detectMaterialsStatus(updatedJob);
    
    // Update materials status
    db.prepare('UPDATE jobs SET materials = ? WHERE id = ?').run(materialsStatus, job_id);
    
    // Sync to file
    syncToFile(job.company, research_notes);
    
    // Log tokens if provided
    if (log_tokens) {
      // Token logging handled by tokens module - emit event for it
      emit('research.saved', { 
        job_id, 
        company: job.company,
        tokens: log_tokens
      });
    } else {
      emit('research.saved', { 
        job_id, 
        company: job.company
      });
    }
    
    return {
      success: true,
      job_id,
      company: job.company,
      materials_status: materialsStatus,
      tokens_logged: !!log_tokens
    };
  },

  /**
   * Save research for multiple jobs
   */
  research_save_batch: ({ items, log_tokens = null }) => {
    const db = getDb();
    const results = [];
    let savedCount = 0;
    
    for (const item of items) {
      const { job_id, research_notes } = item;
      
      // Get existing job
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
      if (!job) {
        results.push({ job_id, success: false, error: 'Job not found' });
        continue;
      }
      
      // Update database
      db.prepare(`
        UPDATE jobs 
        SET research_notes = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(research_notes, job_id);
      
      // Get updated job to detect materials status
      const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
      const materialsStatus = detectMaterialsStatus(updatedJob);
      
      // Update materials status
      db.prepare('UPDATE jobs SET materials = ? WHERE id = ?').run(materialsStatus, job_id);
      
      // Sync to file
      syncToFile(job.company, research_notes);
      
      // Emit event
      emit('research.saved', { 
        job_id, 
        company: job.company
      });
      
      results.push({
        job_id,
        company: job.company,
        success: true,
        materials_status: materialsStatus
      });
      savedCount++;
    }
    
    return {
      success: true,
      saved_count: savedCount,
      total: items.length,
      results,
      tokens_logged: !!log_tokens
    };
  },

  /**
   * Get the research template
   */
  research_template: () => {
    const template = readTextFile(TEMPLATE_PATH, '');
    
    if (!template) {
      return {
        error: 'Template not found',
        template: null
      };
    }
    
    return {
      template,
      path: TEMPLATE_PATH
    };
  }
};

export default { toolDefinitions, handlers };
