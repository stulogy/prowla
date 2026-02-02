# Contributing to ProwlA

Thank you for your interest in contributing to ProwlA! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be kind, be respectful, be helpful. We're all here to make job hunting less painful.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node version, browser)
   - Screenshots if applicable

### Suggesting Features

1. Check existing issues/discussions
2. Describe the problem you're trying to solve
3. Explain your proposed solution
4. Consider how it fits with existing features

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/yourusername/prowla.git
cd prowla

# Install dependencies
npm run setup

# Copy configs
cp config/profile.example.json config/profile.json
cp config/search.example.json config/search.json
cp .env.example .env

# Start development
npm run dev
```

## Project Structure

```
prowla/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── App.jsx       # Main app component
│   └── vite.config.js
│
├── server/           # Express backend
│   ├── index.js          # Server entry point
│   └── token-logger.js   # Token usage tracking
│
├── mcp-server/       # MCP tools
│   ├── index.js          # MCP server entry
│   ├── lib/              # Shared utilities
│   └── tools/            # Tool implementations
│
├── config/           # Configuration files
└── docs/             # Documentation
```

## Code Style

### JavaScript
- Use ES modules (`import`/`export`)
- Prefer `const` over `let`
- Use async/await over raw promises
- Add JSDoc comments for public functions

### React
- Functional components with hooks
- Keep components focused and small
- Use descriptive prop names

### CSS
- Use CSS variables for theming
- Mobile-first responsive design
- Dark mode support

## Testing

```bash
# Run all tests
npm test

# Test specific component
npm test -- --grep "JobTable"
```

## Documentation

- Update docs if you change behavior
- Add JSDoc comments to new functions
- Include examples for new MCP tools

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add bulk job import from CSV
fix: resolve date parsing issue in job modal
docs: update MCP tool reference
refactor: simplify task queue logic
```

Prefixes:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code refactoring
- `test:` — Tests
- `chore:` — Maintenance

## MCP Tool Guidelines

When adding new MCP tools:

1. Add to appropriate category in `mcp-server/tools/`
2. Follow existing input/output patterns
3. Include error handling
4. Add tool to `mcp-server/README.md`
5. Test with actual MCP client

Example tool structure:

```javascript
// mcp-server/tools/example.js

/**
 * Example tool description
 * @param {Object} input - Tool input
 * @param {number} input.job_id - Job ID to process
 * @returns {Object} Result with success status
 */
export function exampleTool(input) {
  const { job_id } = input;
  
  // Validate input
  if (!job_id) {
    return { error: "job_id is required" };
  }
  
  // Do work...
  
  return {
    success: true,
    job_id,
    result: "..."
  };
}
```

## Questions?

- Open a Discussion for general questions
- Open an Issue for bugs or feature requests
- Check existing docs first

Thank you for contributing! 🐾
