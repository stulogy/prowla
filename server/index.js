import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { logTokenUsage, getTokenUsage, parseSessionTokens } from './token-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Ensure database is created with proper write permissions
const dbPath = join(__dirname, 'jobs.db');
console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath, { 
  verbose: console.log,
  fileMustExist: false 
});

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Middleware
app.use(cors());
app.use(express.json());

// Serve applications folder statically for PDFs
app.use('/applications', express.static(join(__dirname, '../applications')));

// Optional: Export database to CSV (for backup)
function exportToCSV() {
  // CSV export disabled in open source version
  // Uncomment below if you want CSV backup functionality
  /*
  const csvPath = join(__dirname, '../data/jobs-backup.csv');
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY id').all();
  
  const headers = 'Status,Priority,Company,Role,Type,Hours/Week,Compensation,Location,Source,Materials,Apply URL';
  const rows = jobs.map(job => {
    return [
      job.status || '',
      job.priority || '',
      job.company || '',
      job.role || '',
      job.type || '',
      job.hours_week || '',
      job.compensation || '',
      job.location || '',
      job.source || '',
      job.materials || '',
      job.apply_url || ''
    ].join(',');
  });
  
  const csvContent = [headers, ...rows].join('\n');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('✅ Exported to CSV');
  */
}

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'Not Started',
    priority TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    type TEXT,
    hours_week TEXT,
    compensation TEXT,
    location TEXT,
    source TEXT,
    materials TEXT,
    cover_letter TEXT,
    email TEXT,
    notes TEXT,
    apply_url TEXT,
    applied_date TEXT,
    follow_up_date TEXT,
    search_batch_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add materials column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN materials TEXT`);
  console.log('✅ Added materials column');
} catch (e) {
  // Column already exists, ignore error
}

// Metadata table for tracking search batches
db.exec(`
  CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Check if database is empty and log startup message
const count = db.prepare('SELECT COUNT(*) as count FROM jobs').get();
if (count.count === 0) {
  console.log('📋 Database is empty. Add jobs via the UI or API.');
} else {
  console.log(`📋 Loaded ${count.count} jobs from database.`);
}

// API Routes

// Helper to detect materials for a job
function detectMaterials(job) {
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const applicationsPath = join(__dirname, '../applications', companySlug);
  
  let hasNotes = false;
  let hasCoverLetter = false;
  let hasEmail = false;
  
  try {
    hasNotes = fs.existsSync(join(applicationsPath, 'notes.md'));
    hasCoverLetter = fs.existsSync(join(applicationsPath, 'cover-letter.md'));
    hasEmail = fs.existsSync(join(applicationsPath, 'email.md'));
  } catch (e) {
    // Ignore errors
  }
  
  if (hasCoverLetter && hasEmail && hasNotes) return '✅ Full';
  if (hasCoverLetter && hasEmail) return '📝 Materials';
  if (hasNotes) return '🔍 Research';
  return '⬜ None';
}

// GET all jobs
app.get('/api/jobs', (req, res) => {
  const { status, priority, source } = req.query;
  
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
  if (source) {
    query += ' AND source = ?';
    params.push(source);
  }
  
  query += ' ORDER BY CASE priority WHEN \'🔴 High\' THEN 1 WHEN \'🟡 Medium\' THEN 2 WHEN \'🟢 Lower\' THEN 3 END, created_at DESC';
  
  const jobs = db.prepare(query).all(...params);
  
  // Get latest batch ID to mark truly new jobs
  const latestBatchResult = db.prepare('SELECT value FROM metadata WHERE key = ?').get('latest_batch_id');
  const latestBatchId = latestBatchResult?.value;
  
  // Mark jobs from latest search batch OR created in last 12h as "isNew" and detect materials
  const now = new Date();
  const jobsWithNewFlag = jobs.map(job => {
    const createdAt = new Date(job.created_at);
    const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
    
    // Auto-detect materials if not set, null, empty, or default value
    const materialsStatus = (!job.materials || job.materials === '⬜ None' || job.materials === '') ? detectMaterials(job) : job.materials;
    
    return {
      ...job,
      materials: materialsStatus,
      isNewFromSearch: (job.search_batch_id && job.search_batch_id === latestBatchId) || (hoursSinceCreated < 12)
    };
  });
  
  res.json(jobsWithNewFlag);
});

// GET single job with full content
app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  // Auto-detect materials if needed
  if (!job.materials || job.materials === '⬜ None' || job.materials === '') {
    job.materials = detectMaterials(job);
  }
  
  res.json(job);
});

