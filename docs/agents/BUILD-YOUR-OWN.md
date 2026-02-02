# Build Your Own Agent

Guide to building a custom agent that integrates with ProwlA.

## Overview

ProwlA's MCP server exposes 28 tools that any agent can use. You don't need OpenClaw — you can build your own agent in any language.

## Architecture

```
┌─────────────────┐     MCP Protocol     ┌─────────────────┐
│   Your Agent    │◄───────────────────►│  ProwlA MCP     │
│   (any lang)    │                      │  Server         │
└─────────────────┘                      └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  ProwlA Server  │
                                         │  (Express API)  │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │    SQLite DB    │
                                         └─────────────────┘
```

## Option 1: MCP Client

Use the official MCP SDK to communicate with ProwlA.

### JavaScript/TypeScript

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Connect to ProwlA MCP server
const transport = new StdioClientTransport({
  command: 'node',
  args: ['/path/to/prowla/mcp-server/index.js']
});

const client = new Client({
  name: 'my-agent',
  version: '1.0.0'
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log(tools);

// Call a tool
const result = await client.callTool({
  name: 'jobs_list',
  arguments: { priority: '🔴 High', limit: 10 }
});

console.log(result);
```

### Python

```python
from mcp import Client
import asyncio

async def main():
    # Connect to ProwlA
    client = Client()
    await client.connect_stdio(
        command='node',
        args=['/path/to/prowla/mcp-server/index.js']
    )
    
    # List jobs
    result = await client.call_tool('jobs_list', {
        'priority': '🔴 High',
        'limit': 10
    })
    
    print(result)

asyncio.run(main())
```

## Option 2: Direct API

Skip MCP and call ProwlA's REST API directly.

### API Endpoints

```
GET    /api/jobs              List jobs (with filters)
GET    /api/jobs/:id          Get single job
POST   /api/jobs              Create job
PATCH  /api/jobs/:id          Update job
DELETE /api/jobs/:id          Delete job

GET    /api/jobs/:id/materials   Get research/cover letter/email
POST   /api/jobs/:id/request-research    Queue research task
POST   /api/jobs/:id/request-materials   Queue materials task

GET    /api/tasks/status      List pending tasks
DELETE /api/tasks/:filename   Delete/complete task

GET    /api/stats             Dashboard statistics
POST   /api/search            Trigger job board scan
```

### JavaScript Example

```javascript
const BASE_URL = 'http://localhost:3001/api';

// Get high priority jobs
const response = await fetch(`${BASE_URL}/jobs?priority=🔴 High`);
const jobs = await response.json();

// Update job status
await fetch(`${BASE_URL}/jobs/432`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'Applied' })
});

// Request research
await fetch(`${BASE_URL}/jobs/432/request-research`, {
  method: 'POST'
});
```

### Python Example

```python
import requests

BASE_URL = 'http://localhost:3001/api'

# Get high priority jobs
response = requests.get(f'{BASE_URL}/jobs', params={'priority': '🔴 High'})
jobs = response.json()

# Update job status
requests.patch(f'{BASE_URL}/jobs/432', json={'status': 'Applied'})

# Request research
requests.post(f'{BASE_URL}/jobs/432/request-research')
```

## Option 3: Task File Interface

The simplest approach — just read/write JSON files.

### Creating Tasks

Write a JSON file to `tasks/` directory:

```python
import json
import os
from datetime import datetime

def create_research_task(job_id, company, role):
    task = {
        'type': 'research',
        'jobId': job_id,
        'company': company,
        'role': role,
        'status': 'pending',
        'createdAt': datetime.utcnow().isoformat() + 'Z'
    }
    
    slug = company.lower().replace(' ', '-')
    filename = f'research-{slug}.json'
    
    with open(f'/path/to/prowla/tasks/{filename}', 'w') as f:
        json.dump(task, f, indent=2)
    
    return filename
```

### Processing Tasks

```python
import os
import json
import glob

TASKS_DIR = '/path/to/prowla/tasks'

def get_pending_tasks():
    tasks = []
    for filepath in glob.glob(f'{TASKS_DIR}/*.json'):
        with open(filepath) as f:
            task = json.load(f)
            task['filename'] = os.path.basename(filepath)
            if task.get('status') == 'pending':
                tasks.append(task)
    return tasks

def claim_task(filename):
    filepath = f'{TASKS_DIR}/{filename}'
    with open(filepath) as f:
        task = json.load(f)
    
    task['status'] = 'in_progress'
    task['claimed_at'] = datetime.utcnow().isoformat() + 'Z'
    task['claimed_by'] = 'my-agent'
    
    with open(filepath, 'w') as f:
        json.dump(task, f, indent=2)

def complete_task(filename):
    filepath = f'{TASKS_DIR}/{filename}'
    os.remove(filepath)
```

## Building a Simple Agent

### Basic Structure

```python
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('my-agent')

