/**
 * Tasks Tools
 * 
 * MCP tools for managing the task queue. Tasks are file-based and
 * represent pending work for agents (research, materials generation).
 * 
 * Implements task locking to prevent multiple agents from claiming
 * the same task.
 * 
 * Tools:
 * - tasks_list: Get pending/in-progress tasks
 * - tasks_get: Get a specific task
 * - tasks_claim: Lock a task for processing
 * - tasks_release: Release a claimed task
 * - tasks_complete: Mark task done and delete
 * - tasks_create_research: Queue research for a job
 * - tasks_create_materials: Queue materials generation
 * 
 * @module tools/tasks
 */

import { getDb, slugify, getTasksPath } from '../lib/db.js';
import { 
  listTasksSync, 
  getTask, 
  claimTask, 
  releaseTask, 
  completeTask, 
  createTask 
} from '../lib/task-lock.js';
import { emit } from '../lib/event-emitter.js';

/**
 * Tool definitions for MCP registration
 */
export const toolDefinitions = [
  {
    name: 'tasks_list',
    description: 'Get all pending and in-progress tasks. Optionally filter by type or status. Stale locks (>30min) are treated as pending.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by task type',
          enum: ['research', 'materials']
        },
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['pending', 'in_progress']
        },
        include_stale: {
          type: 'boolean',
          description: 'Treat stale in_progress tasks as pending (default: true)',
          default: true
        }
      }
    }
  },
  {
    name: 'tasks_get',
    description: 'Get details of a specific task by filename.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Task filename (e.g., "research-acme.json")'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'tasks_claim',
    description: 'Claim a task for processing (acquire lock). Updates the task file to mark it as in_progress. Fails if already claimed by another agent (unless stale).',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Task filename to claim'
        },
        agent_id: {
          type: 'string',
          description: 'Optional identifier for the claiming agent'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'tasks_release',
    description: 'Release a claimed task (release lock). Use this if processing fails mid-way. Sets status back to pending.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Task filename to release'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'tasks_complete',
    description: 'Mark a task as complete and delete the task file. Call this after successfully processing the task.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Task filename to complete'
        },
        log_tokens: {
          type: 'object',
          description: 'Optional token usage to log for this task',
          properties: {
            input: { type: 'number' },
            output: { type: 'number' },
            model: { type: 'string' }
          }
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'tasks_create_research',
    description: 'Queue a research task for a job. Creates a task file that agents will pick up during heartbeat.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to research'
        }
      },
      required: ['job_id']
    }
  },
  {
    name: 'tasks_create_materials',
    description: 'Queue a materials generation task for a job (cover letter + email). Creates a task file.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'number',
          description: 'The job ID to generate materials for'
        }
      },
      required: ['job_id']
    }
  }
];

/**
 * Handler implementations
 */
export const handlers = {
  /**
   * List all tasks
   */
  tasks_list: ({ type = null, status = null, include_stale = true }) => {
    const tasks = listTasksSync({ 
      type, 
      status, 
      includeStale: include_stale 
    });
    
    return {
      tasks,
      count: tasks.length
    };
  },

  /**
   * Get a specific task
   */
  tasks_get: ({ filename }) => {
    const task = getTask(filename);
    
    if (!task) {
      return { error: 'Task not found', filename };
    }
    
    task.filename = filename;
    return task;
  },

  /**
   * Claim a task
   */
  tasks_claim: ({ filename, agent_id = null }) => {
    const result = claimTask(filename, agent_id);
    
    if (result.success) {
      // Emit event
      emit('task.claimed', {
        filename,
        agent_id,
        job_id: result.task.jobId || result.task.job_id,
        company: result.task.company
      });
    }
    
    return result;
  },

  /**
   * Release a task
   */
  tasks_release: ({ filename }) => {
    return releaseTask(filename);
  },

  /**
   * Complete a task
   */
  tasks_complete: ({ filename, log_tokens = null }) => {
    // Get task details before completing
    const task = getTask(filename);
    
    const result = completeTask(filename);
    
    if (result.success && task) {
      // Emit event
      emit('task.completed', {
        filename,
        type: task.type,
        job_id: task.jobId || task.job_id,
        company: task.company,
        tokens: log_tokens
      });
    }
    
    return result;
  },

  /**
   * Create a research task
   */
  tasks_create_research: ({ job_id }) => {
    const db = getDb();
    
    // Get job details
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    const companySlug = slugify(job.company);
    const filename = `research-${companySlug}.json`;
    
    const taskData = {
      type: 'research',
      jobId: job.id,
      job_id: job.id, // Include both for compatibility
      company: job.company,
      role: job.role,
      source: job.source,
      applyUrl: job.apply_url,
      apply_url: job.apply_url,
      notes: job.notes,
      companySlug
    };
    
    const result = createTask(taskData, filename);
    
    if (result.success && !result.already_exists) {
      // Emit event
      emit('task.created', {
        filename,
        type: 'research',
        job_id: job.id,
        company: job.company
      });
    }
    
    return {
      ...result,
      job_id: job.id,
      company: job.company
    };
  },

  /**
   * Create a materials task
   */
  tasks_create_materials: ({ job_id }) => {
    const db = getDb();
    
    // Get job details
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id);
    if (!job) {
      return { error: 'Job not found', job_id };
    }
    
    const companySlug = slugify(job.company);
    const filename = `generate-materials-${companySlug}.json`;
    
    const taskData = {
      type: 'materials',
      jobId: job.id,
      job_id: job.id,
      company: job.company,
      role: job.role,
      jobType: job.type,
      job_type: job.type,
      compensation: job.compensation,
      source: job.source,
      applyUrl: job.apply_url,
      apply_url: job.apply_url,
      notes: job.notes,
      companySlug
    };
    
    const result = createTask(taskData, filename);
    
    if (result.success && !result.already_exists) {
      // Emit event
      emit('task.created', {
        filename,
        type: 'materials',
        job_id: job.id,
        company: job.company
      });
    }
    
    return {
      ...result,
      job_id: job.id,
      company: job.company
    };
  }
};

export default { toolDefinitions, handlers };