// Helper to sync content to files (for git tracking/backup)
function syncContentToFiles(job) {
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const applicationsPath = join(__dirname, '../applications', companySlug);
  
  try {
    fs.mkdirSync(applicationsPath, { recursive: true });
    
    if (job.cover_letter_content) {
      const coverPath = join(applicationsPath, 'cover-letter.md');
      fs.writeFileSync(coverPath, job.cover_letter_content, 'utf8');
    }
    
    if (job.email_content) {
      const emailPath = join(applicationsPath, 'email.md');
      fs.writeFileSync(emailPath, job.email_content, 'utf8');
    }
    
    if (job.research_notes) {
      const notesPath = join(applicationsPath, 'notes.md');
      fs.writeFileSync(notesPath, job.research_notes, 'utf8');
    }
    
    console.log(`✅ Synced files for ${job.company}`);
  } catch (e) {
    console.error(`❌ Error syncing files for ${job.company}:`, e.message);
  }
}

// POST new job
app.post('/api/jobs', (req, res) => {
  const {
    status, priority, company, role, type, hours_week, compensation,
    location, source, materials, cover_letter, email, notes, apply_url,
    cover_letter_content, email_content, research_notes
  } = req.body;
  
  const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  const insert = db.prepare(`
    INSERT INTO jobs (
      status, priority, company, role, type, hours_week, compensation, 
      location, source, materials, cover_letter, email, notes, apply_url,
      cover_letter_content, email_content, research_notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = insert.run(
    status || 'Not Started',
    priority || '🟢 Lower',
    company,
    role,
    type,
    hours_week,
    compensation,
    location,
    source,
    materials,
    cover_letter || `applications/${companySlug}/cover-letter.md`,
    email || `applications/${companySlug}/email.md`,
    notes || `applications/${companySlug}/notes.md`,
    apply_url,
    cover_letter_content,
    email_content,
    research_notes
  );
  
  // Sync content to files for backup/git tracking
  if (cover_letter_content || email_content || research_notes) {
    syncContentToFiles({
      company,
      cover_letter_content,
      email_content,
      research_notes
    });
  }
  
  exportToCSV();
  res.json({ id: result.lastInsertRowid });
});

// PATCH update job
app.patch('/api/jobs/:id', (req, res) => {
  const updates = [];
  const params = [];
  
  const allowedFields = [
    'status', 'priority', 'company', 'role', 'type', 'hours_week',
    'compensation', 'location', 'source', 'materials', 'cover_letter', 'email',
    'notes', 'apply_url', 'applied_date', 'follow_up_date',
    'cover_letter_content', 'email_content', 'research_notes'
  ];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.params.id);
  
  const query = `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);
  
  // Sync content to files if content fields were updated
  if (req.body.cover_letter_content || req.body.email_content || req.body.research_notes) {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
    if (job) {
      syncContentToFiles(job);
    }
  }
  
  exportToCSV();
  res.json({ success: true });
});

// DELETE job
app.delete('/api/jobs/:id', (req, res) => {
  // Get job details before deleting
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  
  // Delete from database
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  exportToCSV();
  
  // Add to rejected companies list so it doesn't reappear in future searches
  if (job) {
    try {
      const rejectedPath = join(__dirname, '../data/rejected-companies.json');
      let rejectedData = { rejected: [] };
      
      if (fs.existsSync(rejectedPath)) {
        rejectedData = JSON.parse(fs.readFileSync(rejectedPath, 'utf8'));
      }
      
      // Add company to rejected list if not already there
      if (!rejectedData.rejected.includes(job.company)) {
        rejectedData.rejected.push(job.company);
        rejectedData.notes = "Companies in this list won't be added again by the automated job search";
        fs.writeFileSync(rejectedPath, JSON.stringify(rejectedData, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('Error updating rejected companies:', e);
    }
  }
  
  res.json({ success: true });
});

// GET stats
app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  const applied = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = \'Done\' OR status = \'Applied\'').get().count;
  const interviewing = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = \'Interviewing\'').get().count;
  const notStarted = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = \'Not Started\'').get().count;
  
  res.json({ total, applied, interviewing, notStarted });
});

// GET job materials (cover letter, email, etc.)
app.get('/api/jobs/:id/materials', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const applicationsPath = join(__dirname, '../applications', companySlug);
  
  const materials = {};
  
  // Try to read cover letter
  try {
    const coverLetterPath = join(applicationsPath, 'cover-letter.md');
    if (fs.existsSync(coverLetterPath)) {
      materials.coverLetter = fs.readFileSync(coverLetterPath, 'utf8');
    }
  } catch (e) {}
  
  // Try to read email
  try {
    const emailPath = join(applicationsPath, 'email.md');
    if (fs.existsSync(emailPath)) {
      materials.email = fs.readFileSync(emailPath, 'utf8');
    }
  } catch (e) {}
  
  // Try to read notes
  try {
    const notesPath = join(applicationsPath, 'notes.md');
    if (fs.existsSync(notesPath)) {
      materials.notes = fs.readFileSync(notesPath, 'utf8');
    }
  } catch (e) {}
  
  // Check if PDF exists
  try {
    const pdfPath = join(applicationsPath, 'cover-letter.pdf');
    if (fs.existsSync(pdfPath)) {
      materials.coverLetterPdf = true;
    }
  } catch (e) {}
  
  res.json(materials);
});

