# ProwlA MCP Server

An MCP (Model Context Protocol) server that provides AI agents with tools to manage job applications, company research, and application materials.

## Overview

This server exposes **28 tools** across 8 categories, designed for agent-first workflows:

| Category | Tools | Description |
|----------|-------|-------------|
| **Jobs** | 7 | CRUD operations, bulk updates, fuzzy search |
| **Research** | 4 | Company research notes management |
| **Materials** | 3 | Cover letters and outreach emails |
| **Tasks** | 7 | Task queue with locking mechanism |
| **Events** | 4 | Event subscription and polling |
| **Query** | 4 | Specialized queries and statistics |
| **Config** | 3 | Settings and preferences |
| **Tokens** | 3 | Usage tracking and cost estimates |

## Installation

```bash
cd /path/to/prowla/mcp-server
npm install
```

## Configuration

Add to your MCP settings (e.g., `~/.cursor/mcp.json` or Cursor settings):

```json
{
  "mcpServers": {
    "prowla": {
      "command": "node",
      "args": ["/path/to/prowla/mcp-server/index.js"]
    }
  }
}
```

## Usage

### Starting the Server

```bash
# Start on stdio (for MCP clients)
node index.js

# Show help
node index.js --help

# List all tools
node index.js --list
```

### Using with Cursor/Claude

Once configured, you can use the tools directly:

```
Use jobs_list to get all high priority jobs
Use tasks_claim to lock the first research task
Use research_save to save the completed research
```

---

## Tool Reference

### Jobs Tools

#### `jobs_list`
Get jobs with filtering and pagination.

**Input:**
```json
{
  "status": "Not Started",      // Optional: filter by status
  "priority": "🔴 High",        // Optional: filter by priority
  "materials_status": "⬜ None", // Optional: filter by materials
  "source": "LinkedIn",          // Optional: filter by source
  "only_new": true,              // Optional: only recent jobs
  "limit": 50,                   // Optional: max results (default: 50)
  "offset": 0                    // Optional: for pagination
}
```

**Output:**
```json
{
  "jobs": [...],
  "total": 145,
  "has_more": true,
  "limit": 50,
  "offset": 0
}
```

#### `jobs_get`
Get a single job by ID with all content fields.

**Input:**
```json
{ "job_id": 432 }
```

#### `jobs_create`
Create a new job opportunity.

**Input:**
```json
{
  "company": "Acme AI",           // Required
  "role": "Senior Designer",      // Required
  "priority": "🔴 High",          // Optional (default: 🟢 Lower)
  "type": "Fractional",           // Optional
  "compensation": "$6,000/mo",    // Optional
  "source": "Cold Outreach",      // Optional
  "apply_url": "https://..."      // Optional
}
```

**Output:**
```json
{
  "job_id": 500,
  "company": "Acme AI",
  "role": "Senior Designer"
}
```

#### `jobs_update`
Update fields on an existing job.

**Input:**
```json
{
  "job_id": 432,
  "status": "Applied",
  "applied_date": "2026-02-02"
}
```

#### `jobs_delete`
Delete a job (adds company to rejected list).

**Input:**
```json
{ "job_id": 432 }
```

#### `jobs_bulk_update`
Update multiple jobs at once.

**Input:**
```json
{
  "job_ids": [432, 433, 434],
  "updates": { "status": "Researching" }
}
```

#### `jobs_search`
Fuzzy search across jobs.

**Input:**
```json
{
  "query": "AI startup series A",
  "fields": ["company", "role", "research_notes"],
  "limit": 20
}
```

**Output:**
```json
{
  "jobs": [
    { "id": 432, "company": "Acme AI", "_relevance": 85, ... }
  ],
  "total": 5,
  "query": "AI startup series A"
}
```

---

### Research Tools

#### `research_get`
Get research notes for a job.

**Input:**
```json
{ "job_id": 432 }
```

**Output:**
```json
{
  "job_id": 432,
  "company": "Acme AI",
  "research_notes": "# Acme AI - Company Research\n\n...",
  "has_research": true
}
```

#### `research_save`
Save completed research notes.

**Input:**
```json
{
  "job_id": 432,
  "research_notes": "# Acme AI - Company Research\n\n## 💰 Funding Details\n...",
  "log_tokens": {                    // Optional
    "input": 15000,
    "output": 2500,
    "model": "claude-sonnet-4-20250514"
  }
}
```

**Output:**
```json
{
  "success": true,
  "job_id": 432,
  "company": "Acme AI",
  "materials_status": "🔍 Research"
}
```

#### `research_save_batch`
Save research for multiple jobs at once.

**Input:**
```json
{
  "items": [
    { "job_id": 432, "research_notes": "# Research..." },
    { "job_id": 433, "research_notes": "# Research..." }
  ]
}
```

#### `research_template`
Get the research template markdown.

**Output:**
```json
{
  "template": "# [Company Name] - Company Research\n\n...",
  "path": "/path/to/RESEARCH-TEMPLATE.md"
}
```

---

### Materials Tools

