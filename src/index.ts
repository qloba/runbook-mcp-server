#!/usr/bin/env node

import { buildServer } from './server';
import Config from './config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function runServer() {
  const config = new Config();
  console.error(`Base URL ${config.baseUrl}. Starting server.`);
  const server = await buildServer({
    name: config.prefix || 'runbook',
    baseUrl: config.baseUrl,
    accessToken: config.apiToken
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
