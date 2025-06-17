#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import config from './config';
import { resourceHandlers } from './resources/resources';
import { toolHandlers } from './tools/tools';

function serverName() {
  const name = 'Runbook';
  return config.prefix ? `${name}-${config.prefix}` : name;
}

async function buildServer() {
  const server = new Server(
    {
      name: serverName(),
      version: '1.0.7'
    },
    {
      capabilities: {
        resources: {},
        tools: {}
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
        inputSchema: handler.inputSchema
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

  return server;
}

export async function runServer() {
  console.error(`Base URL ${config.baseUrl}. Starting server.`);
  const server = await buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