#### `materials_get`
Get all materials for a job.

**Input:**
```json
{ "job_id": 432 }
```

**Output:**
```json
{
  "job_id": 432,
  "company": "Acme AI",
  "materials_status": "✅ Full",
  "research_notes": "...",
  "cover_letter": "...",
  "email": "...",
  "has_research": true,
  "has_cover_letter": true,
  "has_email": true
}
```

#### `materials_save_cover_letter`
Save a cover letter.

**Input:**
```json
{
  "job_id": 432,
  "content": "Dear Hiring Manager,\n\n...",
  "log_tokens": { "input": 5000, "output": 1000, "model": "sonnet" }
}
```

#### `materials_save_email`
Save an outreach email.

**Input:**
```json
{
  "job_id": 432,
  "content": "Hi [Name],\n\n...",
  "log_tokens": { "input": 3000, "output": 800, "model": "sonnet" }
}
```

---

### Tasks Tools

#### `tasks_list`
Get pending and in-progress tasks.

**Input:**
```json
{
  "type": "research",           // Optional: "research" | "materials"
  "status": "pending",          // Optional: "pending" | "in_progress"
  "include_stale": true         // Optional: treat stale locks as pending
}
```

**Output:**
```json
{
  "tasks": [
    {
      "filename": "research-acme-ai.json",
      "type": "research",
      "job_id": 432,
      "company": "Acme AI",
      "status": "pending",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "count": 1
}
```

#### `tasks_get`
Get details of a specific task.

**Input:**
```json
{ "filename": "research-acme-ai.json" }
```

#### `tasks_claim`
Claim a task for processing (acquire lock).

**Input:**
```json
{
  "filename": "research-acme-ai.json",
  "agent_id": "heartbeat-agent"      // Optional
}
```

**Output:**
```json
{
  "success": true,
  "locked": true,
  "claimed_at": "2026-02-02T14:30:00Z",
  "task": {
    "job_id": 432,
    "company": "Acme AI",
    "role": "Senior Designer",
    "apply_url": "https://..."
  }
}
```

**If already claimed:**
```json
{
  "success": false,
  "error": "Task already claimed",
  "claimed_by": "other-agent",
  "claimed_at": "2026-02-02T14:00:00Z"
}
```

#### `tasks_release`
Release a claimed task (if processing fails).

**Input:**
```json
{ "filename": "research-acme-ai.json" }
```

#### `tasks_complete`
Mark task done and delete file.

**Input:**
```json
{
  "filename": "research-acme-ai.json",
  "log_tokens": { "input": 20000, "output": 3000, "model": "sonnet" }
}
```

#### `tasks_create_research`
Queue a research task for a job.

**Input:**
```json
{ "job_id": 432 }
```

**Output:**
```json
{
  "success": true,
  "filename": "research-acme-ai.json",
  "already_exists": false,
  "company": "Acme AI"
}
```

#### `tasks_create_materials`
Queue a materials generation task.

**Input:**
```json
{ "job_id": 432 }
```

---

### Events Tools

#### `events_subscribe`
Subscribe to events.

**Input:**
```json
{
  "event_types": ["task.created", "job.created", "research.saved"],
  "webhook_url": "https://...",     // Optional: for push delivery
  "callback_id": "my-agent"         // Optional: identifier
}
```

**Output:**
```json
{
  "success": true,
  "subscription_id": "sub_abc123",
  "event_types": ["task.created", "job.created", "research.saved"]
}
```

**Available event types:**
- `job.created` - New job added
- `job.updated` - Job fields changed
- `job.deleted` - Job removed
- `task.created` - New task queued
- `task.claimed` - Task locked by agent
- `task.completed` - Task finished
- `research.saved` - Research notes saved
- `materials.saved` - Cover letter or email saved

#### `events_unsubscribe`
Remove a subscription.

**Input:**
```json
{ "subscription_id": "sub_abc123" }
```

#### `events_list`
Get recent events.

**Input:**
```json
{
  "since": "2026-02-02T10:00:00Z",   // Optional
  "type": "task.created",            // Optional
  "limit": 100                       // Optional
}
```

#### `events_poll`
Long-poll for new events.

**Input:**
```json
{
  "subscription_id": "sub_abc123",
  "timeout_ms": 30000                // Optional (default: 30s)
}
```

**Output:**
```json
{
  "events": [
    {
      "id": "evt_xyz",
      "type": "task.created",
      "timestamp": "2026-02-02T14:35:00Z",
      "payload": { "filename": "research-newco.json", "company": "NewCo" }
    }
  ],
  "count": 1
}
```

---

### Query Tools

#### `query_stats`
Get dashboard statistics.

**Output:**
```json
{
  "total": 145,
  "by_status": {
    "Not Started": 45,
    "Applied": 60,
    "Interviewing": 15
  },
  "by_priority": {
    "🔴 High": 23,
    "🟡 Medium": 67,
    "🟢 Lower": 55
  },
  "by_materials": {
    "⬜ None": 30,
    "🔍 Research": 45,
    "✅ Full": 50
  },
  "pending_tasks": 3,
  "added_today": 5,
  "added_this_week": 18
}
```

