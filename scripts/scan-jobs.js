#!/usr/bin/env node
/**
 * ProwlA Job Scanner
 * 
 * Scans configured job sources and adds opportunities to the database.
 * Reads configuration from config/sources.json (user-customizable).
 * 
 * Usage:
 *   node scripts/scan-jobs.js           # Scan all enabled RSS sources
 *   node scripts/scan-jobs.js --test    # Dry run, don't add to database
 *   node scripts/scan-jobs.js --list    # List configured sources
 * 
 * For browser-required sources (YC, LinkedIn, etc.), use your AI agent:
 *   "Scan YC Work at a Startup for design jobs and add them to my tracker"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { scrapeRSSSources, getBrowserSources } from './scrapers/rss-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.env.PROWLA_API || 'http://localhost:3001/api';

/**
 * Load scoring configuration
 */
function loadScoringConfig() {
  const configPath = path.join(__dirname, '../config/scoring.json');
  const examplePath = path.join(__dirname, '../config/scoring.example.json');
  
  const usePath = fs.existsSync(configPath) ? configPath : examplePath;
  if (!fs.existsSync(usePath)) return null;
  
  return JSON.parse(fs.readFileSync(usePath, 'utf8'));
}

/**
 * Load search preferences
 */
function loadSearchConfig() {
  const configPath = path.join(__dirname, '../config/search.json');
  const examplePath = path.join(__dirname, '../config/search.example.json');
  
  const usePath = fs.existsSync(configPath) ? configPath : examplePath;
  if (!fs.existsSync(usePath)) return null;
  
  return JSON.parse(fs.readFileSync(usePath, 'utf8'));
}

/**
 * Load sources configuration
 */
function loadSourcesConfig() {
  const configPath = path.join(__dirname, '../config/sources.json');
  const examplePath = path.join(__dirname, '../config/sources.example.json');
  
  const usePath = fs.existsSync(configPath) ? configPath : examplePath;
  if (!fs.existsSync(usePath)) return { sources: [], scanning: {}, scoring: {} };
  
  return JSON.parse(fs.readFileSync(usePath, 'utf8'));
}

/**
 * Simple job scoring based on user's search preferences
 */
function scoreJob(job, searchConfig) {
  if (!searchConfig) return { score: 50, reasons: ['No config, using default score'] };
  
  let score = 0;
  const reasons = [];
  
  const titleLower = (job.title || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  
  // Role match (25 points)
  const targetRoles = (searchConfig.targetRoles || []).map(r => r.toLowerCase());
  const roleMatch = targetRoles.some(role => titleLower.includes(role.toLowerCase()));
  if (roleMatch) {
    score += 25;
    reasons.push('✅ Role matches target');
  } else if (titleLower.includes('designer') || titleLower.includes('product')) {
    score += 15;
    reasons.push('✅ Related to target roles');
  }
  
  // Keyword match (20 points)
  const keywords = searchConfig.keywords || [];
  const keywordMatches = keywords.filter(kw => 
    titleLower.includes(kw.toLowerCase()) || descLower.includes(kw.toLowerCase())
  ).length;
  if (keywordMatches >= 3) {
    score += 20;
    reasons.push(`✅ Strong keyword match (${keywordMatches})`);
  } else if (keywordMatches >= 1) {
    score += 10;
    reasons.push(`✅ Some keyword matches (${keywordMatches})`);
  }
  
  // Exclude keywords (penalty)
  const excludeKeywords = searchConfig.excludeKeywords || [];
  const hasExcluded = excludeKeywords.some(kw => 
    titleLower.includes(kw.toLowerCase())
  );
  if (hasExcluded) {
    score -= 30;
    reasons.push('❌ Contains excluded keywords');
  }
  
  // Work type match (15 points)
  const workTypes = (searchConfig.workTypes || []).map(t => t.toLowerCase());
  const jobType = (job.jobType || '').toLowerCase();
  if (workTypes.includes(jobType) || workTypes.some(t => titleLower.includes(t))) {
    score += 15;
    reasons.push('✅ Work type matches preferences');
  }
  
  // Remote match (10 points)
  const locationLower = (job.location || '').toLowerCase();
  if (searchConfig.remote?.required) {
    if (locationLower.includes('remote') || locationLower.includes('anywhere') || locationLower.includes('worldwide')) {
      score += 10;
      reasons.push('✅ Remote position');
    }
  } else {
    score += 5; // Give some points if remote not required
  }
  
  // Industry match (10 points)
  const preferredIndustries = (searchConfig.industries?.preferred || []).map(i => i.toLowerCase());
  const industryMatch = preferredIndustries.some(ind => descLower.includes(ind.toLowerCase()));
  if (industryMatch) {
    score += 10;
    reasons.push('✅ Preferred industry');
  }
  
  // Freshness bonus (5 points)
  if (job.posted) {
    const postedDate = new Date(job.posted);
    const daysSince = (Date.now() - postedDate) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      score += 5;
      reasons.push('✅ Fresh posting');
    }
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons
  };
}

