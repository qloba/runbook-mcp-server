# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides Claude with access to Runbook's document management and workflow automation capabilities. The server exposes tools for searching articles, managing books, and executing workflows through a standardized MCP interface.

## Development Commands

```bash
# Build the project
npm run build

# Watch mode for development
npm run watch

# Run tests
npm test

# Run only unit tests
npm run unit

# Lint code
npm run lint

# Start the server locally
npm start
```

## Architecture

The codebase follows a modular MCP server architecture:

### Core Structure
- **src/server.ts**: MCP server setup using `@modelcontextprotocol/sdk/server/index.js`
- **src/tools/tools.ts**: All tool implementations (search, get, list, process operations)
- **src/resources/resources.ts**: Resource handlers for `runbook://books/*` and `runbook://articles/*` URIs
- **src/queries/**: GraphQL query definitions for Runbook API integration
- **src/types.ts**: TypeScript type definitions for all GraphQL operations

### Key Patterns

**Handler Objects**: Both tools and resources use handler objects with `description`, `inputSchema`, and `handler` properties. Tools are dynamically registered using `Object.entries(toolHandlers)`.

**GraphQL Integration**: Uses `@runbook-docs/client` with custom queries stored in separate files. All operations are strongly typed with TypeScript interfaces.

**Configuration Management**: Supports multiple config sources (CLI args > env vars > config file > defaults) with the `config.ts` module.

**Prefix System**: Tool names use `withPrefix()` function to support multiple server instances with different prefixes.

## Working with Tools

When adding new tools:
1. Add the handler to `toolHandlers` object in `src/tools/tools.ts`
2. Use the naming pattern: `[withPrefix('tool-name')]`
3. Include proper `inputSchema` with required fields
4. Handle errors gracefully and return structured responses

## Working with Resources

Resources use URI patterns like `runbook://books/{bookUid}` and `runbook://articles/{articleUid}`. The `readResource` handler matches URIs with regex patterns and calls appropriate GraphQL operations.

## GraphQL Operations

All GraphQL queries/mutations are in `src/queries/` directory. Import the query file and use `runbook.graphql()` or `runbook.query()` methods. Type the operations using interfaces from `src/types.ts`.

## Configuration

The server reads configuration from multiple sources with this precedence:
1. Command line arguments (`--api-token`, `--base-url`, etc.)
2. Environment variables (`RUNBOOK_*`)
3. Config file (`src/env/config.json`)
4. Default values

## Testing

Run `npm test` to build and run Jest unit tests. Test files should follow the pattern `*.test.ts` and use the Jest + ts-jest configuration.

## Workflow System

The server supports Runbook's workflow capabilities through `get-process` and `run-process` tools. These handle workflow state management, property values for form inputs, and run state tracking. Workflows require `bookType: 'workflow'` and use special GraphQL mutations for execution.