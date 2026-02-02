# Autonomous Mode

Run ProwlA with fully automated job discovery, research, and processing using OpenClaw.

## Overview

Autonomous mode enables:
- **Scheduled job board scans** — Automatically find new opportunities
- **Heartbeat processing** — Process research tasks in the background
- **Event-driven workflows** — React to new jobs automatically
- **Continuous operation** — Runs while you sleep

## Prerequisites

- ProwlA installed and configured
- Anthropic API key
- [OpenClaw](https://github.com/yourusername/openclaw) (moltbot) installed
- Basic familiarity with cron jobs

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Autonomous Mode                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌──────────────┐  │
│  │  OpenClaw   │────▶│  Task Queue │────▶│   ProwlA     │  │
│  │  (Agent)    │◀────│  (tasks/)   │◀────│   Server     │  │
│  └─────────────┘     └─────────────┘     └──────────────┘  │
│         │                                       │           │
│         │         ┌─────────────┐               │           │
│         └────────▶│  Cron Jobs  │               │           │
│                   │  (Scheduled)│               │           │
│                   └─────────────┘               │           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install OpenClaw

```bash
# Clone OpenClaw
git clone https://github.com/yourusername/openclaw.git
cd openclaw

# Install dependencies
npm install

# Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

### 2. Configure ProwlA for Autonomous Mode

In your ProwlA `.env`:

```bash
AUTONOMOUS_MODE=true
HEARTBEAT_INTERVAL=60000  # Check every minute
```

### 3. Configure OpenClaw to Use ProwlA

Add ProwlA MCP server to OpenClaw's configuration:

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

### 4. Create Heartbeat Configuration

Create a heartbeat instruction file that OpenClaw will follow:

```markdown
# ProwlA Heartbeat Instructions

## On Each Heartbeat

1. Check for pending tasks:
   - Use `tasks_list` to get pending research and materials tasks
   
2. Process research tasks:
   - Use `tasks_claim` to lock the task
   - Use `jobs_get` to get job details
   - Research the company (web search, etc.)
   - Use `research_save` to save findings
   - Use `tasks_complete` to remove from queue

3. Process materials tasks:
   - Use `tasks_claim` to lock the task
   - Use `materials_get` to check existing research
   - Generate cover letter and email
   - Use `materials_save_cover_letter` and `materials_save_email`
   - Use `tasks_complete` to remove from queue

## Error Handling

- If a task fails, use `tasks_release` to unlock it
- Log errors for review
- Continue to next task
```

### 5. Set Up Scheduled Scans (Optional)

Create cron jobs for automated job board scanning:

```bash
# Edit crontab
crontab -e

# Add scheduled scans (example: 8 AM and 4 PM)
0 8 * * * /path/to/openclaw/run.sh "Scan job boards and add new opportunities to ProwlA"
0 16 * * * /path/to/openclaw/run.sh "Scan job boards and add new opportunities to ProwlA"
```

## Task Queue System

### How Tasks Work

1. **User or cron creates task** → Task file in `tasks/`
2. **OpenClaw heartbeat detects task** → Claims and processes
3. **Task completed** → File deleted, results in database

### Task Types

#### Research Tasks

Created when:
- User clicks "Research Company" in UI
- High-priority job is auto-queued
- Agent creates via `tasks_create_research`

File format:
```json
{
  "type": "research",
  "jobId": 432,
  "company": "Acme AI",
  "role": "Product Designer",
  "status": "pending",
  "createdAt": "2026-02-02T10:00:00Z"
}
```

#### Materials Tasks

Created when:
- User clicks "Generate Materials" in UI
- Agent creates via `tasks_create_materials`

File format:
```json
{
  "type": "materials",
  "jobId": 432,
  "company": "Acme AI",
  "role": "Product Designer",
  "status": "pending",
  "createdAt": "2026-02-02T10:00:00Z"
}
```

### Task Locking

Prevents multiple agents from processing the same task:

```
Agent A: tasks_claim("research-acme.json") → Success, locked
Agent B: tasks_claim("research-acme.json") → Fail, already claimed
```

Locks expire after 10 minutes (configurable) to handle crashed agents.

## Event-Driven Processing

For more responsive processing, use the event system:

### Subscribe to Events

```javascript
// Agent subscribes to task creation events
events_subscribe(["task.created", "job.created"])
```

### Poll for Events

```javascript
// Long-poll for new events (30 second timeout)
events_poll(subscription_id, timeout_ms=30000)
```

### React to Events

When a new task is created:
1. Event fires immediately
2. Agent receives notification
3. Agent processes task
4. Much faster than polling the task directory

## Heartbeat Configuration

### Frequency

Adjust based on your needs:

| Interval | Use Case |
|----------|----------|
| 30 seconds | High responsiveness, higher cost |
| 1 minute | Good balance (recommended) |
| 5 minutes | Lower cost, slower processing |

### What OpenClaw Does Each Heartbeat

1. **Check task queue** — `tasks_list(status="pending")`
2. **Process oldest task first** — FIFO ordering
3. **Claim before processing** — Prevent duplicates
4. **Save results** — Database + files
5. **Complete task** — Remove from queue
6. **Log activity** — Track what was done

## Cost Optimization

Autonomous mode can get expensive. Optimize with:

### Two-Phase Approach

1. **Discovery (cheap model)** — Find jobs with Haiku
2. **Research (quality model)** — Deep research with Sonnet

### Selective Auto-Research

Only auto-queue research for high-priority jobs:

```json
// config/search.json
{
  "autoResearch": {
    "enabled": true,
    "minPriorityScore": 85
  }
}
```

### Budget Limits

Set daily/weekly spending limits in OpenClaw.

### Token Tracking

Monitor costs:
```
tokens_get_cost(start_date="2026-02-01", end_date="2026-02-07")
```

## Monitoring

### Check Task Queue

```bash
# List pending tasks
ls -la /path/to/prowla/tasks/

# Via API
curl http://localhost:3001/api/tasks/status
```

### Check Processing Logs

OpenClaw logs activity. Check for:
- Tasks claimed and completed
- Errors during processing
- Time taken per task

### Health Checks

Verify the system is working:

1. Create a test task in UI
2. Watch for it to be processed
3. Check results in database

## Troubleshooting

### Tasks Stuck in Queue

1. **Check if OpenClaw is running**
2. **Check task lock** — May be claimed but agent crashed
3. **Manually release** — `tasks_release(filename)`
4. **Delete stale task** — Remove file from `tasks/`

### Duplicate Processing

If same job researched twice:
- Check task locking is working
- Ensure only one OpenClaw instance runs
- Verify `tasks_claim` is called before processing

### High Costs

1. **Reduce heartbeat frequency**
2. **Increase auto-research threshold**
3. **Use cheaper model for discovery**
4. **Disable scheduled scans temporarily**

### OpenClaw Not Finding Tasks

1. **Check MCP configuration** — Path must be absolute
2. **Verify server is running** — `npm run dev`
3. **Test MCP tools manually** — `node mcp-server/index.js --list`

## Security Considerations

- **API keys** — Keep in `.env`, never commit
- **Task files** — Don't expose publicly
- **Database** — Contains research notes, keep secure
- **OpenClaw access** — Has full access to ProwlA

## Disabling Autonomous Mode

To switch back to manual/MCP mode:

1. Stop OpenClaw heartbeat
2. Remove cron jobs
3. Set `AUTONOMOUS_MODE=false` in `.env`
4. Process remaining tasks manually or delete

## Example: Full Autonomous Setup

```bash
# 1. Configure ProwlA
echo "AUTONOMOUS_MODE=true" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-xxx" >> .env

# 2. Configure OpenClaw
# Add ProwlA MCP server to OpenClaw config

# 3. Create heartbeat instructions
# Save instructions to OpenClaw's instruction file

# 4. Start services
npm run dev  # ProwlA

# 5. Start OpenClaw with heartbeat
openclaw --heartbeat --interval 60

# 6. (Optional) Add cron jobs for scheduled scans
crontab -e
# 0 8,16 * * * /path/to/openclaw/scan-jobs.sh
```

## Next Steps

- [../agents/WORKFLOW-EXAMPLES.md](../agents/WORKFLOW-EXAMPLES.md) — Advanced agent workflows
- [../agents/OPENCLAW-SETUP.md](../agents/OPENCLAW-SETUP.md) — Detailed OpenClaw configuration
- [MCP-MODE.md](MCP-MODE.md) — On-demand AI assistance
