# Agent Workflow Examples

Common patterns for building agents that work with ProwlA.

## Research Workflow

Process a research task from start to finish.

```
1. tasks_list(type="research", status="pending")
   → Get available research tasks

2. tasks_claim("research-acme.json", agent_id="my-agent")
   → Lock the task (prevents other agents)

3. jobs_get(432)
   → Get full job details (company, role, URL)

4. research_template()
   → Get the research template structure

5. [Perform research]
   - Web search for company
   - Check Crunchbase for funding
   - Find LinkedIn profiles
   - Identify key contacts

6. research_save(432, research_notes, log_tokens={...})
   → Save findings to database

7. tasks_complete("research-acme.json", log_tokens={...})
   → Remove task from queue
```

### Error Handling

```
If step 5 fails:
  tasks_release("research-acme.json")
  → Unlock so another agent can try

If step 6 fails:
  → Don't complete the task
  → Log error and release
```

## Materials Generation Workflow

Generate cover letter and email for a job.

```
1. tasks_claim("materials-acme.json")
   → Lock the task

2. jobs_get(432)
   → Get job details

3. research_get(432)
   → Get existing research notes

4. config_get()
   → Get user profile and preferences

5. [Generate cover letter]
   - Use profile background
   - Reference research findings
   - Tailor to job requirements

6. materials_save_cover_letter(432, content, log_tokens={...})
   → Save cover letter

7. [Generate outreach email]
   - Use contact from research
   - Keep concise
   - Include call-to-action

8. materials_save_email(432, content, log_tokens={...})
   → Save email

9. tasks_complete("materials-acme.json")
   → Done
```

## Discovery Workflow

Find new jobs and add to database.

```
1. config_get()
   → Get search criteria (roles, industries, remote, etc.)

2. [Search job boards]
   - LinkedIn
   - Y Combinator
   - AngelList
   - etc.

3. For each found job:
   
   a. query_by_company(company_name, fuzzy=true)
      → Check if already exists
   
   b. If exists: skip or update
   
   c. If new:
      jobs_create({
        company: "...",
        role: "...",
        source: "LinkedIn",
        apply_url: "...",
        compensation: "..."
      })
      → Add to database
   
   d. [Calculate priority score]
      - Match against criteria
      - Consider funding, stage, etc.
   
   e. jobs_update(job_id, { priority: "🔴 High" })
      → Set priority

4. For high-priority jobs (score >= 85):
   tasks_create_research(job_id)
   → Auto-queue for research

5. tokens_log(task_type="discovery", ...)
   → Track usage
```

## Event-Driven Processing

React to events in real-time instead of polling.

```
1. events_subscribe(["task.created", "job.created"])
   → Get subscription_id

2. Loop:
   events_poll(subscription_id, timeout_ms=30000)
   → Wait for events (up to 30 seconds)
   
   For each event:
     if event.type == "task.created":
       → Process the task
     
     if event.type == "job.created":
       → Maybe send notification
```

### Subscription Management

```
# List active subscriptions
events_list(type="subscription")

# Clean up when done
events_unsubscribe(subscription_id)
```

## Daily Digest Workflow

Generate a summary of job search progress.

```
1. query_stats()
   → Get overall statistics

2. jobs_list(only_new=true)
   → Get jobs added today

3. query_high_priority(status="Not Started")
   → Jobs needing attention

4. query_needs_research(priority="🔴 High")
   → High-priority jobs without research

5. tokens_get_cost(start_date=today, end_date=today)
   → Today's AI spending

6. [Format digest]
   - New opportunities: X
   - High priority pending: Y
   - Research needed: Z
   - Spent today: $X.XX
```

## Batch Research Workflow

Research multiple companies efficiently.

```
1. query_needs_research(limit=10, priority="🔴 High")
   → Get jobs needing research

2. For each job (in parallel if possible):
   
   a. tasks_create_research(job_id)
      → Queue research task
   
   b. tasks_claim(filename)
      → Lock immediately
   
   c. [Do research in parallel]
   
   d. research_save(job_id, notes)
   
   e. tasks_complete(filename)

3. research_save_batch(items)
   → Alternative: save all at once (faster)
```

## Follow-Up Workflow

Track jobs that need follow-up.

```
1. jobs_list(status="Applied")
   → Get all applied jobs

2. For each job:
   if (today - applied_date) > 7 days:
     if no follow_up_date:
       → Flag for follow-up

3. jobs_search(query="follow up needed")
   → Find jobs with follow-up notes

4. [Send notifications or update status]
```

## Cost-Optimized Research

Use cheaper model for initial scan, expensive for deep research.

```
# Phase 1: Quick scan (Haiku)
1. [Light research with cheap model]
   - Basic company info
   - Recent news headlines
   - Quick fit assessment

2. If looks promising:
   jobs_update(job_id, { priority: "🔴 High" })
   tasks_create_research(job_id)
   → Queue for deep research

# Phase 2: Deep research (Sonnet)
3. [Full research with quality model]
   - Detailed funding analysis
   - Team/founder profiles
   - Contact discovery
   - Strategic fit assessment

4. research_save(job_id, detailed_notes, log_tokens={model: "sonnet"})
```

## Multi-Agent Coordination

Multiple agents working together.

```
Agent 1 (Discovery):
  - Scans job boards
  - Creates jobs
  - Queues research tasks

Agent 2 (Research):
  - Monitors task queue
  - Claims and processes research
  - Never does discovery

Agent 3 (Materials):
  - Only processes materials tasks
  - Generates cover letters
  - Generates emails

Coordination:
  - Task locking prevents conflicts
  - Events notify other agents
  - Each agent has specific role
```

### Preventing Conflicts

```
# Always claim before processing
result = tasks_claim(filename, agent_id="agent-2")

if not result.success:
  # Another agent got it
  → Skip and try next task

# Release on failure
try:
  [process task]
except:
  tasks_release(filename)
  raise
```

## Integration Patterns

### With Webhooks

```
1. events_subscribe(
     event_types=["job.created"],
     webhook_url="https://your-service.com/webhook"
   )

2. Your service receives POST:
   {
     "type": "job.created",
     "payload": { "job_id": 500, "company": "Acme" }
   }

3. Process externally
```

### With External Services

```
# After research completes
1. research_save(job_id, notes)

2. [Call external service]
   - Send to CRM
   - Update Notion database
   - Trigger Slack notification
   - etc.
```

## Best Practices

### Always Claim Tasks First
```
# Good
claim → process → complete

# Bad  
process → complete (race condition!)
```

### Log Token Usage
```
# Track costs for each operation
research_save(job_id, notes, log_tokens={
  input: 15000,
  output: 2500,
  model: "claude-sonnet-4-20250514"
})
```

### Handle Failures Gracefully
```
try:
  [do work]
  tasks_complete(filename)
except:
  tasks_release(filename)
  [log error]
```

### Respect Rate Limits
```
# Don't hammer the API
for job in jobs:
  [process]
  sleep(1)  # Brief pause between operations
```

### Use Batch Operations
```
# Good: One call for multiple updates
jobs_bulk_update([1,2,3], { status: "Researching" })

# Bad: Multiple calls
jobs_update(1, { status: "Researching" })
jobs_update(2, { status: "Researching" })
jobs_update(3, { status: "Researching" })
```
