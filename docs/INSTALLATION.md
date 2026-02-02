# Installation Guide

Complete setup instructions for ProwlA.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** or **yarn** — Comes with Node.js
- **Git** — [Download](https://git-scm.com/)

Optional:
- **Anthropic API Key** — For AI-powered research and materials ([Get one](https://console.anthropic.com/))
- **Cursor** or **Claude Desktop** — For MCP integration

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/prowla.git
cd prowla

# Install all dependencies (client, server, mcp-server)
npm run setup

# Copy example configurations
cp config/profile.example.json config/profile.json
cp config/search.example.json config/search.json
cp .env.example .env

# Start the application
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Step-by-Step Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/prowla.git
cd prowla
```

### 2. Install Dependencies

Install dependencies for all packages:

```bash
npm run setup
```

This runs `npm install` in:
- Root directory
- `client/` (React frontend)
- `server/` (Express backend)
- `mcp-server/` (MCP tools)

### 3. Configure Your Profile

Copy and edit the profile configuration:

```bash
cp config/profile.example.json config/profile.json
```

Edit `config/profile.json` with your details:

```json
{
  "name": "Your Name",
  "title": "Your Job Title",
  "background": "Your professional background...",
  "skills": ["Skill 1", "Skill 2"],
  "highlights": ["Achievement 1", "Achievement 2"]
}
```

See [CONFIGURATION.md](CONFIGURATION.md) for all options.

### 4. Configure Search Criteria

Copy and edit the search configuration:

```bash
cp config/search.example.json config/search.json
```

Edit `config/search.json` with your job preferences:

```json
{
  "targetRoles": ["Product Designer", "UX Lead"],
  "remote": { "required": true },
  "compensation": {
    "salary": { "min": 120000 }
  }
}
```

### 5. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required for AI features
ANTHROPIC_API_KEY=your-api-key-here

# Server port (default: 3001)
PORT=3001
```

### 6. Start the Application

```bash
npm run dev
```

This starts:
- Express server on port 3001
- React dev server with HMR
- Proxies API requests from client to server

## Optional: MCP Integration

To use ProwlA with Cursor or Claude Desktop:

### For Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

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

Replace `/path/to/prowla` with your actual installation path.

### For Claude Desktop

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

Restart Cursor or Claude Desktop after adding the configuration.

## Optional: Autonomous Mode

For fully automated operation with OpenClaw, see [modes/AUTONOMOUS-MODE.md](modes/AUTONOMOUS-MODE.md).

## Verifying Installation

### Check the Web UI

1. Open [http://localhost:3001](http://localhost:3001)
2. You should see the ProwlA dashboard
3. Try adding a test job

### Check the API

```bash
curl http://localhost:3001/api/stats
```

Should return statistics JSON.

### Check MCP Server

```bash
cd mcp-server
node index.js --list
```

Should display all 28 available tools.

## Troubleshooting

### Port Already in Use

If port 3001 is taken:

```bash
# Change port in .env
PORT=3002

# Or kill the process using the port
lsof -i :3001
kill -9 <PID>
```

### Database Errors

If you see SQLite errors:

```bash
# The database is created automatically on first run
# If corrupted, delete and restart:
rm server/jobs.db*
npm run dev
```

### MCP Connection Issues

1. Verify the path in your MCP config is correct
2. Check that Node.js is in your PATH
3. Restart Cursor/Claude Desktop
4. Check MCP server logs

### Missing Dependencies

If you see module not found errors:

```bash
# Reinstall all dependencies
rm -rf node_modules client/node_modules server/node_modules mcp-server/node_modules
npm run setup
```

## Updating

To update to the latest version:

```bash
git pull
npm run setup
npm run dev
```

## Uninstalling

```bash
# Remove the directory
rm -rf /path/to/prowla

# Remove MCP configuration from Cursor/Claude Desktop
# Edit the respective config files and remove the "prowla" entry
```

## Next Steps

- [CONFIGURATION.md](CONFIGURATION.md) — Customize all settings
- [modes/MANUAL-MODE.md](modes/MANUAL-MODE.md) — Using without AI
- [modes/MCP-MODE.md](modes/MCP-MODE.md) — AI-assisted workflows
- [modes/AUTONOMOUS-MODE.md](modes/AUTONOMOUS-MODE.md) — Full automation
