/**
 * Fuzzy Search Module
 * 
 * Provides fuzzy text matching for searching jobs by company name,
 * role, or content in research notes.
 * 
 * Uses Fuse.js for fuzzy matching with configurable thresholds.
 * 
 * @module lib/fuzzy-search
 */

import Fuse from 'fuse.js';
import { getDb } from './db.js';

/**
 * Default Fuse.js options for job search
 */
const DEFAULT_FUSE_OPTIONS = {
  // Include score in results (lower is better match)
  includeScore: true,
  
  // Fuzzy matching threshold (0.0 = exact, 1.0 = match anything)
  threshold: 0.4,
  
  // Don't require matches at the beginning
  ignoreLocation: true,
  
  // Min characters before matching starts
  minMatchCharLength: 2,
  
  // Fields to search and their weights
  keys: [
    { name: 'company', weight: 2.0 },    // Company name most important
    { name: 'role', weight: 1.5 },       // Role title second
    { name: 'research_notes', weight: 0.5 },  // Notes for context
    { name: 'source', weight: 0.3 }      // Source has low weight
  ]
};

/**
 * Search jobs with fuzzy matching
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string[]} options.fields - Fields to search (default: all)
 * @param {number} options.limit - Max results (default: 20)
 * @param {number} options.threshold - Match threshold (default: 0.4)
 * @returns {Object} Search results
 */
export function searchJobs(query, { fields = null, limit = 20, threshold = 0.4 } = {}) {
  const db = getDb();
  
  // Get all jobs from database
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC').all();
  
  if (jobs.length === 0) {
    return { jobs: [], total: 0 };
  }

  // Configure Fuse options
  const fuseOptions = {
    ...DEFAULT_FUSE_OPTIONS,
    threshold
  };

  // If specific fields requested, filter keys
  if (fields && fields.length > 0) {
    fuseOptions.keys = DEFAULT_FUSE_OPTIONS.keys.filter(k => 
      fields.includes(k.name)
    );
    
    // If no valid fields, use company and role as fallback
    if (fuseOptions.keys.length === 0) {
      fuseOptions.keys = [
        { name: 'company', weight: 2.0 },
        { name: 'role', weight: 1.5 }
      ];
    }
  }

  // Create Fuse instance
  const fuse = new Fuse(jobs, fuseOptions);

  // Search
  const results = fuse.search(query);

  // Format results
  const formattedResults = results.slice(0, limit).map(result => ({
    ...result.item,
    _score: result.score,
    _relevance: Math.round((1 - result.score) * 100) // Convert to 0-100 relevance
  }));

  return {
    jobs: formattedResults,
    total: results.length,
    query,
    fields_searched: fuseOptions.keys.map(k => k.name)
  };
}

/**
 * Find a job by exact or fuzzy company name match
 * 
 * First tries exact match, then falls back to fuzzy.
 * 
 * @param {string} companyName - Company name to find
 * @param {boolean} fuzzy - Allow fuzzy matching (default: false)
 * @returns {Object|null} Job or null if not found
 */
export function findByCompany(companyName, fuzzy = false) {
  const db = getDb();
  
  // Try exact match first (case-insensitive)
  const exactMatch = db.prepare(
    'SELECT * FROM jobs WHERE LOWER(company) = LOWER(?) LIMIT 1'
  ).get(companyName);
  
  if (exactMatch) {
    return exactMatch;
  }

  // If not fuzzy mode, return null
  if (!fuzzy) {
    return null;
  }

  // Try fuzzy match
  const results = searchJobs(companyName, {
    fields: ['company'],
    limit: 1,
    threshold: 0.3  // Stricter threshold for company matching
  });

  if (results.jobs.length > 0 && results.jobs[0]._relevance >= 70) {
    return results.jobs[0];
  }

  return null;
}

/**
 * Search jobs containing specific keywords in research notes
 * 
 * @param {string} keyword - Keyword to search for
 * @param {number} limit - Max results
 * @returns {Object[]} Jobs containing the keyword
 */
export function searchResearchNotes(keyword, limit = 20) {
  const db = getDb();
  
  // Use SQL LIKE for basic keyword search in notes
  const jobs = db.prepare(`
    SELECT * FROM jobs 
    WHERE research_notes LIKE ? 
    ORDER BY updated_at DESC 
    LIMIT ?
  `).all(`%${keyword}%`, limit);
  
  return jobs;
}

/**
 * Get jobs that need research (no research notes)
 * 
 * @param {Object} options - Filter options
 * @param {number} options.limit - Max results
 * @param {string} options.priority - Filter by priority
 * @returns {Object[]} Jobs without research
 */
export function getJobsNeedingResearch({ limit = 50, priority = null } = {}) {
  const db = getDb();
  
  let query = `
    SELECT * FROM jobs 
    WHERE (research_notes IS NULL OR research_notes = '')
    AND (materials IS NULL OR materials = '⬜ None' OR materials = '')
  `;
  
  const params = [];
  
  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }
  
  query += ' ORDER BY CASE priority WHEN \'🔴 High\' THEN 1 WHEN \'🟡 Medium\' THEN 2 WHEN \'🟢 Lower\' THEN 3 END, created_at DESC';
  query += ' LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
}

/**
 * Get high priority jobs
 * 
 * @param {Object} options - Filter options
 * @param {number} options.limit - Max results
 * @param {string} options.status - Filter by status
 * @returns {Object[]} High priority jobs
 */
export function getHighPriorityJobs({ limit = 50, status = null } = {}) {
  const db = getDb();
  
  let query = `SELECT * FROM jobs WHERE priority = '🔴 High'`;
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(query).all(...params);
}

export default {
  searchJobs,
  findByCompany,
  searchResearchNotes,
  getJobsNeedingResearch,
  getHighPriorityJobs
};