class ProwlAAgent:
    def __init__(self, api_url='http://localhost:3001/api'):
        self.api_url = api_url
    
    def get_pending_tasks(self):
        response = requests.get(f'{self.api_url}/tasks/status')
        return response.json().get('tasks', [])
    
    def process_research_task(self, task):
        logger.info(f"Processing research for {task['company']}")
        
        # Get job details
        job = requests.get(f"{self.api_url}/jobs/{task['jobId']}").json()
        
        # Do your research here
        research_notes = self.research_company(job['company'], job['apply_url'])
        
        # Save research
        requests.patch(f"{self.api_url}/jobs/{task['jobId']}", json={
            'research_notes': research_notes,
            'materials': '🔍 Research'
        })
        
        # Complete task
        requests.delete(f"{self.api_url}/tasks/{task['filename']}")
        
        logger.info(f"Completed research for {task['company']}")
    
    def research_company(self, company, url):
        # Your research logic here
        # Could call Claude API, scrape websites, etc.
        return f"# {company} Research\n\nTODO: Add research"
    
    def run(self, interval=60):
        logger.info("Starting agent...")
        while True:
            tasks = self.get_pending_tasks()
            
            for task in tasks:
                if task['type'] == 'research':
                    self.process_research_task(task)
            
            logger.info(f"Sleeping {interval}s...")
            time.sleep(interval)

if __name__ == '__main__':
    agent = ProwlAAgent()
    agent.run()
```

### With Claude Integration

```python
import anthropic

class ProwlAAgent:
    def __init__(self):
        self.claude = anthropic.Client()
        # ... rest of init
    
    def research_company(self, company, url):
        response = self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": f"""Research the company "{company}" for a job application.

Company URL: {url}

Please provide:
1. Company overview
2. Recent funding/news
3. Key team members
4. Why they might be a good employer
5. Any red flags

Format as markdown."""
            }]
        )
        return response.content[0].text
```

## Event-Driven Architecture

Instead of polling, react to events.

### Webhook Receiver

```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    event = request.json
    
    if event['type'] == 'task.created':
        # Process new task
        process_task(event['payload'])
    
    elif event['type'] == 'job.created':
        # Maybe auto-research high priority
        if event['payload']['priority'] == '🔴 High':
            queue_research(event['payload']['job_id'])
    
    return 'OK'

# Subscribe to events (do once at startup)
requests.post('http://localhost:3001/api/events/subscribe', json={
    'event_types': ['task.created', 'job.created'],
    'webhook_url': 'http://your-agent.com/webhook'
})
```

## Best Practices

### 1. Handle Errors Gracefully

```python
def process_task(task):
    try:
        # Do work
        complete_task(task['filename'])
    except Exception as e:
        logger.error(f"Failed: {e}")
        release_task(task['filename'])  # Let another agent try
```

### 2. Track Token Usage

```python
def research_company(self, company):
    response = self.claude.messages.create(...)
    
    # Log usage
    requests.post(f'{self.api_url}/tokens/log', json={
        'task_type': 'research',
        'input_tokens': response.usage.input_tokens,
        'output_tokens': response.usage.output_tokens,
        'model': 'claude-sonnet-4-20250514'
    })
    
    return response.content[0].text
```

### 3. Respect Rate Limits

```python
import time
from functools import wraps

def rate_limit(calls_per_minute):
    interval = 60 / calls_per_minute
    last_call = [0]
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_call[0]
            if elapsed < interval:
                time.sleep(interval - elapsed)
            last_call[0] = time.time()
            return func(*args, **kwargs)
        return wrapper
    return decorator

@rate_limit(calls_per_minute=10)
def call_claude(prompt):
    # ...
```

### 4. Use Task Locking

Always claim tasks before processing to prevent duplicates.

### 5. Log Everything

```python
logger.info(f"Claimed task: {task['filename']}")
logger.info(f"Research complete for: {task['company']}")
logger.error(f"Failed to process: {task['filename']}, error: {e}")
```

## Testing Your Agent

```bash
# Create a test task
curl -X POST http://localhost:3001/api/jobs/1/request-research

# Watch for your agent to pick it up
tail -f agent.log

# Verify results
curl http://localhost:3001/api/jobs/1/materials | jq .research_notes
```

## Examples in Other Languages

### Go

```go
package main

import (
    "encoding/json"
    "net/http"
    "time"
)

type Task struct {
    Type     string `json:"type"`
    JobID    int    `json:"jobId"`
    Company  string `json:"company"`
    Filename string `json:"filename"`
}

func getPendingTasks() []Task {
    resp, _ := http.Get("http://localhost:3001/api/tasks/status")
    var result struct {
        Tasks []Task `json:"tasks"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Tasks
}

func main() {
    for {
        tasks := getPendingTasks()
        for _, task := range tasks {
            processTask(task)
        }
        time.Sleep(60 * time.Second)
    }
}
```

### Rust

```rust
use reqwest;
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration};

#[derive(Deserialize)]
struct Task {
    #[serde(rename = "type")]
    task_type: String,
    #[serde(rename = "jobId")]
    job_id: i32,
    company: String,
    filename: String,
}

async fn get_pending_tasks() -> Vec<Task> {
    let response: serde_json::Value = reqwest::get("http://localhost:3001/api/tasks/status")
        .await.unwrap()
        .json().await.unwrap();
    
    serde_json::from_value(response["tasks"].clone()).unwrap_or_default()
}

#[tokio::main]
async fn main() {
    loop {
        let tasks = get_pending_tasks().await;
        for task in tasks {
            process_task(&task).await;
        }
        sleep(Duration::from_secs(60)).await;
    }
}
```

## Next Steps

- Review [MCP-REFERENCE.md](MCP-REFERENCE.md) for all available tools
- Study [WORKFLOW-EXAMPLES.md](WORKFLOW-EXAMPLES.md) for patterns
- Check [OPENCLAW-SETUP.md](OPENCLAW-SETUP.md) if you want to use OpenClaw instead
