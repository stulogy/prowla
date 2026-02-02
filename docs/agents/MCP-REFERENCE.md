# MCP Tool Reference

Complete documentation for all ProwlA MCP tools.

> 📋 This is a copy of the main MCP server documentation. For the most up-to-date version, see [mcp-server/README.md](../../mcp-server/README.md).

## Overview

ProwlA exposes **28 tools** across 8 categories:

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

## Jobs Tools

### `jobs_list`
Get jobs with filtering and pagination.

**Input:**
```json
{
  "status": "Not Started",
  "priority": "🔴 High",
  "materials_status": "⬜ None",
  "source": "LinkedIn",
  "only_new": true,
  "limit": 50,
  "offset": 0
}
```
All parameters optional.

**Output:**
```json
{
  "jobs": [...],
  "total": 145,
  "has_more": true
}
```

### `jobs_get`
Get a single job by ID with all fields.

**Input:**
```json
{ "job_id": 432 }
```

### `jobs_create`
Create a new job.

**Input:**
```json
{
  "company": "Acme AI",
  "role": "Senior Designer",
  "priority": "🔴 High",
  "type": "Fractional",
  "compensation": "$6,000/mo",
  "source": "Cold Outreach",
  "apply_url": "https://..."
}
```
Required: `company`, `role`

**Output:**
```json
{
  "job_id": 500,
  "company": "Acme AI",
  "role": "Senior Designer"
}
```

### `jobs_update`
Update fields on an existing job.

**Input:**
```json
{
  "job_id": 432,
  "status": "Applied",
  "applied_date": "2026-02-02"
}
```

### `jobs_delete`
Delete a job (adds company to rejected list).

**Input:**
```json
{ "job_id": 432 }
```

### `jobs_bulk_update`
Update multiple jobs at once.

**Input:**
```json
{
  "job_ids": [432, 433, 434],
  "updates": { "status": "Researching" }
}
```

### `jobs_search`
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
    { "id": 432, "company": "Acme AI", "_relevance": 85 }
  ],
  "total": 5
}
```

## Research Tools

### `research_get`
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

### `research_save`
Save completed research notes.

**Input:**
```json
{
  "job_id": 432,
  "research_notes": "# Acme AI - Company Research\n\n## Funding\n...",
  "log_tokens": {
    "input": 15000,
    "output": 2500,
    "model": "claude-sonnet-4-20250514"
  }
}
```

### `research_save_batch`
Save research for multiple jobs.

**Input:**
```json
{
  "items": [
    { "job_id": 432, "research_notes": "..." },
    { "job_id": 433, "research_notes": "..." }
  ]
}
```

### `research_template`
Get the research template markdown.

**Output:**
```json
{
  "template": "# [Company Name] - Company Research\n\n..."
}
```

## Materials Tools

### `materials_get`
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

### `materials_save_cover_letter`
Save a cover letter.

**Input:**
```json
{
  "job_id": 432,
  "content": "Dear Hiring Manager,\n\n...",
  "log_tokens": { "input": 5000, "output": 1000 }
}
```

### `materials_save_email`
Save an outreach email.

**Input:**
```json
{
  "job_id": 432,
  "content": "Hi [Name],\n\n...",
  "log_tokens": { "input": 3000, "output": 800 }
}
```

## Tasks Tools

### `tasks_list`
Get pending and in-progress tasks.

**Input:**
```json
{
  "type": "research",
  "status": "pending",
  "include_stale": true
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
      "status": "pending"
    }
  ],
  "count": 1
}
```

### `tasks_get`
Get details of a specific task.

**Input:**
```json
{ "filename": "research-acme-ai.json" }
```

### `tasks_claim`
Claim a task for processing (acquire lock).

**Input:**
```json
{
  "filename": "research-acme-ai.json",
  "agent_id": "my-agent"
}
```

**Success Output:**
```json
{
  "success": true,
  "locked": true,
  "claimed_at": "2026-02-02T14:30:00Z",
  "task": { "job_id": 432, "company": "Acme AI" }
}
```

**Already Claimed:**
```json
{
  "success": false,
  "error": "Task already claimed",
  "claimed_by": "other-agent"
}
```

### `tasks_release`
Release a claimed task.

**Input:**
```json
{ "filename": "research-acme-ai.json" }
```

### `tasks_complete`
Mark task done and delete file.

**Input:**
```json
{
  "filename": "research-acme-ai.json",
  "log_tokens": { "input": 20000, "output": 3000 }
}
```

### `tasks_create_research`
Queue a research task.

**Input:**
```json
{ "job_id": 432 }
```

**Output:**
```json
{
  "success": true,
  "filename": "research-acme-ai.json",
  "already_exists": false
}
```

### `tasks_create_materials`
Queue a materials generation task.

**Input:**
```json
{ "job_id": 432 }
```

## Events Tools

### `events_subscribe`
Subscribe to events.

**Input:**
```json
{
  "event_types": ["task.created", "job.created"],
  "callback_id": "my-agent"
}
```

**Available Events:**
- `job.created`, `job.updated`, `job.deleted`
- `task.created`, `task.claimed`, `task.completed`
- `research.saved`, `materials.saved`

### `events_unsubscribe`
Remove a subscription.

**Input:**
```json
{ "subscription_id": "sub_abc123" }
```

### `events_list`
Get recent events.

**Input:**
```json
{
  "since": "2026-02-02T10:00:00Z",
  "type": "task.created",
  "limit": 100
}
```

### `events_poll`
Long-poll for new events.

**Input:**
```json
{
  "subscription_id": "sub_abc123",
  "timeout_ms": 30000
}
```

## Query Tools

### `query_stats`
Get dashboard statistics.

**Output:**
```json
{
  "total": 145,
  "by_status": { "Not Started": 45, "Applied": 60 },
  "by_priority": { "🔴 High": 23, "🟡 Medium": 67 },
  "by_materials": { "⬜ None": 30, "✅ Full": 50 },
  "pending_tasks": 3,
  "added_today": 5
}
```

### `query_by_company`
Find job by company name.

**Input:**
```json
{
  "company_name": "Acme",
  "fuzzy": true
}
```

### `query_needs_research`
Get jobs without research.

**Input:**
```json
{
  "limit": 50,
  "priority": "🔴 High"
}
```

### `query_high_priority`
Get all high priority jobs.

**Input:**
```json
{
  "limit": 50,
  "status": "Not Started"
}
```

## Config Tools

### `config_get`
Get current preferences.

### `config_update`
Update preferences.

**Input:**
```json
{
  "autoResearch": true,
  "industries": ["AI", "FinTech"]
}
```

### `config_get_rejected`
Get rejected companies list.

## Tokens Tools

### `tokens_log`
Log token usage.

**Input:**
```json
{
  "task_type": "research",
  "input_tokens": 15000,
  "output_tokens": 2500,
  "model": "claude-sonnet-4-20250514",
  "job_id": 432
}
```

### `tokens_get_usage`
Get usage statistics.

**Input:**
```json
{
  "start_date": "2026-02-01",
  "end_date": "2026-02-02",
  "task_type": "research"
}
```

### `tokens_get_cost`
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
  "total_cost": 12.54,
  "total_cost_formatted": "$12.54",
  "by_task_type": { "research": 8.25, "materials": 4.29 }
}
```

## Error Handling

All tools return errors in consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `NOT_FOUND` — Resource doesn't exist
- `ALREADY_EXISTS` — Duplicate creation
- `INVALID_INPUT` — Bad parameters
- `LOCKED` — Task already claimed
