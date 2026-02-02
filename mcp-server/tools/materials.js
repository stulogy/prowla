/**
 * Materials Tools
 * 
 * MCP tools for managing application materials (cover letters, emails).
 * Handles saving content to database and syncing to markdown files.
 * 
 * Tools:
 * - materials_get: Get all materials (research, cover letter, email) for a job
 * - materials_save_cover_letter: Save a cover letter
 * - materials_save_email: Save an outreach email
 * 
 * @module tools/materials
 */

import { join } from 'path';
import { 
  getDb, 
  slugify, 
  getApplicationsPath, 
  ensureDir, 
  writeTextFile 
} from '../lib/db.js';
import { emit } from '../lib/event-emitter.js';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'materials_get',
    description: 'Get all materials for a job: research notes, cover letter, and outreach email.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to get materials for'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'materials_save_cover_letter',
    description: 'Save a cover letter for a job. Updates the database and syncs to markdown file.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to save cover letter for'
        },
        content: {
          type: 'string',
          description: 'The cover letter content in markdown format'
        },
        log_tokens: {
          type: 'object',
          description: 'Optional token usage to log',
          properties: {
            input: { type: 'number', description: 'Input tokens used' },
            output: { type: 'number', description: 'Output tokens used' },
            model: { type: 'string', description: 'Model used' }
          }
        }
      },
      required: ['job_id', 'content']
    }
  },
  {
    name: 'materials_save_email',
    description: 'Save an outreach email for a job. Updates the database and syncs to markdown file.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to save email for'
        },
        content: {
          type: 'string',
          description: 'The outreach email content in markdown format'
        },
        log_tokens: {
          type: 'object',
          description: 'Optional token usage to log',
          properties: {
            input: { type: 'number', description: 'Input tokens used' },
            output: { type: 'number', description: 'Output tokens used' },
            model: { type: 'string', description: 'Model used' }
          }
        }
      },
      required: ['job_id', 'content']
    }
  }
];

/**
 * Sync content to markdown file
 * @param {string} company - Company name
 * @param {string} filename - File name (e.g., 'cover-letter.md', 'email.md')
 * @param {string} content - Content to write
 */
function syncToFile(company, filename, content) {
  const applicationsPath = getApplicationsPath();
  const companySlug = slugify(company);
  const companyDir = join(applicationsPath, companySlug);
  
  ensureDir(companyDir);
  writeTextFile(join(companyDir, filename), content);
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
   * Get all materials for a job
   */
  materials_get: ({ job_id }) => {
    const db = getDb();
    const job = db.prepare(`
      SELECT id, company, role, research_notes, cover_letter_content, email_content, materials
      FROM jobs WHERE id = ?
    `).get(job_id);
    
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    return {
      job_id,
      company: job.company,
      role: job.role,
      materials_status: job.materials,
      research_notes: job.research_notes || null,
      cover_letter: job.cover_letter_content || null,
      email: job.email_content || null,
      has_research: !!(job.research_notes && job.research_notes.trim().length > 0),
      has_cover_letter: !!(job.cover_letter_content && job.cover_letter_content.trim().length > 0),
      has_email: !!(job.email_content && job.email_content.trim().length > 0)
    };
  },

  /**
   * Save a cover letter
   */
  materials_save_cover_letter: ({ job_id, content, log_tokens = null }) => {
    const db = getDb();
    
    // Get existing job
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    // Update database
    db.prepare(`
      UPDATE jobs 
      SET cover_letter_content = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(content, job_id);
    
    // Get updated job to detect materials status
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    const materialsStatus = detectMaterialsStatus(updatedJob);
    
    // Update materials status
    db.prepare('UPDATE jobs SET materials = ? WHERE id = ?').run(materialsStatus, job_id);
    
    // Sync to file
    syncToFile(job.company, 'cover-letter.md', content);
    
    // Emit event
    emit('materials.saved', { 
      job_id, 
      company: job.company,
      type: 'cover_letter',
      tokens: log_tokens
    });
    
    return {
      success: true,
      job_id,
      company: job.company,
      materials_status: materialsStatus,
      tokens_logged: !!log_tokens
    };
  },

  /**
   * Save an outreach email
   */
  materials_save_email: ({ job_id, content, log_tokens = null }) => {
    const db = getDb();
    
    // Get existing job
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    // Update database
    db.prepare(`
      UPDATE jobs 
      SET email_content = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(content, job_id);
    
    // Get updated job to detect materials status
    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    const materialsStatus = detectMaterialsStatus(updatedJob);
    
    // Update materials status
    db.prepare('UPDATE jobs SET materials = ? WHERE id = ?').run(materialsStatus, job_id);
    
    // Sync to file
    syncToFile(job.company, 'email.md', content);
    
    // Emit event
    emit('materials.saved', { 
      job_id, 
      company: job.company,
      type: 'email',
      tokens: log_tokens
    });
    
    return {
      success: true,
      job_id,
      company: job.company,
      materials_status: materialsStatus,
      tokens_logged: !!log_tokens
    };
  }
};

export default { toolDefinitions, handlers };
