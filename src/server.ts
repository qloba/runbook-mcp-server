#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import config from './config';
import { resourceHandlers } from './resources/resources';
import { toolHandlers } from './tools/tools';
import { promptHandlers } from './prompts/prompts';

function serverName() {
  const name = 'Runbook';
  return config.prefix ? `${name}-${config.prefix}` : name;
}

async function buildServer() {
  const server = new Server(
    {
      name: serverName(),
      version: '1.1.1'
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}
      },
      instructions:
        config.description ||
        'This MCP server can retrieve documents from Runbook. It can also run workflows.'
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: await resourceHandlers.listResources() };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const content = await resourceHandlers.readResource(uri);
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
    resourceHandlers.listResourceTemplates()
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(toolHandlers).map(([name, handler]) => ({
        name,
        description: handler.description,
        inputSchema: handler.inputSchema,
        annotations: handler.annotations
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];

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
    const handler = promptHandlers[name];

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

export async function runServer() {
  console.error(`Base URL ${config.baseUrl}. Starting server.`);
  const server = await buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
