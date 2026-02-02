/**
 * Database Connection Layer
 * 
 * Provides a shared SQLite database connection for the MCP server.
 * Connects to the same database as the ProwlA Express server.
 * 
 * @module lib/db
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root (two levels up from lib/)
const PROJECT_ROOT = join(__dirname, '../..');

// Path to the shared SQLite database (same as Express server)
const DB_PATH = join(PROJECT_ROOT, 'server/jobs.db');

// Applications folder for file sync (materials storage)
const APPLICATIONS_PATH = join(PROJECT_ROOT, 'applications');

// Tasks folder for task queue
const TASKS_PATH = join(PROJECT_ROOT, 'tasks');

// Config paths
const CONFIG_PATH = join(PROJECT_ROOT, 'config/search.json');
const PROFILE_PATH = join(PROJECT_ROOT, 'config/profile.json');

// Rejected companies path
const REJECTED_PATH = join(PROJECT_ROOT, 'data/rejected-companies.json');

// Research template path
const TEMPLATE_PATH = join(PROJECT_ROOT, 'RESEARCH-TEMPLATE.md');

/**
 * Database singleton instance
 * Uses WAL mode for better concurrent access
 */
let db = null;

/**
 * Get or create the database connection
 * @returns {Database} SQLite database instance
 */
export function getDb() {
  if (!db) {
    db = new Database(DB_PATH, { 
      fileMustExist: true  // Database should already exist from Express server
    });
    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
  }
  return db;
}

/**
 * Close the database connection
 * Call this when shutting down the server
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Get the applications folder path
 * @returns {string} Absolute path to applications folder
 */
export function getApplicationsPath() {
  return APPLICATIONS_PATH;
}

/**
 * Get the tasks folder path
 * @returns {string} Absolute path to tasks folder
 */
export function getTasksPath() {
  return TASKS_PATH;
}

/**
 * Get the config file path
 * @returns {string} Absolute path to search-config.json
 */
export function getConfigPath() {
  return CONFIG_PATH;
}

/**
 * Get the rejected companies file path
 * @returns {string} Absolute path to rejected-companies.json
 */
export function getRejectedPath() {
  return REJECTED_PATH;
}

/**
 * Get the profile config file path
 * @returns {string} Absolute path to profile.json
 */
export function getProfilePath() {
  return PROFILE_PATH;
}

/**
 * Get the research template file path
 * @returns {string} Absolute path to RESEARCH-TEMPLATE.md
 */
export function getTemplatePath() {
  return TEMPLATE_PATH;
}

/**
 * Generate a company slug from company name
 * Used for file paths and task filenames
 * 
 * @param {string} companyName - The company name
 * @returns {string} URL-safe slug (e.g., "Acme AI" -> "acme-ai")
 */
export function slugify(companyName) {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path to ensure
 */
export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read a JSON file safely
 * @param {string} filePath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {*} Parsed JSON or default value
 */
export function readJsonFile(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultValue;
}

/**
 * Write a JSON file
 * @param {string} filePath - Path to JSON file
 * @param {*} data - Data to write
 */
export function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Read a text file safely
 * @param {string} filePath - Path to text file
 * @param {string} defaultValue - Default value if file doesn't exist
 * @returns {string} File contents or default value
 */
export function readTextFile(filePath, defaultValue = '') {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return defaultValue;
}

/**
 * Write a text file
 * @param {string} filePath - Path to text file
 * @param {string} content - Content to write
 */
export function writeTextFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {boolean} True if file exists
 */
export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * Delete a file if it exists
 * @param {string} filePath - Path to delete
 * @returns {boolean} True if file was deleted
 */
export function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.error(`Error deleting ${filePath}:`, e.message);
  }
  return false;
}

/**
 * List files in a directory
 * @param {string} dirPath - Directory path
 * @param {string} extension - Optional file extension filter (e.g., '.json')
 * @returns {string[]} Array of filenames
 */
export function listFiles(dirPath, extension = null) {
  try {
    if (fs.existsSync(dirPath)) {
      let files = fs.readdirSync(dirPath);
      if (extension) {
        files = files.filter(f => f.endsWith(extension));
      }
      return files;
    }
  } catch (e) {
    console.error(`Error listing ${dirPath}:`, e.message);
  }
  return [];
}

export default {
  getDb,
  closeDb,
  getApplicationsPath,
  getTasksPath,
  getConfigPath,
  getProfilePath,
  getTemplatePath,
  getRejectedPath,
  slugify,
  ensureDir,
  readJsonFile,
  writeJsonFile,
  readTextFile,
  writeTextFile,
  fileExists,
  deleteFile,
  listFiles
};
