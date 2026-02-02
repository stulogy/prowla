# OpenClaw Setup Guide

Configure OpenClaw to run ProwlA in fully autonomous mode.

## What is OpenClaw?

OpenClaw (also known as moltbot) is an autonomous AI agent that can:
- Run continuously in the background
- Execute tasks on a schedule (heartbeat)
- Use MCP tools to interact with applications
- Perform browser automation

When connected to ProwlA, OpenClaw can automatically:
- Process research tasks
- Generate application materials
- Scan job boards
- Manage your job search pipeline

## Prerequisites

- Node.js 18+
- Anthropic API key
- ProwlA installed and running
- Basic command line familiarity

## Installation

### 1. Clone OpenClaw

```bash
git clone https://github.com/yourusername/openclaw.git
cd openclaw
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
MODEL=claude-sonnet-4-20250514
HEARTBEAT_ENABLED=true
HEARTBEAT_INTERVAL=60000
```

### 3. Add ProwlA MCP Server

Edit OpenClaw's MCP configuration (location varies by setup):

```json
{
  "mcpServers": {
    "prowla": {
      "command": "node",
      "args": ["/absolute/path/to/prowla/mcp-server/index.js"]
    }
  }
}
```

**Important:** Use absolute paths, not relative.

### 4. Verify Connection

```bash
# Start OpenClaw in interactive mode
openclaw

# Test ProwlA tools
> Use jobs_list to show all high priority jobs
```

You should see job listings from ProwlA.

## Heartbeat Configuration

The heartbeat is what makes OpenClaw autonomous. It runs at regular intervals and processes pending tasks.

### Basic Heartbeat

Create `instructions/prowla-heartbeat.md`:

```markdown
# ProwlA Heartbeat

On each heartbeat cycle, perform these steps:

## 1. Check for Research Tasks

Use `tasks_list(type="research", status="pending")` to find pending research tasks.

For each task:
1. Use `tasks_claim(filename)` to lock it
2. Use `jobs_get(job_id)` to get job details
3. Research the company:
   - Search the web for company information
   - Find funding details on Crunchbase
   - Look for team members on LinkedIn
   - Identify potential contacts
4. Format findings using the research template
5. Use `research_save(job_id, notes)` to save
6. Use `tasks_complete(filename)` to finish

## 2. Check for Materials Tasks

Use `tasks_list(type="materials", status="pending")` to find pending materials tasks.

For each task:
1. Use `tasks_claim(filename)` to lock it
2. Use `jobs_get(job_id)` to get job details
3. Use `research_get(job_id)` to get research notes
4. Use `config_get()` to get user profile
5. Generate personalized cover letter
6. Use `materials_save_cover_letter(job_id, content)` to save
7. Generate personalized outreach email
8. Use `materials_save_email(job_id, content)` to save
9. Use `tasks_complete(filename)` to finish

## 3. Error Handling

If any step fails:
- Use `tasks_release(filename)` to unlock the task
- Log the error
- Continue to the next task

## 4. Token Tracking

Always include `log_tokens` parameter when saving research or materials to track costs.
```

### Start Heartbeat Mode

```bash
# Run with heartbeat enabled
openclaw --heartbeat --instructions instructions/prowla-heartbeat.md

# Or as a background service
openclaw --heartbeat --daemon
```

## Scheduled Scans

Add cron jobs for automated job discovery.

### Create Scan Script

Create `scripts/scan-jobs.sh`:

```bash
#!/bin/bash
openclaw --once --instructions instructions/prowla-scan.md
```

Create `instructions/prowla-scan.md`:

```markdown
# Job Board Scan

Scan job boards for new opportunities matching the user's criteria.

## Steps

1. Use `config_get()` to get search preferences
2. Search these job boards:
   - LinkedIn Jobs
   - Y Combinator Jobs
   - AngelList/Wellfound
3. For each potential match:
   - Use `query_by_company(name, fuzzy=true)` to check if exists
   - If new, use `jobs_create(...)` to add
   - Calculate priority based on fit
   - If high priority (85+), use `tasks_create_research(job_id)`
4. Use `tokens_log(...)` to track usage
```

### Add Cron Jobs

```bash
crontab -e
```

Add:
```
# Morning scan at 8 AM
0 8 * * * /path/to/openclaw/scripts/scan-jobs.sh >> /var/log/prowla-scan.log 2>&1

# Afternoon scan at 4 PM
0 16 * * * /path/to/openclaw/scripts/scan-jobs.sh >> /var/log/prowla-scan.log 2>&1
```

