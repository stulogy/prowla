# MCP Mode

Use ProwlA with AI assistants through the Model Context Protocol (MCP).

## Overview

MCP mode lets you interact with ProwlA through AI assistants like:
- **Cursor** (Agent mode)
- **Claude Desktop**
- Any MCP-compatible client

Instead of clicking buttons, you ask the AI to help:

```
You: "Research the company Acme AI and tell me if it's a good fit"
AI: *uses ProwlA tools to research, save notes, and provide analysis*
```

## Prerequisites

- ProwlA installed and running
- Anthropic API key in `.env`
- Cursor or Claude Desktop

## Setup

### For Cursor

1. Open Cursor Settings
2. Navigate to MCP configuration
3. Add ProwlA server:

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

4. Restart Cursor

### For Claude Desktop

1. Open Claude Desktop config:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add ProwlA server:

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

3. Restart Claude Desktop

### Verify Connection

In Cursor or Claude Desktop, try:

```
What tools do you have available from ProwlA?
```

You should see a list of available tools.

## Available Tools

ProwlA provides 28 MCP tools across 8 categories:

| Category | Tools | What they do |
|----------|-------|--------------|
| **Jobs** | 7 | Add, update, delete, search jobs |
| **Research** | 4 | Get/save company research notes |
| **Materials** | 3 | Manage cover letters and emails |
| **Tasks** | 7 | Queue and process async tasks |
| **Events** | 4 | Subscribe to real-time updates |
| **Query** | 4 | Stats, find by company, filters |
| **Config** | 3 | Get/update preferences |
| **Tokens** | 3 | Track AI usage and costs |

See [../agents/MCP-REFERENCE.md](../agents/MCP-REFERENCE.md) for complete documentation.

## Common Workflows

### Research a Company

```
You: "Research Acme AI - they're hiring for a Product Designer role"

AI: I'll research Acme AI for you.
    *uses jobs_search to find if job exists*
    *uses web search to gather company info*
    *uses research_save to store findings*
    
    Here's what I found about Acme AI:
    - Series A startup, $12M raised
    - Building AI tools for designers
    - 25 employees, growing fast
    - Good fit because...
```

### Add a New Job

```
You: "Add a job: Senior Product Designer at TechCorp, found on LinkedIn, 
      looks like $180k salary, remote"

AI: *uses jobs_create*
    
    Added! Job #245: Senior Product Designer at TechCorp
    - Priority: 🟡 Medium (based on your criteria)
    - Source: LinkedIn
    - Compensation: $180k
```

### Generate Materials

```
You: "Write a cover letter for the TechCorp position"

AI: *uses jobs_get to get job details*
    *uses research_get to get company research*
    *reads your profile from config*
    *generates personalized cover letter*
    *uses materials_save_cover_letter*
    
    Here's your cover letter:
    [displays cover letter]
    
    Saved to the job record.
```

### Daily Review

```
You: "What's my job search status? Any high-priority jobs I should focus on?"

AI: *uses query_stats*
    *uses query_high_priority*
    
    Your job search overview:
    - 45 total jobs tracked
    - 12 applied, 3 interviewing
    - 5 high-priority jobs need attention:
      1. Acme AI - Senior Designer (no research yet)
      2. TechCorp - Product Lead (applied, follow up?)
      ...
```

### Batch Operations

```
You: "Mark jobs 234, 235, and 236 as 'Researching'"

AI: *uses jobs_bulk_update*
    
    Updated 3 jobs to "Researching" status.
```

### Find Specific Jobs

```
You: "Do I have any jobs from Y Combinator companies?"

AI: *uses jobs_search with query "YC" or "Y Combinator"*
    
    Found 8 jobs from YC companies:
    1. Acme AI (W24) - Product Designer
    2. BuildCo (S23) - UX Lead
    ...
```

## Tips for Effective Use

### Be Specific

```
❌ "Research that company"
✅ "Research Acme AI for the Product Designer role (job #432)"
```

### Batch Requests

```
❌ "Research Acme" then "Research TechCorp" then "Research BuildCo"
✅ "Research these three companies: Acme, TechCorp, and BuildCo"
```

### Use Context

```
✅ "Based on my profile, is this role at Acme a good fit? 
    Consider my preference for remote work and B2B SaaS."
```

### Request Specific Outputs

```
✅ "Write a cover letter for Acme. Keep it under 300 words.
    Emphasize my design systems experience."
```

## Combining with Web UI

MCP mode works alongside the web UI:

1. **Add jobs** via UI or MCP — both update the same database
2. **View results** in UI after MCP operations
3. **Quick edits** in UI, complex operations via MCP

The UI auto-refreshes when data changes.

## Error Handling

If something goes wrong:

```
You: "Why did that fail?"

AI: The research_save tool returned an error: "Job not found"
    The job ID 999 doesn't exist. Let me check what jobs you have...
    *uses jobs_list*
```

Common issues:
- **Job not found**: Wrong job ID
- **Already exists**: Trying to create duplicate
- **Invalid status**: Using wrong status value

## Cost Awareness

Track your AI usage:

```
You: "How much have I spent on AI this week?"

AI: *uses tokens_get_cost*
    
    This week's usage:
    - Research: $4.25 (17 jobs)
    - Materials: $2.80 (8 cover letters)
    - Total: $7.05
```

## Privacy Notes

When using MCP mode:
- Your profile data is read from local config files
- Research notes are stored in local SQLite database
- API calls go to Anthropic (for Claude) and any web searches
- No data is sent to ProwlA servers (there aren't any)

## Troubleshooting

### Tools Not Appearing

1. Check MCP server path is correct and absolute
2. Verify `mcp-server/index.js` exists
3. Restart Cursor/Claude Desktop
4. Check for errors: `node mcp-server/index.js --list`

### "Server Not Connected"

1. Ensure ProwlA server is running (`npm run dev`)
2. MCP server needs the Express API running
3. Check port 3001 is accessible

### Slow Responses

MCP operations involve:
1. MCP client → MCP server
2. MCP server → Express API
3. Express API → Database

If slow, check each component.

## Next Steps

- [../agents/MCP-REFERENCE.md](../agents/MCP-REFERENCE.md) — Complete tool documentation
- [../agents/WORKFLOW-EXAMPLES.md](../agents/WORKFLOW-EXAMPLES.md) — Advanced workflows
- [AUTONOMOUS-MODE.md](AUTONOMOUS-MODE.md) — Full automation with OpenClaw
