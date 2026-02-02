#!/usr/bin/env node

/**
 * Job Tracker MCP Server
 * 
 * An MCP (Model Context Protocol) server that provides AI agents with
 * tools to manage job applications, research, and materials.
 * 
 * This server exposes 28 tools across 8 categories:
 * 
 * 1. Jobs (7 tools): CRUD operations, bulk updates, fuzzy search
 *    - jobs_list, jobs_get, jobs_create, jobs_update, jobs_delete
 *    - jobs_bulk_update, jobs_search
 * 
 * 2. Research (4 tools): Company research notes
 *    - research_get, research_save, research_save_batch, research_template
 * 
 * 3. Materials (3 tools): Cover letters and emails
 *    - materials_get, materials_save_cover_letter, materials_save_email
 * 
 * 4. Tasks (7 tools): Task queue management with locking
 *    - tasks_list, tasks_get, tasks_claim, tasks_release
 *    - tasks_complete, tasks_create_research, tasks_create_materials
 * 
 * 5. Events (4 tools): Event subscription and polling
 *    - events_subscribe, events_unsubscribe, events_list, events_poll
 * 
 * 6. Query (4 tools): Specialized queries
 *    - query_stats, query_by_company, query_needs_research, query_high_priority
 * 
 * 7. Config (3 tools): Settings management
 *    - config_get, config_update, config_get_rejected
 * 
 * 8. Tokens (3 tools): Usage tracking
 *    - tokens_log, tokens_get_usage, tokens_get_cost
 * 
 * Usage:
 *   node index.js              # Start server on stdio
 *   node index.js --help       # Show help
 * 
 * MCP Configuration (add to your MCP settings):
 * {
 *   "mcpServers": {
 *     "job-tracker": {
 *       "command": "node",
 *       "args": ["/path/to/job-tracker/mcp-server/index.js"]
 *     }
 *   }
 * }
 * 
 * @module mcp-server
 * @author Job Tracker Team
 * @version 1.0.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Import tool modules
import jobsTools from './tools/jobs.js';
import researchTools from './tools/research.js';
import materialsTools from './tools/materials.js';
import tasksTools from './tools/tasks.js';
import eventsTools from './tools/events.js';
import queryTools from './tools/query.js';
import configTools from './tools/config.js';
import tokensTools from './tools/tokens.js';

// Import utilities
import { closeDb } from './lib/db.js';

/**
 * Server metadata
 */
const SERVER_INFO = {
  name: 'job-tracker-mcp',
  version: '1.0.0',
  description: 'MCP server for managing job applications, research, and materials'
};

/**
 * Combine all tool definitions
 */
const allToolDefinitions = [
  ...jobsTools.toolDefinitions,
  ...researchTools.toolDefinitions,
  ...materialsTools.toolDefinitions,
  ...tasksTools.toolDefinitions,
  ...eventsTools.toolDefinitions,
  ...queryTools.toolDefinitions,
  ...configTools.toolDefinitions,
  ...tokensTools.toolDefinitions
];

/**
 * Combine all handlers into a single map
 */
const allHandlers = {
  ...jobsTools.handlers,
  ...researchTools.handlers,
  ...materialsTools.handlers,
  ...tasksTools.handlers,
  ...eventsTools.handlers,
  ...queryTools.handlers,
  ...configTools.handlers,
  ...tokensTools.handlers
};

/**
 * Create and configure the MCP server
 */
function createServer() {
  const server = new Server(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * Handler for listing available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  });

  /**
   * Handler for tool invocation
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Find handler
    const handler = allHandlers[name];
    if (!handler) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` })
          }
        ],
        isError: true
      };
    }

    try {
      // Execute handler
      const result = await handler(args || {});

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error(`Error executing ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              tool: name
            })
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Job Tracker MCP Server v${SERVER_INFO.version}

An MCP server providing AI agents with tools to manage job applications.

USAGE:
  node index.js              Start server (stdio transport)
  node index.js --help       Show this help message
  node index.js --list       List all available tools

AVAILABLE TOOLS (${allToolDefinitions.length} total):

Jobs (7):
  jobs_list                  Get jobs with filtering and pagination
  jobs_get                   Get a single job by ID
  jobs_create                Create a new job
  jobs_update                Update job fields
  jobs_delete                Delete a job (adds to rejected list)
  jobs_bulk_update           Update multiple jobs at once
  jobs_search                Fuzzy search across jobs

Research (4):
  research_get               Get research notes for a job
  research_save              Save completed research
  research_save_batch        Save research for multiple jobs
  research_template          Get the research template

Materials (3):
  materials_get              Get all materials for a job
  materials_save_cover_letter Save a cover letter
  materials_save_email       Save an outreach email

Tasks (7):
  tasks_list                 Get pending/in-progress tasks
  tasks_get                  Get a specific task
  tasks_claim                Lock a task for processing
  tasks_release              Release a claimed task
  tasks_complete             Mark task done and delete
  tasks_create_research      Queue research for a job
  tasks_create_materials     Queue materials generation

Events (4):
  events_subscribe           Register for event notifications
  events_unsubscribe         Remove subscription
  events_list                Get recent events
  events_poll                Long-poll for new events

Query (4):
  query_stats                Get dashboard statistics
  query_by_company           Find job by company name
  query_needs_research       Get jobs without research
  query_high_priority        Get high priority jobs

Config (3):
  config_get                 Get search preferences
  config_update              Update preferences
  config_get_rejected        Get rejected companies list

Tokens (3):
  tokens_log                 Log token usage
  tokens_get_usage           Get usage statistics
  tokens_get_cost            Get cost estimates

MCP CONFIGURATION:
  Add to your MCP settings (e.g., ~/.cursor/mcp.json):
  
  {
    "mcpServers": {
      "job-tracker": {
        "command": "node",
        "args": ["${process.cwd()}/index.js"]
      }
    }
  }

DOCUMENTATION:
  See README.md for detailed documentation on each tool.
`);
}

/**
 * List all tools in JSON format
 */
function listTools() {
  const tools = allToolDefinitions.map(t => ({
    name: t.name,
    description: t.description
  }));
  console.log(JSON.stringify(tools, null, 2));
}

/**
 * Main entry point
 */
async function main() {
  // Handle command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    listTools();
    process.exit(0);
  }

  // Create server
  const server = createServer();

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Handle shutdown
  process.on('SIGINT', () => {
    console.error('Shutting down...');
    closeDb();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    closeDb();
    process.exit(0);
  });

  // Connect server to transport
  console.error(`Starting ${SERVER_INFO.name} v${SERVER_INFO.version}...`);
  console.error(`Loaded ${allToolDefinitions.length} tools`);
  
  await server.connect(transport);
  
  console.error('Server running on stdio');
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  closeDb();
  process.exit(1);
});