/**
 * Check if job already exists in database
 */
async function checkJobExists(company) {
  try {
    const response = await fetch(`${API_URL}/jobs`);
    if (response.ok) {
      const jobs = await response.json();
      return jobs.some(j => j.company.toLowerCase() === company.toLowerCase());
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not check if ${company} exists`);
  }
  return false;
}

/**
 * Load rejected companies list
 */
function loadRejectedCompanies() {
  try {
    const rejectedPath = path.join(__dirname, '../data/rejected-companies.json');
    if (fs.existsSync(rejectedPath)) {
      const data = JSON.parse(fs.readFileSync(rejectedPath, 'utf8'));
      return (data.rejected || []).map(c => c.toLowerCase());
    }
  } catch (e) {}
  return [];
}

/**
 * Add job to database via API
 */
async function addJobToDatabase(job, score) {
  try {
    const response = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Not Started',
        priority: score >= 80 ? '🔴 High' : score >= 60 ? '🟡 Medium' : '🟢 Lower',
        company: job.company,
        role: job.title,
        type: job.jobType || 'Unknown',
        location: job.location || 'Remote',
        source: job.source || 'Job Scan',
        apply_url: job.applyUrl || '',
        materials: '⬜ None'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.id;
    }
  } catch (error) {
    console.error(`   ❌ Error adding ${job.company}:`, error.message);
  }
  return null;
}

/**
 * Main scan function
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--test') || args.includes('--dry-run');
  const listOnly = args.includes('--list');
  
  const sourcesConfig = loadSourcesConfig();
  const searchConfig = loadSearchConfig();
  const minScore = sourcesConfig.scoring?.minScoreToAdd || 40;
  
  // List sources mode
  if (listOnly) {
    console.log('📋 Configured Job Sources:\n');
    sourcesConfig.sources.forEach(source => {
      const status = source.enabled ? '✅' : '❌';
      const type = source.type === 'rss' ? '📡 RSS' : '🌐 Browser';
      console.log(`${status} ${source.name} (${type})`);
      if (source.rssFeeds) {
        source.rssFeeds.forEach(url => console.log(`   - ${url}`));
      }
      if (source.urls) {
        source.urls.forEach(url => console.log(`   - ${url}`));
      }
      console.log();
    });
    return;
  }
  
  console.log('🔍 ProwlA Job Scanner\n');
  
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - jobs will not be added to database\n');
  }
  
  // Scan RSS sources
  console.log('📡 Scanning RSS sources...');
  const jobs = await scrapeRSSSources({
    maxJobsPerSource: sourcesConfig.scanning?.maxJobsPerSource || 30,
    daysOld: sourcesConfig.scanning?.daysToConsider || 30
  });
  
  console.log(`\n📊 Found ${jobs.length} jobs from RSS sources\n`);
  
  if (jobs.length === 0) {
    console.log('ℹ️  No jobs found. Check your config/sources.json settings.');
    return;
  }
  
  // Score and filter jobs
  console.log('🎯 Scoring jobs against your preferences...');
  const rejectedCompanies = loadRejectedCompanies();
  const scoredJobs = jobs
    .map(job => ({
      ...job,
      evaluation: scoreJob(job, searchConfig)
    }))
    .filter(job => !rejectedCompanies.includes(job.company.toLowerCase()))
    .filter(job => job.evaluation.score >= minScore)
    .sort((a, b) => b.evaluation.score - a.evaluation.score);
  
  console.log(`   ${scoredJobs.length} jobs meet minimum score (${minScore}+)\n`);
  
  // Add to database
  if (!isDryRun && scoredJobs.length > 0) {
    console.log('📊 Adding jobs to database...');
    let added = 0;
    
    for (const job of scoredJobs) {
      const exists = await checkJobExists(job.company);
      if (exists) {
        console.log(`   ⏭️  ${job.company} already in database`);
        continue;
      }
      
      const id = await addJobToDatabase(job, job.evaluation.score);
      if (id) {
        console.log(`   ✅ ${job.company} - ${job.title} (score: ${job.evaluation.score})`);
        added++;
      }
    }
    
    console.log(`\n✅ Added ${added} new jobs to database`);
  } else if (isDryRun) {
    console.log('📋 Jobs that would be added:\n');
    scoredJobs.slice(0, 10).forEach((job, i) => {
      console.log(`${i + 1}. ${job.company} - ${job.title}`);
      console.log(`   Score: ${job.evaluation.score} | ${job.location}`);
      console.log(`   ${job.evaluation.reasons.slice(0, 2).join(', ')}`);
      console.log();
    });
  }
  
  // Note about browser sources
  const browserSources = getBrowserSources();
  if (browserSources.length > 0) {
    console.log('\n⚠️  Browser-required sources (ask your AI agent):');
    browserSources.forEach(s => {
      console.log(`   - ${s.name}`);
      console.log(`     Say: "Scan ${s.name} for jobs and add them to my tracker"`);
    });
  }
  
  console.log('\n✅ Scan complete!');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
