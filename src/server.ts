#!/usr/bin/env node

import { CallToolResult, Server } from '@modelcontextprotocol/server';
import { resourceHandlers } from './resources/resources';
import { toolHandlers } from './tools/tools';
import { promptHandlers } from './prompts/prompts';
import { McpState } from './state';
import { RequestError } from '@runbook-docs/client';

function kebabToPascal(kebab: string): string {
  if (!kebab) return '';
  return kebab
    .split('-')
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

function getErrorResponse(e: any): CallToolResult {
  let text;
  if (e instanceof RequestError) {
    text = JSON.stringify(e.attributes);
  } else {
    text = e instanceof Error ? e.message : String(e);
  }
  return {
    content: [
      {
        type: 'text' as const,
        text
      }
    ],
    isError: true
  };
}

export async function buildServer(state: McpState) {
  const server = new Server(
    {
      name: kebabToPascal(state.name),
      version: '1.10.0'
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      },
      instructions: `
This MCP server provides access to Runbook for document management and business workflow automation.
Always use Runbook MCP tools (e.g. runbook-create-article, runbook-update-article, runbook-list-articles) to interact with Runbook. Never attempt alternative approaches such as direct HTTP requests or curl commands instead of using these tools.
This MCP server connects to the Runbook tenant: ${state.baseUrl}.
When multiple Runbook MCP servers are configured, each connects to a different tenant. Always confirm which tenant the user intends to operate on before creating or updating content. If unclear, ask the user to specify the target tenant.
`
    }
  );

  const debugEnabled = !!process.env.RUNBOOK_DEBUG;

  const resourceHandlersInstance = resourceHandlers(state);
  const toolHandlersInstance = toolHandlers(state);
  const promptHandlersInstance = promptHandlers(state);

  // Resource errors propagate as JSON-RPC errors; unlike tools, resource
  // results have no isError field to carry them.
  server.setRequestHandler('resources/list', async () => {
    return { resources: await resourceHandlersInstance.listResources() };
  });

  server.setRequestHandler('resources/read', async (request) => {
    const { uri } = request.params;
    const content = await resourceHandlersInstance.readResource(uri);
    return {
      contents: [
        {
          uri,
          text: content,
          mimeType: 'application/json'
        }
      ]
    };
  });

  server.setRequestHandler('resources/templates/list', () => {
    return resourceHandlersInstance.listResourceTemplates();
  });

  server.setRequestHandler('tools/list', async () => {
    return {
      tools: Object.entries(toolHandlersInstance).map(([name, handler]) => ({
        name,
        description: handler.description,
        inputSchema: handler.inputSchema,
        annotations: handler.annotations
      }))
    };
  });

  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlersInstance[name];

    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    if (debugEnabled) {
      console.error(`[runbook-mcp][call] ${name}`, JSON.stringify(args));
    }
    try {
      const response = await handler.handler(args);
      if (debugEnabled) {
        console.error(
          `[runbook-mcp][response] ${name}`,
          JSON.stringify(response, null, 2)
        );
      }
      return response;
    } catch (e) {
      if (debugEnabled) {
        console.error(`[runbook-mcp][error] ${name}`, e);
      }
      return getErrorResponse(e);
    }
  });

  server.setRequestHandler('prompts/list', async () => {
    return {
      prompts: Object.entries(promptHandlersInstance).map(([, handler]) => ({
        name: handler.name,
        title: handler.title || handler.name,
        description: handler.description,
        arguments: handler.arguments
      }))
    };
  });

  server.setRequestHandler('prompts/get', async (request) => {
    const { name, arguments: args } = request.params;
    const handler = promptHandlersInstance[name];

    if (!handler) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    // Simple template replacement
    let prompt = handler.prompt;

    if (args) {
      for (const [key, value] of Object.entries(args)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        prompt = prompt.replace(regex, String(value));
      }

      // Handle conditional blocks like {{#if runStateUid}}
      prompt = prompt.replace(
        /{{#if (\w+)}}([^}]*){{\/if}}/g,
        (_, condition, content) => {
          return args[condition] ? content : '';
        }
      );
    }

    return {
      description: handler.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt
          }
        }
      ]
    };
  });

  return server;
}