#### `query_by_company`
Find job by company name.

**Input:**
```json
{
  "company_name": "Acme",
  "fuzzy": true               // Optional: allow fuzzy matching
}
```

**Output:**
```json
{
  "found": true,
  "company_name": "Acme",
  "job": { "id": 432, "company": "Acme AI", ... },
  "match_type": "fuzzy",
  "relevance": 85
}
```

#### `query_needs_research`
Get jobs without research notes.

**Input:**
```json
{
  "limit": 50,
  "priority": "🔴 High"       // Optional
}
```

#### `query_high_priority`
Get all high priority jobs.

**Input:**
```json
{
  "limit": 50,
  "status": "Not Started"     // Optional
}
```

---

### Config Tools

#### `config_get`
Get current search preferences.

**Output:**
```json
{
  "config": {
    "workTypes": ["Fractional", "Contract", "Part-time"],
    "hoursPerWeek": { "min": 10, "max": 30 },
    "rates": {
      "hourly": { "min": 110, "max": 170 },
      "fractionalMonthly": { "min": 5000, "max": 8000 }
    },
    "industries": ["EdTech", "SaaS", "AI", "B2B"],
    "mustBeRemote": true,
    "autoResearch": false
  }
}
```

#### `config_update`
Update search preferences.

**Input:**
```json
{
  "autoResearch": true,
  "industries": ["AI", "FinTech", "HealthTech"]
}
```

#### `config_get_rejected`
Get list of rejected companies.

**Output:**
```json
{
  "rejected": ["BadCo Inc", "Spam Agency"],
  "count": 2
}
```

---

### Tokens Tools

#### `tokens_log`
Log token usage for an operation.

**Input:**
```json
{
  "task_type": "research",
  "input_tokens": 15000,
  "output_tokens": 2500,
  "model": "claude-sonnet-4-20250514",
  "job_id": 432,                      // Optional
  "metadata": { "company": "Acme" }   // Optional
}
```

**Output:**
```json
{
  "success": true,
  "entry_id": "1706889600000-abc123",
  "cost": "0.0825"
}
```

#### `tokens_get_usage`
Get usage statistics.

**Input:**
```json
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-02",
  "task_type": "research"           // Optional
}
```

**Output:**
```json
{
  "period": { "start": "2026-02-01", "end": "2026-02-02" },
  "total": { "input": 450000, "output": 85000, "entries": 25 },
  "by_task_type": {
    "research": { "input": 300000, "output": 60000, "count": 15 }
  },
  "by_model": {
    "claude-sonnet-4-20250514": { "input": 400000, "output": 75000 }
  }
}
```

#### `tokens_get_cost`
Get cost estimates.

**Input:**
```json
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-02"
}
```

**Output:**
```json
{
  "total_cost": 12.5432,
  "total_cost_formatted": "$12.54",
  "by_task_type": { "research": 8.25, "materials": 4.29 },
  "by_model": { "claude-sonnet-4-20250514": 11.50 },
  "by_day": { "2026-02-01": 6.25, "2026-02-02": 6.29 }
}
```

---

## Agent Workflows

### Processing Research Tasks

```
1. tasks_list(type="research", status="pending")
   → Get available research tasks

2. tasks_claim("research-acme.json", agent_id="my-agent")
   → Lock the task

3. jobs_get(432)
   → Get full job details

4. research_template()
   → Get template structure

5. [Do browser research on the company]

6. research_save(432, research_markdown, log_tokens={...})
   → Save to database

7. tasks_complete("research-acme.json")
   → Remove from queue
```

### Event-Driven Processing

```
1. events_subscribe(["task.created"])
   → Get subscription ID

2. events_poll(subscription_id, timeout_ms=30000)
   → Wait for new tasks

3. When event received:
   tasks_claim(event.payload.filename)
   → Start processing
```

### Discovery Agent

```
1. config_get()
   → Get search preferences

2. [Scan job boards via browser]

3. For each found job:
   query_by_company(company_name, fuzzy=true)
   → Check if exists

4. If new:
   jobs_create({...})
   → Add to database

5. If high priority:
   tasks_create_research(job_id)
   → Queue for research
```

---

## Architecture

```
mcp-server/
├── index.js              # MCP server entry point
├── package.json          # Dependencies
├── README.md             # This file
├── lib/
│   ├── db.js             # Database connection & utilities
│   ├── task-lock.js      # Task locking mechanism
│   ├── event-emitter.js  # Event system
│   └── fuzzy-search.js   # Fuse.js search
└── tools/
    ├── jobs.js           # Job CRUD tools
    ├── research.js       # Research tools
    ├── materials.js      # Materials tools
    ├── tasks.js          # Task queue tools
    ├── events.js         # Event tools
    ├── query.js          # Query tools
    ├── config.js         # Config tools
    └── tokens.js         # Token tracking tools
```

---

## License

MIT
