# Configuring Job Sources

ProwlA supports scanning multiple job boards. Sources are **user-configurable** - you choose which boards to scan based on your job search needs.

## Quick Start

1. Copy the example config:
   ```bash
   cp config/sources.example.json config/sources.json
   ```

2. Edit `config/sources.json` to enable/disable sources and add your own

3. Run a scan:
   ```bash
   cd scripts && npm install
   npm run scan
   ```

## Source Types

### RSS Sources (Automatic)

RSS sources can be scanned automatically without any special setup:

```json
{
  "id": "my-source",
  "name": "My Job Board",
  "enabled": true,
  "type": "rss",
  "rssFeeds": [
    "https://example.com/jobs.rss",
    "https://example.com/design-jobs.rss"
  ]
}
```

**Examples of RSS-enabled job boards:**
- WeWorkRemotely (categories have RSS feeds)
- RemoteOK
- Many company career pages
- Hacker News Who's Hiring (via hnrss.org)

### Browser Sources (AI Agent Required)

Some job boards require JavaScript rendering and can't be scraped with simple HTTP requests:

```json
{
  "id": "yc-jobs",
  "name": "YC Work at a Startup",
  "enabled": true,
  "type": "browser",
  "urls": [
    "https://www.workatastartup.com/jobs?role=design"
  ],
  "notes": "Ask your AI agent to scan this source"
}
```

**To scan browser sources:**
Ask your AI agent (Claude, GPT, etc.) with MCP access:
> "Scan YC Work at a Startup for product designer jobs and add them to my tracker"

The agent will use browser automation to extract job listings.

## Configuration Reference

### Source Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `enabled` | boolean | Whether to include in scans |
| `type` | "rss" \| "browser" | How to scrape this source |
| `priority` | "high" \| "medium" \| "low" | Affects job scoring |
| `rssFeeds` | string[] | RSS feed URLs (for type: rss) |
| `urls` | string[] | Page URLs (for type: browser) |
| `searchTerms` | string[] | Optional keywords to filter |
| `notes` | string | Your notes about this source |

### Scanning Options

```json
{
  "scanning": {
    "autoScanEnabled": false,
    "scanIntervalHours": 8,
    "maxJobsPerSource": 30,
    "daysToConsider": 30
  }
}
```

### Scoring Options

```json
{
  "scoring": {
    "minScoreToAdd": 40,
    "autoResearchMinScore": 80
  }
}
```

Jobs are scored based on your `config/search.json` preferences.

## Finding RSS Feeds

Many job boards have RSS feeds that aren't advertised. Try:

1. Look for RSS icons on the page
2. Check `/feed`, `/rss`, `/jobs.rss` paths
3. View page source and search for "rss" or "application/rss+xml"
4. Use browser extensions like "RSS Finder"

## Example Configurations

### For Product Designers

```json
{
  "sources": [
    {
      "id": "wwr-design",
      "name": "WeWorkRemotely Design",
      "enabled": true,
      "type": "rss",
      "rssFeeds": [
        "https://weworkremotely.com/categories/remote-design-jobs.rss"
      ]
    },
    {
      "id": "dribbble",
      "name": "Dribbble Jobs",
      "enabled": true,
      "type": "browser",
      "urls": ["https://dribbble.com/jobs?location=Anywhere"]
    }
  ]
}
```

### For Software Engineers

```json
{
  "sources": [
    {
      "id": "wwr-programming",
      "name": "WeWorkRemotely Programming",
      "enabled": true,
      "type": "rss",
      "rssFeeds": [
        "https://weworkremotely.com/categories/remote-programming-jobs.rss",
        "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss"
      ]
    },
    {
      "id": "hn-hiring",
      "name": "Hacker News Who's Hiring",
      "enabled": true,
      "type": "rss",
      "rssFeeds": [
        "https://hnrss.org/whoishiring/jobs"
      ]
    }
  ]
}
```

## Troubleshooting

**"No RSS sources enabled"**
- Check that you have `config/sources.json` (not just the example file)
- Ensure at least one source has `"enabled": true` and `"type": "rss"`

**RSS feed returns no jobs**
- The feed URL may have changed - check the job board directly
- The feed may be empty - some boards have low posting volume
- Try increasing `daysToConsider` in scanning options

**Jobs not matching my criteria**
- Check your `config/search.json` settings
- Lower `minScoreToAdd` in sources config to see more jobs
- Run with `--test` flag to see scoring details

## Adding Custom Sources

You can add any job board that has RSS feeds:

1. Find the RSS feed URL
2. Add a new entry to `sources.json`
3. Test with `npm run scan:test`
4. Enable and run full scan

For boards without RSS, add as `type: "browser"` and use AI agent assistance.
