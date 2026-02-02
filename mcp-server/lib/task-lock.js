/**
 * Task Locking System
 * 
 * Provides locking mechanism for task queue to prevent multiple agents
 * from claiming the same task simultaneously.
 * 
 * Lock Implementation:
 * - When a task is claimed, the task file is updated with:
 *   - status: "in_progress"
 *   - claimed_at: ISO timestamp
 *   - claimed_by: agent identifier (optional)
 * 
 * - Stale locks (>30 minutes) can be auto-released
 * - Agents can manually release locks if processing fails
 * 
 * @module lib/task-lock
 */

import { join } from 'path';
import { 
  getTasksPath, 
  readJsonFile, 
  writeJsonFile, 
  fileExists,
  deleteFile 
} from './db.js';

// How long before a lock is considered stale (30 minutes)
const STALE_LOCK_MS = 30 * 60 * 1000;

/**
 * Check if a task lock is stale
 * @param {Object} task - Task object with claimed_at
 * @returns {boolean} True if lock is stale
 */
export function isLockStale(task) {
  if (!task.claimed_at) return false;
  const claimedAt = new Date(task.claimed_at).getTime();
  const now = Date.now();
  return (now - claimedAt) > STALE_LOCK_MS;
}

/**
 * Get a task by filename
 * @param {string} filename - Task filename (e.g., "research-acme.json")
 * @returns {Object|null} Task object or null if not found
 */
export function getTask(filename) {
  const taskPath = join(getTasksPath(), filename);
  return readJsonFile(taskPath, null);
}

import fs from 'fs';

/**
 * List all tasks (synchronous version)
 * @param {Object} options - Filter options
 * @returns {Object[]} Array of task objects
 */
export function listTasksSync({ type = null, status = null, includeStale = false } = {}) {
  const tasksPath = getTasksPath();
  
  let files = [];
  try {
    if (fs.existsSync(tasksPath)) {
      files = fs.readdirSync(tasksPath).filter(f => f.endsWith('.json'));
    }
  } catch (e) {
    console.error('Error listing tasks:', e.message);
    return [];
  }

  const tasks = [];
  for (const filename of files) {
    const task = getTask(filename);
    if (!task) continue;

    // Add filename to task object
    task.filename = filename;

    // Determine effective status (accounting for stale locks)
    let effectiveStatus = task.status || 'pending';
    if (includeStale && effectiveStatus === 'in_progress' && isLockStale(task)) {
      effectiveStatus = 'pending';
      task.is_stale = true;
    }

    // Apply filters
    if (type && task.type !== type) continue;
    if (status && effectiveStatus !== status) continue;

    tasks.push(task);
  }

  // Sort by createdAt (oldest first)
  tasks.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return aTime - bTime;
  });

  return tasks;
}

/**
 * Claim a task (acquire lock)
 * 
 * Updates the task file to mark it as in_progress with claim metadata.
 * Fails if task is already claimed (unless stale).
 * 
 * @param {string} filename - Task filename
 * @param {string} agentId - Optional agent identifier
 * @returns {Object} Result object
 * @returns {boolean} result.success - Whether claim succeeded
 * @returns {Object} result.task - Task object (if successful)
 * @returns {string} result.error - Error message (if failed)
 */
export function claimTask(filename, agentId = null) {
  const taskPath = join(getTasksPath(), filename);
  
  // Check if task exists
  if (!fileExists(taskPath)) {
    return { success: false, error: 'Task not found' };
  }

  const task = readJsonFile(taskPath);
  if (!task) {
    return { success: false, error: 'Failed to read task file' };
  }

  // Check if already claimed (and not stale)
  if (task.status === 'in_progress' && !isLockStale(task)) {
    return { 
      success: false, 
      error: 'Task already claimed',
      claimed_by: task.claimed_by,
      claimed_at: task.claimed_at
    };
  }

  // Claim the task
  const now = new Date().toISOString();
  task.status = 'in_progress';
  task.claimed_at = now;
  task.claimed_by = agentId;
  task.filename = filename;

  // Write updated task
  writeJsonFile(taskPath, task);

  return { 
    success: true, 
    task,
    locked: true,
    claimed_at: now
  };
}

/**
 * Release a task (release lock)
 * 
 * Sets the task back to pending status and clears claim metadata.
 * Use this if agent fails mid-processing.
 * 
 * @param {string} filename - Task filename
 * @returns {Object} Result object
 */
export function releaseTask(filename) {
  const taskPath = join(getTasksPath(), filename);
  
  if (!fileExists(taskPath)) {
    return { success: false, error: 'Task not found' };
  }

  const task = readJsonFile(taskPath);
  if (!task) {
    return { success: false, error: 'Failed to read task file' };
  }

  // Release the lock
  task.status = 'pending';
  delete task.claimed_at;
  delete task.claimed_by;

  writeJsonFile(taskPath, task);

  return { success: true };
}

/**
 * Complete a task (delete task file)
 * 
 * Called after agent has successfully processed the task.
 * Removes the task file from the queue.
 * 
 * @param {string} filename - Task filename
 * @returns {Object} Result object
 */
export function completeTask(filename) {
  const taskPath = join(getTasksPath(), filename);
  
  if (!fileExists(taskPath)) {
    return { success: false, error: 'Task not found' };
  }

  const deleted = deleteFile(taskPath);
  
  return { 
    success: deleted,
    error: deleted ? null : 'Failed to delete task file'
  };
}

/**
 * Create a new task
 * 
 * @param {Object} taskData - Task data
 * @param {string} filename - Task filename
 * @returns {Object} Result object
 */
export function createTask(taskData, filename) {
  const taskPath = join(getTasksPath(), filename);
  
  // Check if already exists
  if (fileExists(taskPath)) {
    return { 
      success: true, 
      already_exists: true,
      filename 
    };
  }

  // Add metadata
  const task = {
    ...taskData,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  writeJsonFile(taskPath, task);

  return { 
    success: true, 
    already_exists: false,
    filename 
  };
}

export default {
  isLockStale,
  getTask,
  listTasksSync,
  claimTask,
  releaseTask,
  completeTask,
  createTask
};
