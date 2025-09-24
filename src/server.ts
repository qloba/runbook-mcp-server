#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { resourceHandlers } from './resources/resources';
import { toolHandlers } from './tools/tools';
import { promptHandlers } from './prompts/prompts';
import { McpState } from './state';

function kebabToPascal(kebab: string): string {
  if (!kebab) return '';
  return kebab
    .split('-')
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

export async function buildServer(state: McpState) {
  const server = new Server(
    {
      name: kebabToPascal(state.name),
      version: '1.2.1'
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      },
      instructions:
        'This MCP server can retrieve documents from Runbook. It can also run business workflows.'
    }
  );

  const resourceHandlersInstance = resourceHandlers(state);
  const toolHandlersInstance = toolHandlers(state);
  const promptHandlersInstance = promptHandlers(state);

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: await resourceHandlersInstance.listResources() };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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

  server.setRequestHandler(ListResourceTemplatesRequestSchema, () =>
    resourceHandlersInstance.listResourceTemplates()
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(toolHandlersInstance).map(([name, handler]) => ({
        name,
        description: handler.description,
        inputSchema: handler.inputSchema,
        annotations: handler.annotations
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlersInstance[name];

    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await handler.handler(args);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: Object.entries(promptHandlers).map(([, handler]) => ({
        name: handler.name,
        title: handler.title || handler.name,
        description: handler.description,
        arguments: handler.arguments
      }))
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
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
