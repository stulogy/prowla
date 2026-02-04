#!/usr/bin/env node
/**
 * Generic RSS Scraper
 * 
 * Scrapes job listings from any RSS feed configured in sources.json
 * No hardcoded job boards - everything is user-configurable!
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load user's source configuration
 */
function loadSourcesConfig() {
  const configPath = path.join(__dirname, '../../config/sources.json');
  const examplePath = path.join(__dirname, '../../config/sources.example.json');
  
  // Try user config first, fall back to example
  const usePath = fs.existsSync(configPath) ? configPath : examplePath;
  
  if (!fs.existsSync(usePath)) {
    console.error('❌ No sources config found. Copy config/sources.example.json to config/sources.json');
    process.exit(1);
  }
  
  return JSON.parse(fs.readFileSync(usePath, 'utf8'));
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a single RSS item into our job format
 */
function parseRSSItem(item, sourceName) {
  // Extract title - format varies by source
  const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) ||
                     item.match(/<title>(.*?)<\/title>/s);
  const fullTitle = titleMatch ? stripHtml(titleMatch[1]) : '';
  
  // Try to split company and role (common format: "Company: Job Title")
  let company = 'Unknown';
  let role = fullTitle;
  if (fullTitle.includes(':')) {
    const parts = fullTitle.split(':');
    company = parts[0].trim();
    role = parts.slice(1).join(':').trim();
  } else if (fullTitle.includes(' - ')) {
    const parts = fullTitle.split(' - ');
    company = parts[0].trim();
    role = parts.slice(1).join(' - ').trim();
  }
  
  // Extract link
  const linkMatch = item.match(/<link>(.*?)<\/link>/s) ||
                    item.match(/<link[^>]*href="([^"]+)"/s);
  const link = linkMatch ? linkMatch[1].trim() : '';
  
  // Extract publication date
  const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/s);
  const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date();
  
  // Extract description/content
  const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
                    item.match(/<description>(.*?)<\/description>/s) ||
                    item.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/s);
  const description = descMatch ? stripHtml(descMatch[1]).slice(0, 1000) : '';
  
  // Extract region/location if present
  const regionMatch = item.match(/<region><!\[CDATA\[(.*?)\]\]><\/region>/s) ||
                      item.match(/<region>(.*?)<\/region>/s) ||
                      item.match(/<location>(.*?)<\/location>/s);
  const region = regionMatch ? stripHtml(regionMatch[1]) : '';
  
  return {
    company,
    title: role,
    applyUrl: link,
    description,
    location: region || 'Remote',
    source: sourceName,
    posted: pubDate.toISOString(),
    jobType: 'Full-time' // Default, can be parsed from description
  };
}

/**
 * Fetch and parse an RSS feed
 */
async function fetchRSSFeed(url, sourceName) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      console.warn(`   ⚠️  Failed to fetch ${url} (${response.status})`);
      return [];
    }
    
    const xml = await response.text();
    
    // Split by item tags and parse each
    const items = xml.split('<item>').slice(1);
    const jobs = items.map(item => parseRSSItem(item, sourceName)).filter(job => job.title);
    
    return jobs;
  } catch (error) {
    console.warn(`   ⚠️  Error fetching ${url}: ${error.message}`);
    return [];
  }
}

/**
 * Scrape all RSS sources from user config
 */
export async function scrapeRSSSources(options = {}) {
  const config = loadSourcesConfig();
  const { maxJobsPerSource = 30, daysOld = 30 } = options;
  
  const allJobs = [];
  const seenUrls = new Set();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  // Get all enabled RSS sources
  const rssSources = config.sources.filter(s => s.enabled && s.type === 'rss');
  
  if (rssSources.length === 0) {
    console.log('   ℹ️  No RSS sources enabled in config/sources.json');
    return [];
  }
  
  for (const source of rssSources) {
    console.log(`   📡 Scraping ${source.name}...`);
    
    const feeds = source.rssFeeds || [];
    let sourceJobs = 0;
    
    for (const feedUrl of feeds) {
      console.log(`      - Fetching ${feedUrl.split('/').pop()}...`);
      const jobs = await fetchRSSFeed(feedUrl, source.name);
      
      for (const job of jobs) {
        if (seenUrls.has(job.applyUrl)) continue;
        
        // Check if job is recent enough
        const jobDate = new Date(job.posted);
        if (jobDate < cutoffDate) continue;
        
        seenUrls.add(job.applyUrl);
        allJobs.push(job);
        sourceJobs++;
        
        if (sourceJobs >= maxJobsPerSource) break;
      }
      
      if (sourceJobs >= maxJobsPerSource) break;
    }
    
    console.log(`      ✓ Found ${sourceJobs} jobs from ${source.name}`);
  }
  
  return allJobs;
}

/**
 * Get browser-required sources for agent assistance
 */
export function getBrowserSources() {
  const config = loadSourcesConfig();
  return config.sources.filter(s => s.enabled && s.type === 'browser');
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Scanning RSS job sources...\n');
  
  const config = loadSourcesConfig();
  console.log(`📋 Loaded ${config.sources.length} sources from config\n`);
  
  scrapeRSSSources({
    maxJobsPerSource: 20,
    daysOld: 30
  }).then(jobs => {
    console.log(`\n📊 Total: ${jobs.length} jobs found from RSS sources\n`);
    
    // Show sample jobs
    jobs.slice(0, 5).forEach((job, i) => {
      console.log(`${i + 1}. ${job.company} - ${job.title}`);
      console.log(`   📍 ${job.location}`);
      console.log(`   🔗 ${job.applyUrl}`);
      console.log();
    });
    
    // Note about browser sources
    const browserSources = getBrowserSources();
    if (browserSources.length > 0) {
      console.log('⚠️  Browser-required sources (need AI agent):');
      browserSources.forEach(s => {
        console.log(`   - ${s.name}: Ask your agent to scan ${s.urls[0]}`);
      });
    }
  });
}