## Model Selection

Choose models based on task complexity:

| Task | Recommended Model | Why |
|------|-------------------|-----|
| Job discovery | Haiku | Fast, cheap, good enough for filtering |
| Deep research | Sonnet | Quality analysis, contact finding |
| Materials | Sonnet | Personalized, well-written |
| Dream jobs | Opus | Maximum quality |

### Configure Per-Task Models

In your heartbeat instructions:

```markdown
## Research Tasks
Use claude-sonnet-4-20250514 for research tasks.

## Discovery Tasks  
Use claude-3-haiku for job board scanning.
```

Or set dynamically based on priority:
```markdown
If job priority is "🔴 High":
  Use claude-sonnet-4-20250514
Else:
  Use claude-3-haiku
```

## Cost Management

### Set Budget Limits

In OpenClaw config:
```json
{
  "budget": {
    "daily_limit": 5.00,
    "weekly_limit": 25.00,
    "pause_on_exceed": true
  }
}
```

### Monitor Spending

Check costs regularly:
```bash
openclaw --query "Use tokens_get_cost for the past week"
```

### Optimize Costs

1. **Reduce heartbeat frequency** — Every 5 minutes instead of 1
2. **Raise auto-research threshold** — Only research 90+ priority jobs
3. **Use Haiku for discovery** — Save Sonnet for research
4. **Batch operations** — Process multiple tasks per heartbeat

## Logging

### Enable Detailed Logs

```bash
openclaw --heartbeat --verbose --log-file /var/log/openclaw.log
```

### Log Format

```
[2026-02-02T10:00:00] HEARTBEAT: Starting cycle
[2026-02-02T10:00:01] TASK: Claimed research-acme.json
[2026-02-02T10:00:15] RESEARCH: Completed for Acme AI
[2026-02-02T10:00:16] TASK: Completed research-acme.json
[2026-02-02T10:00:16] TOKENS: 15000 in, 2500 out, $0.08
[2026-02-02T10:00:17] HEARTBEAT: Cycle complete, sleeping 60s
```

### Monitor Logs

```bash
tail -f /var/log/openclaw.log | grep -E "(ERROR|WARN|TASK)"
```

## Running as a Service

### Using systemd (Linux)

Create `/etc/systemd/system/openclaw.service`:

```ini
[Unit]
Description=OpenClaw AI Agent
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/openclaw
ExecStart=/usr/bin/node index.js --heartbeat
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable openclaw
sudo systemctl start openclaw
sudo systemctl status openclaw
```

### Using launchd (macOS)

Create `~/Library/LaunchAgents/com.openclaw.agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/openclaw/index.js</string>
        <string>--heartbeat</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/openclaw.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/openclaw.error.log</string>
</dict>
</plist>
```

Load:
```bash
launchctl load ~/Library/LaunchAgents/com.openclaw.agent.plist
```

## Troubleshooting

### OpenClaw Not Finding ProwlA

1. Check MCP server path is absolute
2. Verify ProwlA server is running (`npm run dev`)
3. Test MCP server: `node /path/to/prowla/mcp-server/index.js --list`

### Tasks Not Processing

1. Check heartbeat is running
2. Verify tasks exist: `ls /path/to/prowla/tasks/`
3. Check for locked tasks (stale claims)
4. Review OpenClaw logs for errors

### High Costs

1. Check `tokens_get_cost()` for breakdown
2. Reduce heartbeat frequency
3. Increase priority threshold for auto-research
4. Switch to cheaper model for discovery

### OpenClaw Crashing

1. Check logs for errors
2. Ensure API key is valid
3. Check available disk space
4. Verify network connectivity

## Security

### API Key Protection

- Never commit API keys to git
- Use environment variables
- Rotate keys periodically

### Access Control

- Run OpenClaw as unprivileged user
- Limit file system access
- Monitor for unusual activity

### Data Security

- ProwlA database contains research notes
- Keep backups
- Don't expose server publicly

## Next Steps

- [../modes/AUTONOMOUS-MODE.md](../modes/AUTONOMOUS-MODE.md) — Full autonomous setup
- [WORKFLOW-EXAMPLES.md](WORKFLOW-EXAMPLES.md) — Agent patterns
- [MCP-REFERENCE.md](MCP-REFERENCE.md) — All available tools