// Get all companies with research notes
app.get('/api/research', (req, res) => {
  try {
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY company').all();
    const companiesWithResearch = [];
    
    jobs.forEach(job => {
      const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const notesPath = join(__dirname, '../applications', companySlug, 'notes.md');
      
      if (fs.existsSync(notesPath)) {
        const notes = fs.readFileSync(notesPath, 'utf8');
        companiesWithResearch.push({
          id: job.id,
          company: job.company,
          role: job.role,
          source: job.source,
          status: job.status,
          priority: job.priority,
          companySlug: companySlug,
          notes: notes,
          createdAt: job.created_at
        });
      }
    });
    
    res.json(companiesWithResearch);
  } catch (error) {
    console.error('Error fetching research:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get('/api/settings', (req, res) => {
  try {
    const settingsPath = join(__dirname, '../config/search.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      res.json({ settings });
    } else {
      // Return defaults
      res.json({
        settings: {
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
        }
      });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save settings
app.post('/api/settings', (req, res) => {
  try {
    const settingsPath = join(__dirname, '../config/search.json');
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2), 'utf8');
    console.log('✅ Settings saved');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get token usage stats
app.get('/api/tokens', (req, res) => {
  try {
    const { startDate, endDate, taskType } = req.query;
    const usage = getTokenUsage({ startDate, endDate, taskType });
    res.json(usage);
  } catch (error) {
    console.error('Error fetching token usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Log token usage manually (for testing or manual entries)
app.post('/api/tokens/log', (req, res) => {
  try {
    logTokenUsage(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error logging tokens:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get task status
app.get('/api/tasks/status', (req, res) => {
  try {
    const tasksDir = join(__dirname, '../tasks');
    const files = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
    const tasks = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const content = fs.readFileSync(join(tasksDir, f), 'utf8');
        return { ...JSON.parse(content), filename: f };
      });
    
    res.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('Error checking tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Complete/delete a task
app.delete('/api/tasks/:filename', (req, res) => {
  try {
    const tasksDir = join(__dirname, '../tasks');
    const taskPath = join(tasksDir, req.params.filename);
    
    if (fs.existsSync(taskPath)) {
      fs.unlinkSync(taskPath);
      console.log(`✅ Deleted task: ${req.params.filename}`);
      res.json({ success: true, message: 'Task completed' });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request company research
app.post('/api/jobs/:id/request-research', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const taskPath = join(__dirname, '../tasks', `research-${companySlug}.json`);
  
  // Check if task already exists
  if (fs.existsSync(taskPath)) {
    return res.json({ success: true, message: 'Research task already queued', exists: true });
  }
  
  // Create task file
  const task = {
    type: 'research',
    jobId: job.id,
    company: job.company,
    role: job.role,
    source: job.source,
    applyUrl: job.apply_url,
    notes: job.notes,
    companySlug: companySlug,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
  console.log(`📋 Created research task for ${job.company}`);
  
  res.json({ success: true, message: 'Research task queued', exists: false });
});

// Request application materials generation
app.post('/api/jobs/:id/request-materials', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const companySlug = job.company.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const taskPath = join(__dirname, '../tasks', `generate-materials-${companySlug}.json`);
  
  // Create task file
  const task = {
    type: 'materials',
    jobId: job.id,
    company: job.company,
    role: job.role,
    jobType: job.type,
    compensation: job.compensation,
    source: job.source,
    applyUrl: job.apply_url,
    notes: job.notes,
    companySlug: companySlug,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
  
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
  console.log(`📋 Created materials generation task for ${job.company}`);
  
  res.json({ success: true, message: 'Materials generation task queued' });
});

// Trigger job search (placeholder - implement your own search logic or use agents)
app.post('/api/search', async (req, res) => {
  // In the open source version, job search is handled by:
  // 1. Manual entry via the UI
  // 2. MCP tools called by AI agents
  // 3. Custom scripts you create
  
  res.json({ 
    success: true, 
    message: 'Job search triggered. Use MCP tools or add jobs manually.' 
  });
});

// Refresh data (re-detect materials, etc.)
app.post('/api/reload', (req, res) => {
  try {
    const jobs = db.prepare('SELECT * FROM jobs').all();
    let updated = 0;
    
    // Re-detect materials for all jobs
    jobs.forEach(job => {
      const materials = detectMaterials(job);
      if (materials !== job.materials) {
        db.prepare('UPDATE jobs SET materials = ? WHERE id = ?').run(materials, job.id);
        updated++;
      }
    });
    
    console.log(`🔄 Refreshed ${jobs.length} jobs (${updated} updated)`);
    res.json({ success: true, total: jobs.length, updated });
  } catch (error) {
    console.error('Reload error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 ProwlA API running on http://localhost:${PORT}`);
});
