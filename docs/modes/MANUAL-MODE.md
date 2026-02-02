# Manual Mode

Use ProwlA as a standalone job tracking application without any AI features.

## Overview

Manual mode is perfect if you:
- Want a clean, focused job tracker
- Don't have an Anthropic API key
- Prefer to do your own research
- Just want to organize your job search

## Setup

1. Follow the [Installation Guide](../INSTALLATION.md)
2. Skip the `ANTHROPIC_API_KEY` in `.env`
3. Start the app: `npm run dev`

That's it! No API keys required for basic functionality.

## Features Available

### ✅ Full Functionality
- Add, edit, delete jobs
- Update status (Not Started → Applied → Interviewing → Offer)
- Set priority levels
- Filter and search
- View statistics
- Dark mode

### ⚠️ Limited Without API Key
- Research notes (manual entry only)
- Cover letters (manual entry only)
- Outreach emails (manual entry only)

### ❌ Not Available
- AI-powered company research
- Automated materials generation
- Job board scanning

## Using the Interface

### Adding a Job

1. Click **"+ Add Job"** button
2. Fill in the details:
   - **Company** (required)
   - **Role** (required)
   - **Priority** — How interested are you?
   - **Type** — Full-time, Contract, Fractional
   - **Compensation** — Salary or hourly rate
   - **Source** — Where you found it
   - **Apply URL** — Link to application

3. Click **Save**

### Tracking Status

Use the status dropdown to track progress:

| Status | Meaning |
|--------|---------|
| Not Started | Just added, haven't applied |
| Researching | Looking into the company |
| Applied | Application submitted |
| Interviewing | In the interview process |
| Offer | Received an offer |
| Rejected | Didn't work out |
| Withdrawn | You withdrew |

### Using Filters

Filter your jobs by:
- **Status** — See only "Applied" jobs
- **Priority** — Focus on high-priority opportunities
- **Source** — See jobs from specific sources
- **Only New** — Recent additions

### Adding Research Notes

Click on any job to open the detail modal, then:

1. Go to the **Research** tab
2. Click in the text area
3. Add your notes (supports Markdown)
4. Notes auto-save

Suggested research to include:
- Company background
- Recent funding/news
- Key people to contact
- Why it's a good fit
- Red flags or concerns

### Adding Materials

In the job detail modal:

1. Go to the **Cover Letter** or **Email** tab
2. Write your content
3. Auto-saves as you type

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close modal |
| `n` | New job (when no modal open) |

## Workflow Tips

### Daily Routine

1. **Morning**: Check for new opportunities on job boards
2. **Add jobs**: Quick-add interesting roles
3. **Research**: Pick 2-3 high-priority jobs to research
4. **Apply**: Submit applications for researched jobs
5. **Update**: Mark statuses as you progress

### Organization

- Use **Priority** to rank opportunities
- Use **Status** to track pipeline
- Use **Notes** for quick reminders
- Use **Research** for detailed company info

### Staying Focused

- Filter to "Not Started" to see what needs work
- Filter to "High Priority" to focus on best opportunities
- Use "Only New" after adding a batch

## Importing Existing Data

If you have jobs in a spreadsheet:

### CSV Import (Coming Soon)

Currently, bulk import via API:

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Acme Inc",
    "role": "Product Designer",
    "priority": "🔴 High",
    "source": "LinkedIn"
  }'
```

## Exporting Data

### Via API

```bash
# Get all jobs as JSON
curl http://localhost:3001/api/jobs > my-jobs.json
```

### Direct Database Access

The SQLite database is at `server/jobs.db`. You can:
- Open with any SQLite client
- Query directly
- Export to CSV

```bash
sqlite3 server/jobs.db ".mode csv" ".headers on" "SELECT * FROM jobs" > jobs.csv
```

## Upgrading to AI Features

When you're ready to add AI capabilities:

1. Get an [Anthropic API key](https://console.anthropic.com/)
2. Add to `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
3. Restart the server
4. AI research and materials buttons become active

See [MCP-MODE.md](MCP-MODE.md) for AI-assisted workflows.

## Troubleshooting

### Jobs Not Saving

1. Check the browser console for errors
2. Ensure the server is running (`npm run dev`)
3. Check server logs in terminal

### Filters Not Working

- Clear all filters and try again
- Refresh the page
- Check if jobs actually match your criteria

### Slow Performance

If you have many jobs (500+):
- Use filters to reduce visible jobs
- Consider archiving old applications

## Next Steps

- [MCP-MODE.md](MCP-MODE.md) — Add AI assistance
- [../CONFIGURATION.md](../CONFIGURATION.md) — Customize settings
